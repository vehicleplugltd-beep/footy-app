from __future__ import annotations

import math
import os
from datetime import date, datetime
from typing import Iterable, Mapping, Any

import pandas as pd
import requests


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


def frame_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {key: _clean_value(value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]


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
    ) -> None:
        payload = [
            {key: _clean_value(value) for key, value in dict(row).items()}
            for row in rows
        ]
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
        self._upsert("matches", rows, "match_id")

    def upsert_match_team_metrics(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert(
            "match_team_metrics",
            rows,
            "match_id,team,source",
        )

    def upsert_team_ratings(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert(
            "team_ratings",
            rows,
            "team,rating_type,rating_date,source",
        )

    def insert_bookmaker_prices(self, rows: Iterable[Mapping[str, Any]]) -> None:
        payload = [
            {key: _clean_value(value) for key, value in dict(row).items()}
            for row in rows
        ]
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
