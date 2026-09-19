import pandas as pd

from footy_data.normalizers.football_data_odds import normalise_football_data_odds


def test_odds_normalizer_keeps_books_separate_and_skips_missing():
    games = pd.DataFrame([{
        "game": "2026-09-19_A_B",
        "date": "2026-09-19 15:00:00",
        "home_team": "A",
        "away_team": "B",
        "AvgH": 2.10,
        "AvgD": 3.40,
        "AvgA": 3.60,
        "B365H": 2.05,
        "B365D": 3.50,
        "B365A": 3.70,
        "Avg>2.5": 1.90,
        "Avg<2.5": 1.95,
    }])

    out = normalise_football_data_odds(games)

    assert set(out["bookmaker"]) == {"Market Average", "Bet365"}
    assert len(out[out["market"] == "1X2"]) == 6
    assert len(out[out["market"] == "TOTAL_2.5"]) == 2
    assert not (out["bookmaker"] == "William Hill").any()
