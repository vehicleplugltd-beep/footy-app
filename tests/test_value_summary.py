import pandas as pd
import pytest

from footy_data.value_backtest import summarize_qualified_1x2


def test_value_summary_keeps_one_qualifying_selection_per_match():
    assessed = pd.DataFrame([
        {
            "match_id": "m1",
            "selection": "home",
            "decimal_odds": 2.2,
            "raw_ev": 0.10,
            "probability_edge": 0.04,
            "qualifies": True,
            "market_overround": 0.05,
        },
        {
            "match_id": "m1",
            "selection": "draw",
            "decimal_odds": 4.0,
            "raw_ev": 0.05,
            "probability_edge": 0.02,
            "qualifies": True,
            "market_overround": 0.05,
        },
    ])
    outcomes = pd.DataFrame([{
        "match_id": "m1",
        "home_goals": 2,
        "away_goals": 0,
    }])

    summary, bets = summarize_qualified_1x2(assessed, outcomes)
    assert summary["bets"] == 1
    assert len(bets) == 1
    assert bets.iloc[0]["selection"] == "home"
    assert summary["roi"] == pytest.approx(1.2)
