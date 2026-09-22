from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .identity import default_resolver
from .normalise import canonical_text


@dataclass(frozen=True)
class ExternalResultReport:
    provider_matches: int
    matched_matches: int
    unmatched_matches: int
    match_rate: float
    score_mismatches: int
    status: str
    matched_match_ids: tuple[str, ...]


def _team_key(value: object) -> str:
    resolved = default_resolver().resolve(str(value))
    return canonical_text(resolved)


def verify_external_results(
    matches: pd.DataFrame,
    metrics: pd.DataFrame,
    external: pd.DataFrame,
    *,
    date_col: str = "date",
    home_team_col: str = "home_team",
    away_team_col: str = "away_team",
    home_goals_col: str = "FTHG",
    away_goals_col: str = "FTAG",
    minimum_match_rate: float = 0.97,
) -> ExternalResultReport:
    if matches.empty or metrics.empty:
        raise ValueError("Provider matches and metrics are required.")
    if external.empty:
        raise ValueError("External result data is required.")

    required_external = {
        date_col,
        home_team_col,
        away_team_col,
        home_goals_col,
        away_goals_col,
    }
    missing = required_external - set(external.columns)
    if missing:
        raise ValueError(
            f"External result frame missing columns: {sorted(missing)}"
        )

    home = (
        metrics[metrics["home_away"] == "H"]
        [["match_id", "team", "goals"]]
        .rename(columns={
            "team": "metric_home_team",
            "goals": "provider_home_goals",
        })
    )
    away = (
        metrics[metrics["home_away"] == "A"]
        [["match_id", "team", "goals"]]
        .rename(columns={
            "team": "metric_away_team",
            "goals": "provider_away_goals",
        })
    )
    provider = (
        matches[
            ["match_id", "kickoff_at", "home_team", "away_team"]
        ]
        .merge(home, on="match_id", how="inner", validate="one_to_one")
        .merge(away, on="match_id", how="inner", validate="one_to_one")
    )
    if provider.empty:
        raise ValueError("No complete provider match/result rows found.")

    provider["date_key"] = pd.to_datetime(
        provider["kickoff_at"],
        errors="coerce",
        utc=True,
    ).dt.floor("D")
    provider["home_key"] = provider["home_team"].map(_team_key)
    provider["away_key"] = provider["away_team"].map(_team_key)

    ext = external.copy()
    ext["date_key"] = pd.to_datetime(
        ext[date_col],
        errors="coerce",
        utc=True,
        dayfirst=True,
    ).dt.floor("D")
    ext["home_key"] = ext[home_team_col].map(_team_key)
    ext["away_key"] = ext[away_team_col].map(_team_key)
    ext["external_home_goals"] = pd.to_numeric(
        ext[home_goals_col],
        errors="coerce",
    )
    ext["external_away_goals"] = pd.to_numeric(
        ext[away_goals_col],
        errors="coerce",
    )
    ext = ext.dropna(
        subset=[
            "date_key",
            "home_key",
            "away_key",
            "external_home_goals",
            "external_away_goals",
        ]
    )
    ext = ext.drop_duplicates(
        ["date_key", "home_key", "away_key"],
        keep="last",
    )

    joined = provider.merge(
        ext[
            [
                "date_key",
                "home_key",
                "away_key",
                "external_home_goals",
                "external_away_goals",
            ]
        ],
        on=["date_key", "home_key", "away_key"],
        how="left",
        validate="one_to_one",
    )

    matched = joined.dropna(
        subset=["external_home_goals", "external_away_goals"]
    ).copy()
    score_mismatch = (
        (pd.to_numeric(matched["provider_home_goals"]) !=
         matched["external_home_goals"])
        |
        (pd.to_numeric(matched["provider_away_goals"]) !=
         matched["external_away_goals"])
    )

    provider_matches = int(len(provider))
    matched_matches = int(len(matched))
    match_rate = (
        float(matched_matches / provider_matches)
        if provider_matches
        else 0.0
    )
    mismatches = int(score_mismatch.sum())

    if match_rate < minimum_match_rate or mismatches:
        status = "BLOCKED"
    elif match_rate < 0.995:
        status = "WARN"
    else:
        status = "PASS"

    verified_ids = tuple(
        matched.loc[~score_mismatch, "match_id"].astype(str).tolist()
    )

    return ExternalResultReport(
        provider_matches=provider_matches,
        matched_matches=matched_matches,
        unmatched_matches=provider_matches - matched_matches,
        match_rate=match_rate,
        score_mismatches=mismatches,
        status=status,
        matched_match_ids=verified_ids,
    )
