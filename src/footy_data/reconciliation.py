from __future__ import annotations

import re
import unicodedata

import pandas as pd


def canonical_team_name(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(
        r"\b(football club|futbol club|fc|afc|cf|sc|ac)\b",
        " ",
        text,
    )
    return re.sub(r"[^a-z0-9]+", "", text)


def reconcile_fixture_id(
    home_team: str,
    away_team: str,
    kickoff_at: object,
    existing: pd.DataFrame,
    *,
    tolerance_hours: float = 6.0,
) -> str | None:
    if existing.empty:
        return None

    kickoff = pd.to_datetime(kickoff_at, errors="coerce", utc=True)
    if pd.isna(kickoff):
        return None

    target_home = canonical_team_name(home_team)
    target_away = canonical_team_name(away_team)
    if not target_home or not target_away:
        return None

    candidates = existing.copy()
    candidates["_kickoff"] = pd.to_datetime(
        candidates["kickoff_at"],
        errors="coerce",
        utc=True,
    )
    candidates = candidates[
        candidates["_kickoff"].notna()
        & (
            (candidates["_kickoff"] - kickoff).abs()
            <= pd.Timedelta(hours=float(tolerance_hours))
        )
    ].copy()
    if candidates.empty:
        return None

    candidates["_home_key"] = candidates["home_team"].map(canonical_team_name)
    candidates["_away_key"] = candidates["away_team"].map(canonical_team_name)
    exact = candidates[
        (candidates["_home_key"] == target_home)
        & (candidates["_away_key"] == target_away)
    ]
    if len(exact) != 1:
        return None
    return str(exact.iloc[0]["match_id"])
