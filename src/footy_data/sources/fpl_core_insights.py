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

    ROOT = (
        "https://raw.githubusercontent.com/"
        "olbauday/FPL-Core-Insights/main/data"
    )

    def __init__(
        self,
        timeout: int = 30,
        season_folder: str = "2026-2027",
    ):
        self.timeout = timeout
        self.season_folder = season_folder.strip("/")

    @property
    def base(self) -> str:
        return f"{self.ROOT}/{self.season_folder}/By%20Gameweek"

    def _read(self, url: str) -> pd.DataFrame:
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        return pd.read_csv(StringIO(response.text))

    def _csv(self, gameweek: int, filename: str) -> pd.DataFrame:
        return self._read(
            f"{self.base}/GW{int(gameweek)}/{filename}"
        )

    def _season_csv(self, filename: str) -> pd.DataFrame:
        return self._read(
            f"{self.ROOT}/{self.season_folder}/{filename}"
        )

    def matches(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "matches.csv")

    def teams(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "teams.csv")

    def players(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "players.csv")

    def player_match_stats(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "playermatchstats.csv")

    def player_gameweek_stats(self, gameweek: int) -> pd.DataFrame:
        return self._csv(gameweek, "player_gameweek_stats.csv")

    def season_players(self) -> pd.DataFrame:
        return self._season_csv("players.csv")

    def season_teams(self) -> pd.DataFrame:
        return self._season_csv("teams.csv")

    def season_player_stats(self) -> pd.DataFrame:
        return self._season_csv("playerstats.csv")
