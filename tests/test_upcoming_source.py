import pandas as pd

import footy_data.cli as cli


class _OfficialSchedule:
    def schedule(self, season: str, league: str):
        return pd.DataFrame([
            {
                "league": league,
                "season": season,
                "game": "fpl-101",
                "date": "2026-09-26T14:00:00Z",
                "home_team": "Arsenal",
                "away_team": "Chelsea",
                "is_result": False,
            }
        ])


class _EmptyOfficialSchedule:
    def schedule(self, season: str, league: str):
        return pd.DataFrame()


class _UnderstatSchedule:
    def __init__(self, leagues, seasons):
        self.leagues = leagues
        self.seasons = seasons

    def understat_schedule(self):
        return pd.DataFrame([
            {
                "league": self.leagues[0],
                "season": self.seasons[0],
                "game": "understat-101",
                "date": "2026-09-26T14:00:00Z",
                "home_team": "Arsenal",
                "away_team": "Chelsea",
            }
        ])


def test_upcoming_schedule_prefers_official_fpl_for_premier_league(monkeypatch):
    monkeypatch.setattr(cli, "OfficialFPLSource", _OfficialSchedule)

    class _ShouldNotRun:
        def __init__(self, *args, **kwargs):
            raise AssertionError("Understat fallback should not be used")

    monkeypatch.setattr(cli, "SoccerDataSource", _ShouldNotRun)

    schedule, source = cli._load_upcoming_schedule(
        "ENG-Premier League",
        "2026",
    )

    assert source == "official-fpl"
    assert schedule.iloc[0]["game"] == "fpl-101"


def test_upcoming_schedule_falls_back_to_understat(monkeypatch):
    monkeypatch.setattr(cli, "OfficialFPLSource", _EmptyOfficialSchedule)
    monkeypatch.setattr(cli, "SoccerDataSource", _UnderstatSchedule)

    schedule, source = cli._load_upcoming_schedule(
        "ENG-Premier League",
        "2026",
    )

    assert source == "understat"
    assert schedule.iloc[0]["game"] == "understat-101"
