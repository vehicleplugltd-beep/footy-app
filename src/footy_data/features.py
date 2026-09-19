from __future__ import annotations

import numpy as np
import pandas as pd


PROCESS_METRICS = (
    "xg", "xga", "npxg", "npxga",
    "goals", "goals_conceded",
    "shots", "shots_on_target", "shots_in_box",
    "big_chances", "big_chances_conceded",
    "box_touches", "xa", "key_passes", "set_piece_xg",
    "possession", "ppda", "field_tilt",
)


def add_process_residuals(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["finishing_residual"] = out["goals"] - out["xg"]
    out["defensive_residual"] = out["goals_conceded"] - out["xga"]
    if {"npxg", "goals"}.issubset(out.columns):
        out["finishing_residual_npxg"] = out["goals"] - out["npxg"]
    return out


def _pregame_ewm(s: pd.Series, span: int) -> pd.Series:
    return s.shift(1).ewm(span=span, adjust=False, min_periods=1).mean()


def _pregame_expanding(s: pd.Series) -> pd.Series:
    return s.shift(1).expanding(min_periods=1).mean()


def add_rolling_process(
    frame: pd.DataFrame,
    span: int = 8,
    prior_weight: float = 0.35,
) -> pd.DataFrame:
    if not 0 <= prior_weight <= 1:
        raise ValueError("prior_weight must be between 0 and 1.")

    out = frame.sort_values(["team", "match_date"]).copy()

    for metric in PROCESS_METRICS:
        if metric not in out.columns:
            continue
        out[metric] = pd.to_numeric(out[metric], errors="coerce")
        grouped = out.groupby("team", group_keys=False)[metric]
        recent = grouped.transform(lambda s: _pregame_ewm(s, span))
        prior = grouped.transform(_pregame_expanding)
        out[f"{metric}_recent"] = recent
        out[f"{metric}_prior"] = prior
        out[f"{metric}_process"] = (
            (1 - prior_weight) * recent + prior_weight * prior
        )

    out["team_matches_before"] = out.groupby("team").cumcount()
    return out


def add_home_away_process(
    frame: pd.DataFrame,
    span: int = 8,
    split_weight: float = 0.35,
) -> pd.DataFrame:
    if not 0 <= split_weight <= 1:
        raise ValueError("split_weight must be between 0 and 1.")

    out = frame.sort_values(["team", "match_date"]).copy()

    for metric in ("xg", "xga", "npxg", "npxga"):
        if metric not in out.columns:
            continue
        overall_col = f"{metric}_process"
        if overall_col not in out.columns:
            raise ValueError(f"{overall_col} missing. Run add_rolling_process first.")

        split_recent = (
            out.groupby(["team", "home_away"], group_keys=False)[metric]
            .transform(lambda s: _pregame_ewm(s, span))
        )
        out[f"{metric}_venue_recent"] = split_recent
        out[f"{metric}_venue_process"] = (
            split_weight * split_recent + (1 - split_weight) * out[overall_col]
        )

    return out


def apply_opponent_strength_adjustment(
    frame: pd.DataFrame,
    opponent_rating_col: str = "opponent_elo",
    league_mean_elo: float = 1500.0,
    scale: float = 400.0,
) -> pd.DataFrame:
    out = frame.copy()
    if opponent_rating_col not in out:
        out["opponent_strength_factor"] = np.nan
        return out

    rating = pd.to_numeric(out[opponent_rating_col], errors="coerce")
    delta = (rating - league_mean_elo) / scale
    factor = np.exp(delta * 0.20)
    out["opponent_strength_factor"] = factor

    for metric in ("xg_process", "npxg_process"):
        if metric in out:
            out[f"{metric}_opp_adj"] = out[metric] * factor

    for metric in ("xga_process", "npxga_process"):
        if metric in out:
            out[f"{metric}_opp_adj"] = out[metric] / factor

    return out


def uncertainty_penalty(
    sample_size: pd.Series | float | int,
    base_penalty: float = 0.06,
    stable_after: int = 16,
):
    if isinstance(sample_size, (int, float)):
        n = max(float(sample_size), 1.0)
        return min(base_penalty * np.sqrt(stable_after / n), 0.18)

    n = sample_size.clip(lower=1)
    penalty = base_penalty * np.sqrt(stable_after / n)
    return penalty.clip(upper=0.18)
