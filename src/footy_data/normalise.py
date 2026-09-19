from __future__ import annotations

import re
import unicodedata
import pandas as pd

from .contracts import REQUIRED_MATCH_TEAM_COLUMNS


def canonical_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def make_match_id(
    league: object,
    season: object,
    date: object,
    home_team: object,
    away_team: object,
) -> str:
    parts = [league, season, date, home_team, away_team]
    return "__".join(canonical_text(x) for x in parts)


def validate_match_team_metrics(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in REQUIRED_MATCH_TEAM_COLUMNS if c not in frame.columns]
    if missing:
        raise ValueError(
            "Normalized frame is missing required columns: " + ", ".join(missing)
        )

    out = frame.copy()
    out["match_date"] = pd.to_datetime(out["match_date"], errors="raise", utc=True)
    for col in ["goals", "goals_conceded", "xg", "xga"]:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    if out[["xg", "xga"]].isna().any().any():
        raise ValueError("xG/xGA contains missing/non-numeric values.")

    return out
