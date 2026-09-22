from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Sequence
import pandas as pd


CUSTOM_LEAGUES = {
    "ENG-Championship": {
        "ClubElo": "ENG_2",
        "MatchHistory": "E1",
        "FBref": "Championship",
        "ESPN": "eng.2",
        "Sofascore": "Championship",
        "season_start": "Aug",
        "season_end": "May",
    },
    "ENG-League One": {
        "ClubElo": "ENG_3",
        "MatchHistory": "E2",
        "FBref": "League One",
        "ESPN": "eng.3",
        "Sofascore": "League One",
        "season_start": "Aug",
        "season_end": "May",
    },
    "ENG-League Two": {
        "ClubElo": "ENG_4",
        "MatchHistory": "E3",
        "FBref": "League Two",
        "ESPN": "eng.4",
        "Sofascore": "League Two",
        "season_start": "Aug",
        "season_end": "May",
    },
    "SCO-Premiership": {
        "ClubElo": "SCO_1",
        "MatchHistory": "SC0",
        "FBref": "Scottish Premiership",
        "ESPN": "sco.1",
        "Sofascore": "Premiership",
        "season_start": "Aug",
        "season_end": "May",
    },
}


@dataclass
class SoccerDataSource:
    leagues: Sequence[str]
    seasons: Sequence[str]

    @staticmethod
    def _ensure_custom_leagues() -> None:
        base = Path(
            os.environ.get("SOCCERDATA_DIR", Path.home() / "soccerdata")
        )
        config_dir = base / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        path = config_dir / "league_dict.json"

        existing: dict = {}
        if path.exists():
            try:
                existing = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                existing = {}

        merged = {**existing, **CUSTOM_LEAGUES}
        if merged != existing:
            path.write_text(
                json.dumps(merged, indent=2, sort_keys=True),
                encoding="utf-8",
            )

    def _sd(self):
        self._ensure_custom_leagues()
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

    def fbref_team_match_stats(
        self,
        stat_type: str = "schedule",
        opponent_stats: bool = False,
    ) -> pd.DataFrame:
        return self._frame(
            self.fbref().read_team_match_stats(
                stat_type=stat_type,
                opponent_stats=opponent_stats,
            )
        )

    def football_data_matches(self) -> pd.DataFrame:
        return self._frame(self.match_history().read_games())

    def elo_by_date(self, date: str | None = None) -> pd.DataFrame:
        return self._frame(self.clubelo().read_by_date(date))
