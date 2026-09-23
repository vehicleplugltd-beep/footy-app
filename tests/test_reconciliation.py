import pandas as pd

from footy_data.reconciliation import canonical_team_name, reconcile_fixture_id


def test_canonical_team_name_handles_common_suffixes_and_punctuation():
    assert canonical_team_name("Hull City AFC") == "hullcity"
    assert canonical_team_name("Córdoba CF") == "cordoba"


def test_reconcile_fixture_id_matches_same_teams_with_time_tolerance():
    existing = pd.DataFrame([
        {
            "match_id": "flashscore:abc",
            "kickoff_at": "2026-08-15T19:45:00Z",
            "home_team": "Hull City",
            "away_team": "Southampton FC",
        }
    ])
    result = reconcile_fixture_id(
        "Hull City AFC",
        "Southampton",
        "2026-08-15T19:46:00Z",
        existing,
    )
    assert result == "flashscore:abc"


def test_reconcile_fixture_id_rejects_ambiguous_or_wrong_fixture():
    existing = pd.DataFrame([
        {
            "match_id": "one",
            "kickoff_at": "2026-08-15T19:45:00Z",
            "home_team": "Hull City",
            "away_team": "Southampton",
        },
        {
            "match_id": "two",
            "kickoff_at": "2026-08-15T19:45:00Z",
            "home_team": "Hull City",
            "away_team": "Southampton",
        },
    ])
    assert reconcile_fixture_id(
        "Hull City",
        "Southampton",
        "2026-08-15T19:45:00Z",
        existing,
    ) is None
