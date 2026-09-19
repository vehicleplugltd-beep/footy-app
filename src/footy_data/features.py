from __future__ import annotations

import numpy as np
import pandas as pd


PROCESS_METRICS = (
    "xg", "xga", "npxg", "npxga",
    "goals", "goals_conceded",
    "shots", "shots_on_target", "shots_in_box",
    "big_chances", "big_chances_conceded",
    "box_touches", "xa", "key_passes", "set_piece_xg",
    "possession", "ppda", "field_tilt", "deep_completions",
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


def add_schedule_adjusted_process(
    frame: pd.DataFrame,
    league_xg_prior: float = 1.35,
    league_npxg_prior: float = 1.25,
    span: int = 8,
    prior_weight: float = 0.35,
    split_weight: float = 0.35,
    factor_floor: float = 0.65,
    factor_ceiling: float = 1.45,
) -> pd.DataFrame:
    """
    Normalize each observed xG/xGA performance for the opponent strength
    known before that match, then build leakage-safe rolling team processes.

    Example: creating 1.20 xG against an opponent whose pre-match defensive
    xGA process is only 0.90 is treated as stronger attacking evidence than
    creating 1.20 against a defence allowing 1.80.

    Opponent process columns must already be pre-match shifted via
    add_rolling_process. The adjusted observation from the current match is
    itself shifted before entering any future process estimate.
    """
    if not 0 <= prior_weight <= 1:
        raise ValueError("prior_weight must be between 0 and 1.")
    if not 0 <= split_weight <= 1:
        raise ValueError("split_weight must be between 0 and 1.")

    required = {
        "match_id", "match_date", "team", "opponent", "home_away",
        "xg", "xga", "xg_process", "xga_process",
    }
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(
            "Schedule adjustment missing columns: "
            + ", ".join(sorted(missing))
        )

    out = frame.sort_values(["team", "match_date"]).copy()

    opponent_cols = [
        "match_id", "team", "xg_process", "xga_process",
    ]
    for optional in (
        "npxg_process", "npxga_process",
        "deep_completions", "ppda",
    ):
        if optional in out.columns:
            opponent_cols.append(optional)

    opp = out[opponent_cols].copy().rename(columns={
        "team": "opponent",
        "xg_process": "opponent_xg_process",
        "xga_process": "opponent_xga_process",
        "npxg_process": "opponent_npxg_process",
        "npxga_process": "opponent_npxga_process",
        "deep_completions": "deep_completions_conceded_observed",
        "ppda": "ppda_faced_observed",
    })
    out = out.merge(
        opp,
        on=["match_id", "opponent"],
        how="left",
        validate="many_to_one",
    )

    attack_factor = (
        pd.to_numeric(out["opponent_xga_process"], errors="coerce")
        / league_xg_prior
    ).clip(factor_floor, factor_ceiling)
    defence_factor = (
        pd.to_numeric(out["opponent_xg_process"], errors="coerce")
        / league_xg_prior
    ).clip(factor_floor, factor_ceiling)

    out["xg_sched_observed"] = (
        pd.to_numeric(out["xg"], errors="coerce") / attack_factor
    ).where(attack_factor.notna(), out["xg"])
    out["xga_sched_observed"] = (
        pd.to_numeric(out["xga"], errors="coerce") / defence_factor
    ).where(defence_factor.notna(), out["xga"])

    adjusted_metrics = ["xg_sched", "xga_sched"]

    if {
        "npxg", "npxga",
        "opponent_npxg_process", "opponent_npxga_process",
    }.issubset(out.columns):
        np_attack_factor = (
            pd.to_numeric(
                out["opponent_npxga_process"], errors="coerce"
            ) / league_npxg_prior
        ).clip(factor_floor, factor_ceiling)
        np_defence_factor = (
            pd.to_numeric(
                out["opponent_npxg_process"], errors="coerce"
            ) / league_npxg_prior
        ).clip(factor_floor, factor_ceiling)
        out["npxg_sched_observed"] = (
            pd.to_numeric(out["npxg"], errors="coerce")
            / np_attack_factor
        ).where(np_attack_factor.notna(), out["npxg"])
        out["npxga_sched_observed"] = (
            pd.to_numeric(out["npxga"], errors="coerce")
            / np_defence_factor
        ).where(np_defence_factor.notna(), out["npxga"])
        adjusted_metrics += ["npxg_sched", "npxga_sched"]

    if "deep_completions_conceded_observed" in out.columns:
        adjusted_metrics.append("deep_completions_conceded")
    if "ppda_faced_observed" in out.columns:
        adjusted_metrics.append("ppda_faced")

    for metric in adjusted_metrics:
        observed_col = f"{metric}_observed"
        values = pd.to_numeric(out[observed_col], errors="coerce")
        out[observed_col] = values
        grouped = out.groupby("team", group_keys=False)[observed_col]
        recent = grouped.transform(lambda s: _pregame_ewm(s, span))
        prior = grouped.transform(_pregame_expanding)
        process = (1 - prior_weight) * recent + prior_weight * prior
        out[f"{metric}_recent"] = recent
        out[f"{metric}_prior"] = prior
        out[f"{metric}_process"] = process

        split_recent = (
            out.groupby(
                ["team", "home_away"], group_keys=False
            )[observed_col]
            .transform(lambda s: _pregame_ewm(s, span))
        )
        out[f"{metric}_venue_recent"] = split_recent
        out[f"{metric}_venue_process"] = (
            split_weight * split_recent
            + (1 - split_weight) * process
        )

    return out
