import pandas as pd

from footy_data.odds_import import normalise_1x2_prices


def test_odds_import_matches_aliases_and_builds_three_prices():
    external = pd.DataFrame([{
        "Date": "10/01/2026",
        "HomeTeam": "Man United",
        "AwayTeam": "Tottenham",
        "B365H": 2.10,
        "B365D": 3.50,
        "B365A": 3.40,
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

    prices, report = normalise_1x2_prices(
        external,
        footy,
        bookmaker="Bet365",
        source="licensed-test",
        price_kind="close",
    )

    assert report.matched_matches == 1
    assert report.match_rate == 1.0
    assert len(prices) == 3
    assert set(prices["selection"]) == {"home", "draw", "away"}
    assert prices["price_key"].nunique() == 3
