import pandas as pd

from footy_data.sources.official_fpl import (
    canonical_team_name,
    normalise_official_fpl_schedule,
)


def test_official_fpl_schedule_normalises_to_upcoming_contract():
    teams = [
        {"id": 1, "name": "Man City"},
        {"id": 2, "name": "Nott'm Forest"},
    ]
    fixtures = [
        {
            "id": 99,
            "kickoff_time": "2026-09-26T14:00:00Z",
            "team_h": 1,
            "team_a": 2,
            "finished": False,
        }
    ]

    frame = normalise_official_fpl_schedule(
        fixtures,
        teams,
        season="2026",
    )

    assert list(frame.columns) == [
        "league",
        "season",
        "game",
        "date",
        "home_team",
        "away_team",
        "is_result",
    ]
    assert len(frame) == 1
    assert frame.iloc[0]["game"] == "fpl-99"
    assert frame.iloc[0]["home_team"] == "Manchester City"
    assert frame.iloc[0]["away_team"] == "Nottingham Forest"
    assert frame.iloc[0]["is_result"] == False


def test_official_fpl_team_aliases_match_process_names():
    assert canonical_team_name("Man Utd") == "Manchester United"
    assert canonical_team_name("Spurs") == "Tottenham"
    assert canonical_team_name("Wolves") == "Wolverhampton Wanderers"
