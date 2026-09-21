from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import os
from typing import Any

import pandas as pd
import requests

from .storage import SupabaseRESTReader


PUBLIC_CALL_FIELDS = {
    "call_key",
    "source_kind",
    "match_id",
    "model_version",
    "market",
    "selection",
    "model_probability",
    "fair_odds",
    "minimum_take_price",
    "validation_status",
    "home_team",
    "away_team",
    "kickoff_at",
    "published_at",
    "quoted_bookmaker",
    "quoted_odds",
    "price_captured_at",
    "closing_odds",
    "home_goals",
    "away_goals",
    "result_status",
    "unit_profit",
    "clv",
    "settled_at",
}


@dataclass(frozen=True)
class ResultsRefresh:
    published: int
    settled: int
    open_calls: int


class ResultsLedger:
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

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def rows(self) -> list[dict[str, Any]]:
        response = requests.get(
            f"{self.url}/rest/v1/footy_public_calls",
            params={"select": "*", "order": "kickoff_at.desc"},
            headers=self.headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def insert(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        payload = [
            {key: value for key, value in row.items() if key in PUBLIC_CALL_FIELDS}
            for row in rows
        ]
        response = requests.post(
            f"{self.url}/rest/v1/footy_public_calls",
            headers={**self.headers, "Prefer": "return=minimal"},
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()

    def update(self, call_id: str, row: dict[str, Any]) -> None:
        payload = {
            key: value
            for key, value in row.items()
            if key in PUBLIC_CALL_FIELDS
        }
        response = requests.patch(
            f"{self.url}/rest/v1/footy_public_calls",
            params={"id": f"eq.{call_id}"},
            headers={**self.headers, "Prefer": "return=minimal"},
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()


def _latest_complete_1x2(outputs: pd.DataFrame) -> pd.DataFrame:
    if outputs.empty:
        return outputs

    frame = outputs.copy()
    frame["created_at"] = pd.to_datetime(frame["created_at"], utc=True, errors="coerce")
    frame = frame[
        (frame["market"] == "1X2")
        & frame["selection"].isin(["home", "draw", "away"])
    ].copy()
    if frame.empty:
        return frame

    complete_keys: list[tuple[str, pd.Timestamp]] = []
    for (match_id, created_at), group in frame.groupby(["match_id", "created_at"]):
        if set(group["selection"].astype(str)) >= {"home", "draw", "away"}:
            complete_keys.append((str(match_id), created_at))

    if not complete_keys:
        return pd.DataFrame(columns=frame.columns)

    complete = pd.DataFrame(complete_keys, columns=["match_id", "created_at"])
    latest = (
        complete.sort_values(["match_id", "created_at"])
        .drop_duplicates("match_id", keep="last")
    )
    return frame.merge(latest, on=["match_id", "created_at"], how="inner")


def publish_model_calls(
    model_version: str = "v7-r16-p50-v20",
    now: pd.Timestamp | None = None,
) -> int:
    current = now or pd.Timestamp.now(tz="UTC")
    if current.tzinfo is None:
        current = current.tz_localize("UTC")
    else:
        current = current.tz_convert("UTC")

    reader = SupabaseRESTReader()
    ledger = ResultsLedger()

    outputs = reader.model_outputs(model_version)
    if outputs.empty:
        return 0

    latest = _latest_complete_1x2(outputs)
    if latest.empty:
        return 0

    matches = pd.DataFrame(
        reader._get_all(
            "footy_matches",
            "match_id,kickoff_at,home_team,away_team,league,season",
        )
    )
    if matches.empty:
        return 0

    matches["kickoff_at"] = pd.to_datetime(matches["kickoff_at"], utc=True, errors="coerce")
    latest = latest.merge(
        matches[["match_id", "kickoff_at", "home_team", "away_team"]],
        on="match_id",
        how="inner",
    )
    latest = latest[
        (latest["kickoff_at"] > current)
        & (latest["created_at"] < latest["kickoff_at"])
    ].copy()
    if latest.empty:
        return 0

    validation = reader.model_market_validation(model_version)
    validation_status = "RESEARCH"
    if not validation.empty:
        one_x_two = validation[validation["market"] == "1X2"]
        if not one_x_two.empty:
            validation_status = str(one_x_two.iloc[0]["status"])

    existing = {
        str(row["call_key"])
        for row in ledger.rows()
    }

    rows: list[dict[str, Any]] = []
    for match_id, group in latest.groupby("match_id"):
        top = group.sort_values(
            ["model_probability", "selection"],
            ascending=[False, True],
        ).iloc[0]
        call_key = f"MODEL_CALL:{model_version}:{match_id}:1X2"
        if call_key in existing:
            continue

        rows.append({
            "call_key": call_key,
            "source_kind": "MODEL_CALL",
            "match_id": str(match_id),
            "model_version": model_version,
            "market": "1X2",
            "selection": str(top["selection"]),
            "model_probability": float(top["model_probability"]),
            "fair_odds": float(top["fair_odds"]),
            "minimum_take_price": (
                float(top["minimum_take_price"])
                if pd.notna(top["minimum_take_price"])
                else None
            ),
            "validation_status": validation_status,
            "home_team": str(top["home_team"]),
            "away_team": str(top["away_team"]),
            "kickoff_at": top["kickoff_at"].isoformat(),
            "published_at": current.isoformat(),
            "result_status": "OPEN",
        })

    ledger.insert(rows)
    return len(rows)


def _canonical_team(value: str) -> str:
    raw = "".join(ch for ch in str(value).lower() if ch.isalnum())
    aliases = {
        "mancity": "manchestercity",
        "manutd": "manchesterunited",
        "spurs": "tottenham",
        "tottenhamhotspur": "tottenham",
        "newcastle": "newcastleunited",
        "nottmforest": "nottinghamforest",
        "wolves": "wolverhamptonwanderers",
    }
    return aliases.get(raw, raw)


def _identity_result(
    call: dict[str, Any],
    results: pd.DataFrame,
) -> tuple[int, int] | None:
    if results.empty:
        return None

    kickoff = pd.to_datetime(call.get("kickoff_at"), utc=True, errors="coerce")
    if pd.isna(kickoff):
        return None

    home = _canonical_team(str(call.get("home_team", "")))
    away = _canonical_team(str(call.get("away_team", "")))
    candidates = results[
        (results["home_team_key"] == home)
        & (results["away_team_key"] == away)
    ].copy()
    if candidates.empty:
        return None

    candidates["kickoff_diff"] = (candidates["kickoff_at"] - kickoff).abs()
    candidates = candidates[
        candidates["kickoff_diff"] <= pd.Timedelta(hours=12)
    ].sort_values("kickoff_diff")
    if candidates.empty:
        return None

    row = candidates.iloc[0]
    return int(row["home_goals"]), int(row["away_goals"])


def _settlement(selection: str, home_goals: int, away_goals: int) -> str:
    if selection == "home":
        won = home_goals > away_goals
    elif selection == "draw":
        won = home_goals == away_goals
    elif selection == "away":
        won = home_goals < away_goals
    else:
        return "VOID"
    return "WON" if won else "LOST"


def settle_public_calls(now: pd.Timestamp | None = None) -> int:
    current = now or pd.Timestamp.now(tz="UTC")
    if current.tzinfo is None:
        current = current.tz_localize("UTC")
    else:
        current = current.tz_convert("UTC")

    reader = SupabaseRESTReader()
    ledger = ResultsLedger()

    calls = pd.DataFrame(ledger.rows())
    if calls.empty:
        return 0
    calls = calls[calls["result_status"] == "OPEN"].copy()
    if calls.empty:
        return 0

    metrics = pd.DataFrame(
        reader._get_all(
            "footy_match_team_metrics",
            "match_id,home_away,goals,retrieved_at",
        )
    )
    if metrics.empty:
        return 0

    metrics["goals"] = pd.to_numeric(metrics["goals"], errors="coerce")
    home = (
        metrics[(metrics["home_away"] == "H") & metrics["goals"].notna()]
        .sort_values("retrieved_at")
        .drop_duplicates("match_id", keep="last")
        [["match_id", "goals"]]
        .rename(columns={"goals": "home_goals"})
    )
    away = (
        metrics[(metrics["home_away"] == "A") & metrics["goals"].notna()]
        .sort_values("retrieved_at")
        .drop_duplicates("match_id", keep="last")
        [["match_id", "goals"]]
        .rename(columns={"goals": "away_goals"})
    )
    results = home.merge(away, on="match_id", how="inner")
    if results.empty:
        return 0

    result_matches = pd.DataFrame(
        reader._get_all(
            "footy_matches",
            "match_id,kickoff_at,home_team,away_team",
        )
    )
    if not result_matches.empty:
        result_matches["kickoff_at"] = pd.to_datetime(
            result_matches["kickoff_at"],
            utc=True,
            errors="coerce",
        )
        results = results.merge(
            result_matches,
            on="match_id",
            how="left",
        )
        results["home_team_key"] = results["home_team"].fillna("").map(_canonical_team)
        results["away_team_key"] = results["away_team"].fillna("").map(_canonical_team)
    else:
        results["kickoff_at"] = pd.NaT
        results["home_team"] = ""
        results["away_team"] = ""
        results["home_team_key"] = ""
        results["away_team_key"] = ""

    result_map = {
        str(row.match_id): (int(row.home_goals), int(row.away_goals))
        for row in results.itertuples(index=False)
    }

    settled = 0
    for row in calls.to_dict(orient="records"):
        match_id = str(row["match_id"])
        result = result_map.get(match_id)
        if result is None:
            result = _identity_result(row, results)
        if result is None:
            continue

        kickoff = pd.to_datetime(row["kickoff_at"], utc=True, errors="coerce")
        if pd.isna(kickoff) or kickoff >= current:
            continue

        home_goals, away_goals = result
        status = _settlement(str(row["selection"]), home_goals, away_goals)

        quoted_odds = row.get("quoted_odds")
        closing_odds = row.get("closing_odds")
        unit_profit = None
        clv = None
        if quoted_odds is not None:
            quoted = float(quoted_odds)
            unit_profit = quoted - 1.0 if status == "WON" else -1.0
            if closing_odds is not None:
                close = float(closing_odds)
                if close > 1:
                    clv = quoted / close - 1.0

        ledger.update(
            str(row["id"]),
            {
                "home_goals": home_goals,
                "away_goals": away_goals,
                "result_status": status,
                "unit_profit": unit_profit,
                "clv": clv,
                "settled_at": current.isoformat(),
            },
        )
        settled += 1

    return settled


def refresh_results_ledger(
    model_version: str = "v7-r16-p50-v20",
) -> ResultsRefresh:
    published = publish_model_calls(model_version=model_version)
    settled = settle_public_calls()
    ledger = ResultsLedger()
    rows = ledger.rows()
    open_calls = sum(1 for row in rows if row.get("result_status") == "OPEN")
    return ResultsRefresh(
        published=published,
        settled=settled,
        open_calls=open_calls,
    )
