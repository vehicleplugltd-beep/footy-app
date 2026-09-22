from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

import requests


FOTMOB_LEAGUES = {
    "ENG-Championship": 48,
}

BASE_URLS = (
    "https://www.fotmob.com/api/data",
    "https://www.fotmob.com/api",
)


@dataclass
class FotMobSource:
    timeout: int = 25
    country_code: str = "GBR"

    def _get(
        self,
        path: str,
        params: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Accept": "application/json,text/plain,*/*",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/140 Safari/537.36"
            ),
            "Referer": "https://www.fotmob.com/",
        }
        errors: list[str] = []

        for base in BASE_URLS:
            response = requests.get(
                f"{base}/{path.lstrip('/')}",
                params=dict(params or {}),
                headers=headers,
                timeout=self.timeout,
            )
            if response.ok:
                payload = response.json()
                if isinstance(payload, dict):
                    return payload
                raise RuntimeError(
                    f"FotMob returned non-object JSON for {path}"
                )
            errors.append(
                f"{response.status_code} {response.url}: "
                f"{response.text[:180]}"
            )

        raise RuntimeError(
            f"FotMob request failed for {path}: {' | '.join(errors)}"
        )

    def league_id(self, league: str) -> int:
        try:
            return FOTMOB_LEAGUES[league]
        except KeyError as exc:
            raise ValueError(
                f"No verified FotMob league id configured for {league}"
            ) from exc

    def league(
        self,
        league: str,
        season: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "id": self.league_id(league),
            "ccode3": self.country_code,
        }
        if season:
            params["season"] = season
        return self._get("leagues", params)

    def matches(
        self,
        league: str,
        season: str | None = None,
    ) -> list[dict[str, Any]]:
        payload = self.league(league, season)
        candidates = (
            payload.get("matches", {}).get("allMatches"),
            payload.get("matches", {}).get("matches"),
            payload.get("fixtures", {}).get("allMatches"),
            payload.get("fixtures", {}).get("matches"),
        )
        for value in candidates:
            if isinstance(value, list):
                return [
                    row
                    for row in value
                    if isinstance(row, dict)
                ]
        return []

    def match_details(self, match_id: str | int) -> dict[str, Any]:
        return self._get(
            "matchDetails",
            {"matchId": str(match_id)},
        )
