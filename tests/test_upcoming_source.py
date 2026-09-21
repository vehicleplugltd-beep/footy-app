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



class _StoredReader:
    def upcoming_matches(
        self,
        league: str,
        season=None,
        horizon_days=None,
        now=None,
    ):
        assert league == "GER-Bundesliga"
        assert season is None
        assert horizon_days == 10
        return pd.DataFrame([
            {
                "match_id": "flashscore:abc123",
                "league": "GER-Bundesliga",
                "season": "2627",
                "kickoff_at": "2026-09-25T18:30:00Z",
                "home_team": "Bayern Munich",
                "away_team": "Borussia Dortmund",
                "status": "scheduled",
                "source": "flashscore-feed",
                "retrieved_at": "2026-09-21T22:00:00Z",
            }
        ])


def test_stored_upcoming_fixtures_preserve_provider_fixture_identity():
    fixtures = cli._stored_upcoming_fixtures(
        _StoredReader(),
        league="GER-Bundesliga",
        horizon_days=10,
    )

    assert len(fixtures) == 1
    assert fixtures.iloc[0]["match_id"] == "flashscore:abc123"
    assert fixtures.iloc[0]["season"] == "2627"
    assert fixtures.iloc[0]["source"] == "flashscore-feed"
    assert fixtures.iloc[0]["match_date"] == pd.Timestamp(
        "2026-09-25T18:30:00Z"
    )


def test_stored_upcoming_fixture_discovery_does_not_require_provider_season():
    class Reader:
        def upcoming_matches(
            self,
            league: str,
            season=None,
            horizon_days=None,
            now=None,
        ):
            assert season is None
            return pd.DataFrame([
                {
                    "match_id": "fixture-1",
                    "league": league,
                    "season": "2627",
                    "kickoff_at": "2026-09-25T18:30:00Z",
                    "home_team": "Team A",
                    "away_team": "Team B",
                    "status": "scheduled",
                    "source": "espn-scoreboard",
                    "retrieved_at": "2026-09-21T22:00:00Z",
                }
            ])

    fixtures = cli._stored_upcoming_fixtures(
        Reader(),
        league="ESP-La Liga",
        horizon_days=10,
    )

    assert len(fixtures) == 1
    assert fixtures.iloc[0]["season"] == "2627"
