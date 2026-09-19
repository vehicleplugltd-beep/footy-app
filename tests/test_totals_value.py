import pandas as pd

from footy_data.odds_import import normalise_total_2_5_prices
from footy_data.value_backtest import (
    assess_total_2_5_history,
    devig_two_way,
    summarize_qualified_total_2_5,
)


def test_total_price_normalizer_reconciles_match_and_line():
    external = pd.DataFrame([{
        "date": "2026-09-19",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "B365C>2.5": 1.90,
        "B365C<2.5": 2.00,
    }])
    footy = pd.DataFrame([
        {
            "match_id": "m1",
            "match_date": "2026-09-19T15:00:00Z",
            "team": "Arsenal",
            "home_away": "H",
        },
        {
            "match_id": "m1",
            "match_date": "2026-09-19T15:00:00Z",
            "team": "Chelsea",
            "home_away": "A",
        },
    ])

    prices, report = normalise_total_2_5_prices(
        external=external,
        footy_metrics=footy,
        bookmaker="Bet365",
        source="football-data.co.uk",
        price_kind="close",
        date_col="date",
        home_team_col="home_team",
        away_team_col="away_team",
        over_odds_col="B365C>2.5",
        under_odds_col="B365C<2.5",
    )

    assert report.match_rate == 1.0
    assert len(prices) == 2
    assert set(prices["selection"]) == {"over", "under"}
    assert set(prices["market"]) == {"TOTAL_2.5"}
    assert set(prices["line"]) == {2.5}
    assert prices["price_key"].nunique() == 2


def test_two_way_devig_sums_to_one():
    market = devig_two_way(1.90, 2.00)
    assert abs(market.first + market.second - 1.0) < 1e-12
    assert market.overround > 0


def test_total_value_summary_settles_one_selection_per_match():
    predictions = pd.DataFrame([{
        "match_id": "m1",
        "over_2_5_probability": 0.60,
        "uncertainty_haircut": 0.0,
    }])
    prices = pd.DataFrame([
        {"match_id": "m1", "selection": "over", "decimal_odds": 2.00},
        {"match_id": "m1", "selection": "under", "decimal_odds": 2.00},
    ])
    assessed = assess_total_2_5_history(
        predictions,
        prices,
        target_ev=0.0,
    )
    outcomes = pd.DataFrame([{
        "match_id": "m1",
        "home_goals": 2,
        "away_goals": 1,
    }])
    summary, bets = summarize_qualified_total_2_5(assessed, outcomes)

    assert summary["bets"] == 1
    assert len(bets) == 1
    assert bets.iloc[0]["selection"] == "over"
    assert summary["roi"] == 1.0
