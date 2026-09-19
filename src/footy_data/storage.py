from __future__ import annotations

import math
import os
from datetime import date, datetime
from typing import Iterable, Mapping, Any

import pandas as pd
import requests


MATCH_FIELDS = {
    "match_id", "league", "season", "kickoff_at",
    "home_team", "away_team", "status", "source", "retrieved_at",
}

MATCH_TEAM_METRIC_FIELDS = {
    "match_id", "team", "opponent", "home_away",
    "goals", "goals_conceded",
    "xg", "npxg", "xga", "npxga",
    "shots", "shots_on_target", "shots_conceded", "sot_conceded",
    "big_chances", "big_chances_conceded",
    "box_touches", "key_passes", "xa",
    "set_piece_xg", "set_piece_xga",
    "possession", "ppda", "field_tilt", "deep_completions",
    "source", "retrieved_at",
}

TEAM_RATING_FIELDS = {
    "team", "rating_type", "rating_value", "rating_date", "source",
}


def _clean_value(value: Any):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def _project_row(row: Mapping[str, Any], allowed: set[str]) -> dict[str, Any]:
    return {
        key: _clean_value(value)
        for key, value in dict(row).items()
        if key in allowed
    }


def frame_records(
    frame: pd.DataFrame,
    allowed_fields: set[str] | None = None,
) -> list[dict[str, Any]]:
    records = frame.to_dict(orient="records")
    if allowed_fields is None:
        return [
            {key: _clean_value(value) for key, value in row.items()}
            for row in records
        ]
    return [_project_row(row, allowed_fields) for row in records]


class SupabaseRESTWriter:
    """
    Server-side writer for Footy.

    Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never use the
    service-role key in browser/mobile code or commit it to the repository.
    """

    def __init__(
        self,
        url: str | None = None,
        service_role_key: str | None = None,
        timeout: int = 30,
    ):
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.timeout = timeout

        if not self.url:
            raise ValueError("SUPABASE_URL is required.")
        if not self.key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required.")

    def _upsert(
        self,
        table: str,
        rows: Iterable[Mapping[str, Any]],
        on_conflict: str,
        allowed_fields: set[str],
    ) -> None:
        payload = [_project_row(row, allowed_fields) for row in rows]
        if not payload:
            return

        response = requests.post(
            f"{self.url}/rest/v1/{table}",
            params={"on_conflict": on_conflict},
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()

    def upsert_matches(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert("matches", rows, "match_id", MATCH_FIELDS)

    def upsert_match_team_metrics(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert(
            "match_team_metrics",
            rows,
            "match_id,team,source",
            MATCH_TEAM_METRIC_FIELDS,
        )

    def upsert_team_ratings(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert(
            "team_ratings",
            rows,
            "team,rating_type,rating_date,source",
            TEAM_RATING_FIELDS,
        )

    def insert_bookmaker_prices(self, rows: Iterable[Mapping[str, Any]]) -> None:
        allowed = {
            "match_id", "bookmaker", "market", "selection",
            "line", "decimal_odds", "captured_at",
        }
        payload = [_project_row(row, allowed) for row in rows]
        if not payload:
            return

        response = requests.post(
            f"{self.url}/rest/v1/bookmaker_prices",
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
