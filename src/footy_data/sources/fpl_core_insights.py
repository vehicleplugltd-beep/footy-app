from __future__ import annotations

from io import StringIO
import pandas as pd
import requests


class FPLCoreInsightsSource:
    """
    Verification-first reader for the public FPL-Core-Insights CSV repository.

    The source is treated as enrichment, not as an authority replacing
    Official FPL or Footy's designated xG provider.
    """

    BASE = (
        "https://raw.githubusercontent.com/"
        "olbauday/FPL-Core-Insights/main/data/2026-2027/By%20Gameweek"
    )

    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    def _csv(self, gameweek: int, filename: str) -> pd.DataFrame:
        url = f"{self.BASE}/GW{int(gameweek)}/{filename}"
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        return pd.read_csv(StringIO(response.text))

    def matches(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "matches.csv")

    def teams(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "teams.csv")

    def player_match_stats(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "playermatchstats.csv")

    def player_gameweek_stats(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "player_gameweek_stats.csv")
