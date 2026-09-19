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

HISTORICAL_PREDICTION_FIELDS = {
    "match_id", "model_version",
    "model_home_xg", "model_away_xg",
    "uncertainty_haircut",
    "home_win_probability", "draw_probability", "away_win_probability",
    "over_2_5_probability", "btts_yes_probability",
    "home_elo", "away_elo",
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
        self._upsert("footy_matches", rows, "match_id", MATCH_FIELDS)

    def upsert_match_team_metrics(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert(
            "footy_match_team_metrics",
            rows,
            "match_id,team,source",
            MATCH_TEAM_METRIC_FIELDS,
        )

    def upsert_team_ratings(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self._upsert(
            "footy_team_ratings",
            rows,
            "team,rating_type,rating_date,source",
            TEAM_RATING_FIELDS,
        )

    def upsert_historical_predictions(
        self,
        rows: Iterable[Mapping[str, Any]],
    ) -> None:
        self._upsert(
            "footy_historical_predictions",
            rows,
            "match_id,model_version",
            HISTORICAL_PREDICTION_FIELDS,
        )

    def upsert_bookmaker_prices(
        self,
        rows: Iterable[Mapping[str, Any]],
    ) -> None:
        allowed = {
            "price_key", "match_id", "bookmaker", "market", "selection",
            "line", "decimal_odds", "price_kind", "source", "captured_at",
        }
        self._upsert(
            "footy_bookmaker_prices",
            rows,
            "price_key",
            allowed,
        )

    def insert_bookmaker_prices(self, rows: Iterable[Mapping[str, Any]]) -> None:
        self.upsert_bookmaker_prices(rows)


class SupabaseRESTReader:
    """Server-side reader using the same service-role credentials."""

    def __init__(
        self,
        url: str | None = None,
        service_role_key: str | None = None,
        timeout: int = 30,
        page_size: int = 1000,
    ):
        self.url = (url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.timeout = timeout
        self.page_size = page_size
        if not self.url:
            raise ValueError("SUPABASE_URL is required.")
        if not self.key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required.")

    def _get_all(self, table: str, select: str = "*") -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        start = 0
        while True:
            end = start + self.page_size - 1
            response = requests.get(
                f"{self.url}/rest/v1/{table}",
                params={"select": select},
                headers={
                    "apikey": self.key,
                    "Authorization": f"Bearer {self.key}",
                    "Range": f"{start}-{end}",
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            batch = response.json()
            rows.extend(batch)
            if len(batch) < self.page_size:
                break
            start += self.page_size
        return rows

    def historical_match_team_metrics(
        self,
        include_ratings: bool = False,
    ) -> pd.DataFrame:
        matches = pd.DataFrame(self._get_all(
            "footy_matches",
            "match_id,league,season,kickoff_at,home_team,away_team",
        ))
        metrics = pd.DataFrame(self._get_all(
            "footy_match_team_metrics",
            "match_id,team,opponent,home_away,goals,goals_conceded,xg,npxg,xga,npxga,ppda,deep_completions,source,retrieved_at",
        ))
        if matches.empty or metrics.empty:
            return pd.DataFrame()

        matches = matches.rename(columns={"kickoff_at": "match_date"})
        frame = metrics.merge(
            matches[["match_id", "league", "season", "match_date"]],
            on="match_id",
            how="inner",
        )

        if not include_ratings:
            return frame

        ratings = pd.DataFrame(self._get_all(
            "footy_team_ratings",
            "team,rating_type,rating_value,rating_date,source",
        ))
        if ratings.empty:
            return frame

        ratings = ratings[ratings["rating_type"] == "clubelo"].copy()
        if ratings.empty:
            return frame

        frame["rating_date"] = pd.to_datetime(
            frame["match_date"], utc=True
        ).dt.floor("D")
        ratings["rating_date"] = pd.to_datetime(
            ratings["rating_date"], utc=True
        ).dt.floor("D")
        ratings["rating_value"] = pd.to_numeric(
            ratings["rating_value"], errors="coerce"
        )
        ratings["_source_priority"] = (
            ratings["source"].ne("clubelo").astype(int)
        )
        ratings = (
            ratings.sort_values(
                ["team", "rating_date", "_source_priority"]
            )
            .drop_duplicates(
                ["team", "rating_date"],
                keep="first",
            )
        )

        team_ratings = ratings[
            ["team", "rating_date", "rating_value"]
        ].rename(columns={"rating_value": "team_elo"})
        frame = frame.merge(
            team_ratings,
            on=["team", "rating_date"],
            how="left",
        )

        opponent_ratings = ratings[
            ["team", "rating_date", "rating_value"]
        ].rename(columns={
            "team": "opponent",
            "rating_value": "opponent_elo",
        })
        frame = frame.merge(
            opponent_ratings,
            on=["opponent", "rating_date"],
            how="left",
        )
        return frame

    def historical_predictions(
        self,
        model_version: str,
    ) -> pd.DataFrame:
        rows = pd.DataFrame(self._get_all(
            "footy_historical_predictions",
            "match_id,model_version,model_home_xg,model_away_xg,uncertainty_haircut,home_win_probability,draw_probability,away_win_probability,over_2_5_probability,btts_yes_probability,home_elo,away_elo",
        ))
        if rows.empty:
            return rows
        return rows[rows["model_version"] == model_version].copy()

    def bookmaker_prices(
        self,
        bookmaker: str,
        price_kind: str,
        source: str | None = None,
        market: str = "1X2",
    ) -> pd.DataFrame:
        rows = pd.DataFrame(self._get_all(
            "footy_bookmaker_prices",
            "price_key,match_id,bookmaker,market,selection,line,decimal_odds,price_kind,source,captured_at",
        ))
        if rows.empty:
            return rows
        rows = rows[
            (rows["bookmaker"] == bookmaker)
            & (rows["price_kind"] == price_kind)
            & (rows["market"] == market)
        ].copy()
        if source is not None:
            rows = rows[rows["source"] == source].copy()
        return rows


def insert_backtest_run(
    writer: SupabaseRESTWriter,
    row: Mapping[str, Any],
) -> None:
    allowed = {
        "model_version", "league", "seasons", "prediction_rows",
        "home_win_brier", "home_win_log_loss",
        "over_2_5_brier", "over_2_5_log_loss",
        "btts_brier", "btts_log_loss", "result_1x2_log_loss",
        "calibration",
    }
    payload = [_project_row(row, allowed)]
    response = requests.post(
        f"{writer.url}/rest/v1/footy_backtest_runs",
        headers={
            "apikey": writer.key,
            "Authorization": f"Bearer {writer.key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=payload,
        timeout=writer.timeout,
    )
    response.raise_for_status()


def insert_value_backtest_run(
    writer: SupabaseRESTWriter,
    row: Mapping[str, Any],
) -> None:
    allowed = {
        "model_version", "bookmaker", "price_kind", "source", "market",
        "target_ev", "bets", "strike_rate", "average_odds", "roi",
        "average_raw_ev", "average_probability_edge",
        "average_market_overround", "by_selection", "by_edge_bucket",
    }
    payload = [_project_row(row, allowed)]
    response = requests.post(
        f"{writer.url}/rest/v1/footy_value_backtest_runs",
        headers={
            "apikey": writer.key,
            "Authorization": f"Bearer {writer.key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=payload,
        timeout=writer.timeout,
    )
    response.raise_for_status()
