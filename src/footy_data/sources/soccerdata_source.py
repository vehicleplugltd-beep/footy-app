from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence
import pandas as pd


@dataclass
class SoccerDataSource:
    leagues: Sequence[str]
    seasons: Sequence[str]

    def _sd(self):
        try:
            import soccerdata as sd
        except ImportError as exc:
            raise RuntimeError(
                "soccerdata is not installed. Run pip install -e ."
            ) from exc
        return sd

    def understat(self):
        sd = self._sd()
        return sd.Understat(leagues=list(self.leagues), seasons=list(self.seasons))

    def sofascore(self):
        sd = self._sd()
        return sd.Sofascore(leagues=list(self.leagues), seasons=list(self.seasons))

    def fbref(self):
        sd = self._sd()
        return sd.FBref(leagues=list(self.leagues), seasons=list(self.seasons))

    def clubelo(self):
        sd = self._sd()
        return sd.ClubElo()

    def match_history(self):
        sd = self._sd()
        return sd.MatchHistory(leagues=list(self.leagues), seasons=list(self.seasons))

    @staticmethod
    def _frame(result) -> pd.DataFrame:
        if not isinstance(result, pd.DataFrame):
            result = pd.DataFrame(result)
        return result.reset_index()

    def understat_schedule(self) -> pd.DataFrame:
        return self._frame(self.understat().read_schedule())

    def understat_shots(self) -> pd.DataFrame:
        return self._frame(self.understat().read_shot_events())

    def understat_team_match_stats(self) -> pd.DataFrame:
        return self._frame(self.understat().read_team_match_stats())

    def sofascore_schedule(self) -> pd.DataFrame:
        return self._frame(self.sofascore().read_schedule())

    def fbref_schedule(self) -> pd.DataFrame:
        return self._frame(self.fbref().read_schedule())

    def football_data_matches(self) -> pd.DataFrame:
        return self._frame(self.match_history().read_games())

    def elo_by_date(self, date: str | None = None) -> pd.DataFrame:
        return self._frame(self.clubelo().read_by_date(date))
