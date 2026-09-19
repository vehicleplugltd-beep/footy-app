import pandas as pd

from footy_data.external_elo import ratings_from_match_dataset


def test_external_elo_reconciles_common_aliases():
    external = pd.DataFrame([{
        "Division": "E0",
        "MatchDate": "2026-01-10",
        "HomeTeam": "Man United",
        "AwayTeam": "Tottenham",
        "HomeElo": 1600,
        "AwayElo": 1550,
    }])
    footy = pd.DataFrame([
        {
            "match_id": "m1",
            "match_date": "2026-01-10T15:00:00Z",
            "team": "Manchester United",
            "home_away": "H",
        },
        {
            "match_id": "m1",
            "match_date": "2026-01-10T15:00:00Z",
            "team": "Tottenham Hotspur",
            "home_away": "A",
        },
    ])

    ratings, report = ratings_from_match_dataset(external, footy)
    assert report["matched_matches"] == 1
    assert len(ratings) == 2
    assert set(ratings["rating_value"]) == {1600, 1550}
