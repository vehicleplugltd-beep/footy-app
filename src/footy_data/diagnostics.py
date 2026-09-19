from __future__ import annotations

import pandas as pd

from .features import (
    add_rolling_process,
    add_home_away_process,
    add_schedule_adjusted_process,
)
from .walk_forward import _process_value


def upcoming_process_diagnostics(
    history: pd.DataFrame,
    fixture: dict,
    prior_goals_per_team_match: float = 1.35,
) -> dict:
    historical = history.copy()
    historical["match_date"] = pd.to_datetime(
        historical["match_date"], errors="coerce", utc=True
    )
    historical = historical[
        historical["xg"].notna() & historical["xga"].notna()
    ].copy()

    common = {
        "match_id": str(fixture["match_id"]),
        "match_date": pd.to_datetime(fixture["match_date"], utc=True),
        "league": fixture["league"],
        "season": str(fixture["season"]),
        "goals": None,
        "goals_conceded": None,
        "xg": None,
        "xga": None,
        "npxg": None,
        "npxga": None,
        "ppda": None,
        "deep_completions": None,
        "source": "diagnostic",
        "retrieved_at": pd.Timestamp.now(tz="UTC"),
    }
    dummy = pd.DataFrame([
        {
            **common,
            "team": fixture["home_team"],
            "opponent": fixture["away_team"],
            "home_away": "H",
        },
        {
            **common,
            "team": fixture["away_team"],
            "opponent": fixture["home_team"],
            "home_away": "A",
        },
    ])

    frame = pd.concat([historical, dummy], ignore_index=True, sort=False)
    frame = add_rolling_process(frame)
    frame = add_home_away_process(frame)
    frame = add_schedule_adjusted_process(
        frame,
        league_xg_prior=prior_goals_per_team_match,
        league_npxg_prior=max(prior_goals_per_team_match - 0.10, 0.5),
    )

    current = frame[frame["match_id"].astype(str) == str(fixture["match_id"])]
    result = {}
    for side, tag in (("H", "home"), ("A", "away")):
        row = current[current["home_away"] == side].iloc[0]
        result[tag] = {
            "team": row["team"],
            "matches_before": int(row["team_matches_before"]),
            "xg_process": float(_process_value(row, "xg")),
            "xga_process": float(_process_value(row, "xga")),
            "xg_sched_process": float(_process_value(row, "xg_sched")),
            "xga_sched_process": float(_process_value(row, "xga_sched")),
            "npxg_process": float(_process_value(row, "npxg")),
            "npxga_process": float(_process_value(row, "npxga")),
            "ppda_process": float(row["ppda_process"]),
            "deep_process": float(row["deep_completions_process"]),
            "xg_prior": float(row["xg_prior"]),
            "xga_prior": float(row["xga_prior"]),
            "xg_recent": float(row["xg_recent"]),
            "xga_recent": float(row["xga_recent"]),
        }
    return result
