from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .features import (
    add_home_away_process,
    add_rolling_process,
    add_schedule_adjusted_process,
)
from .model import ExpectedGoals, market_probabilities


FEATURE_COLUMNS = (
    "home_indicator",
    "attack_xg",
    "attack_shots",
    "attack_sot",
    "attack_set_piece_xg",
    "attack_deep",
    "attack_ppda",
    "opp_defence_xga",
    "opp_shots_conceded",
    "opp_sot_conceded",
    "opp_set_piece_xga",
    "opp_deep_conceded",
    "opp_ppda",
)


@dataclass(frozen=True)
class RidgeFit:
    coefficients: np.ndarray
    means: np.ndarray
    scales: np.ndarray
    feature_columns: tuple[str, ...]
    alpha: float


def _match_process(frame: pd.DataFrame, metric: str) -> pd.Series:
    venue = frame.get(f"{metric}_venue_process")
    overall = frame.get(f"{metric}_process")
    if venue is None:
        if overall is None:
            return pd.Series(np.nan, index=frame.index)
        return pd.to_numeric(overall, errors="coerce")
    venue = pd.to_numeric(venue, errors="coerce")
    if overall is None:
        return venue
    overall = pd.to_numeric(overall, errors="coerce")
    return venue.where(venue.notna(), overall)


def build_process_feature_rows(
    match_team_metrics: pd.DataFrame,
    *,
    process_span: int = 16,
    process_prior_weight: float = 0.50,
    venue_split_weight: float = 0.20,
    min_team_matches: int = 5,
) -> pd.DataFrame:
    """
    Build leakage-safe pre-match feature rows for team xG prediction.

    Every rolling process is shifted before the current match. The current
    match's xG is retained only as the supervised target.
    """
    required = {
        "match_id", "match_date", "league", "season", "team", "opponent",
        "home_away", "xg", "xga", "shots", "shots_on_target",
        "shots_conceded", "sot_conceded", "set_piece_xg", "set_piece_xga",
        "ppda", "deep_completions",
    }
    missing = required - set(match_team_metrics.columns)
    if missing:
        raise ValueError(
            "Process ridge input missing columns: " + ", ".join(sorted(missing))
        )

    frame = match_team_metrics.copy()
    frame["match_date"] = pd.to_datetime(frame["match_date"], utc=True)
    frame = add_rolling_process(
        frame,
        span=process_span,
        prior_weight=process_prior_weight,
    )
    frame = add_home_away_process(
        frame,
        span=process_span,
        split_weight=venue_split_weight,
    )
    frame = add_schedule_adjusted_process(
        frame,
        span=process_span,
        prior_weight=process_prior_weight,
        split_weight=venue_split_weight,
    )

    frame["attack_xg"] = _match_process(frame, "xg_sched")
    frame["opp_defence_xga_source"] = _match_process(frame, "xga_sched")
    frame["attack_shots"] = pd.to_numeric(
        frame.get("shots_process"), errors="coerce"
    )
    frame["attack_sot"] = pd.to_numeric(
        frame.get("shots_on_target_process"), errors="coerce"
    )
    frame["attack_set_piece_xg"] = pd.to_numeric(
        frame.get("set_piece_xg_process"), errors="coerce"
    )
    frame["attack_deep"] = pd.to_numeric(
        frame.get("deep_completions_process"), errors="coerce"
    )
    frame["attack_ppda"] = pd.to_numeric(
        frame.get("ppda_process"), errors="coerce"
    )

    frame["defence_xga"] = _match_process(frame, "xga_sched")
    frame["shots_conceded_process_value"] = pd.to_numeric(
        frame.get("shots_conceded_process"), errors="coerce"
    )
    frame["sot_conceded_process_value"] = pd.to_numeric(
        frame.get("sot_conceded_process"), errors="coerce"
    )
    frame["set_piece_xga_process_value"] = pd.to_numeric(
        frame.get("set_piece_xga_process"), errors="coerce"
    )
    frame["deep_conceded_process_value"] = pd.to_numeric(
        frame.get("deep_completions_conceded_process"), errors="coerce"
    )
    frame["ppda_process_value"] = pd.to_numeric(
        frame.get("ppda_process"), errors="coerce"
    )

    opponent = frame[
        [
            "match_id", "team", "team_matches_before", "defence_xga",
            "shots_conceded_process_value", "sot_conceded_process_value",
            "set_piece_xga_process_value", "deep_conceded_process_value",
            "ppda_process_value",
        ]
    ].rename(columns={
        "team": "opponent",
        "team_matches_before": "opp_matches_before",
        "defence_xga": "opp_defence_xga",
        "shots_conceded_process_value": "opp_shots_conceded",
        "sot_conceded_process_value": "opp_sot_conceded",
        "set_piece_xga_process_value": "opp_set_piece_xga",
        "deep_conceded_process_value": "opp_deep_conceded",
        "ppda_process_value": "opp_ppda",
    })

    frame = frame.merge(
        opponent,
        on=["match_id", "opponent"],
        how="left",
        validate="many_to_one",
    )
    frame["home_indicator"] = (frame["home_away"] == "H").astype(float)
    frame["target_xg"] = pd.to_numeric(frame["xg"], errors="coerce")

    keep = [
        "match_id", "match_date", "league", "season", "team", "opponent",
        "home_away", "target_xg", "team_matches_before", "opp_matches_before",
        *FEATURE_COLUMNS,
    ]
    out = frame[keep].copy()

    for col in FEATURE_COLUMNS:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out = out[
        (out["team_matches_before"] >= min_team_matches)
        & (out["opp_matches_before"] >= min_team_matches)
    ].copy()
    out = out.dropna(subset=["target_xg", *FEATURE_COLUMNS])
    return out.sort_values(["match_date", "match_id", "home_away"]).reset_index(
        drop=True
    )


def _transform_features(
    frame: pd.DataFrame,
    feature_columns: tuple[str, ...],
) -> np.ndarray:
    values = frame.loc[:, feature_columns].to_numpy(dtype=float)
    out = values.copy()
    for idx, name in enumerate(feature_columns):
        if name == "home_indicator":
            continue
        out[:, idx] = np.log1p(np.clip(out[:, idx], 0.0, None))
    return out


def fit_ridge_xg(
    training_rows: pd.DataFrame,
    *,
    alpha: float = 10.0,
    feature_columns: tuple[str, ...] = FEATURE_COLUMNS,
) -> RidgeFit:
    if alpha < 0:
        raise ValueError("alpha must be non-negative.")
    if training_rows.empty:
        raise ValueError("training_rows must not be empty.")

    x = _transform_features(training_rows, feature_columns)
    y = np.log(
        np.clip(training_rows["target_xg"].to_numpy(dtype=float), 0.0, None)
        + 0.15
    )

    means = x.mean(axis=0)
    scales = x.std(axis=0)
    scales = np.where(scales < 1e-8, 1.0, scales)
    z = (x - means) / scales
    design = np.column_stack([np.ones(len(z)), z])

    penalty = np.eye(design.shape[1]) * alpha
    penalty[0, 0] = 0.0
    coefficients = np.linalg.solve(
        design.T @ design + penalty,
        design.T @ y,
    )
    return RidgeFit(
        coefficients=coefficients,
        means=means,
        scales=scales,
        feature_columns=feature_columns,
        alpha=float(alpha),
    )


def predict_ridge_xg(fit: RidgeFit, rows: pd.DataFrame) -> np.ndarray:
    x = _transform_features(rows, fit.feature_columns)
    z = (x - fit.means) / fit.scales
    design = np.column_stack([np.ones(len(z)), z])
    predicted = np.exp(design @ fit.coefficients) - 0.15
    return np.clip(predicted, 0.15, 3.80)


def holdout_match_predictions(
    feature_rows: pd.DataFrame,
    *,
    train_seasons: set[str],
    holdout_seasons: set[str],
    alpha: float = 10.0,
) -> tuple[RidgeFit, pd.DataFrame]:
    train = feature_rows[
        feature_rows["season"].astype(str).isin(train_seasons)
    ].copy()
    holdout = feature_rows[
        feature_rows["season"].astype(str).isin(holdout_seasons)
    ].copy()
    if train.empty or holdout.empty:
        raise ValueError("Both training and holdout rows are required.")

    fit = fit_ridge_xg(train, alpha=alpha)
    holdout["predicted_xg"] = predict_ridge_xg(fit, holdout)

    home = holdout[holdout["home_away"] == "H"][
        [
            "match_id", "match_date", "season", "team", "predicted_xg",
            "team_matches_before",
        ]
    ].rename(columns={
        "team": "home_team",
        "predicted_xg": "model_home_xg",
        "team_matches_before": "home_matches_before",
    })
    away = holdout[holdout["home_away"] == "A"][
        ["match_id", "team", "predicted_xg", "team_matches_before"]
    ].rename(columns={
        "team": "away_team",
        "predicted_xg": "model_away_xg",
        "team_matches_before": "away_matches_before",
    })
    matches = home.merge(
        away,
        on="match_id",
        how="inner",
        validate="one_to_one",
    )

    records = []
    for row in matches.itertuples(index=False):
        probs = market_probabilities(
            ExpectedGoals(
                home=float(row.model_home_xg),
                away=float(row.model_away_xg),
            )
        )
        n = max(
            min(
                int(row.home_matches_before),
                int(row.away_matches_before),
            ),
            1,
        )
        uncertainty = min(0.18, 0.06 * np.sqrt(16 / n))
        records.append({
            "match_id": str(row.match_id),
            "match_date": row.match_date,
            "season": str(row.season),
            "home_team": row.home_team,
            "away_team": row.away_team,
            "model_home_xg": float(row.model_home_xg),
            "model_away_xg": float(row.model_away_xg),
            "uncertainty_haircut": float(uncertainty),
            "home_win_probability": probs["home_win"],
            "draw_probability": probs["draw"],
            "away_win_probability": probs["away_win"],
            "over_2_5_probability": probs["over_2_5"],
            "btts_yes_probability": probs["btts_yes"],
        })

    return fit, pd.DataFrame(records).sort_values("match_date").reset_index(
        drop=True
    )
