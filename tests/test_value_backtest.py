import pandas as pd

from footy_data.value_backtest import devig_1x2, assess_1x2_history


def test_devig_probabilities_sum_to_one():
    p = devig_1x2(2.0, 3.5, 4.0)
    assert abs(p.home + p.draw + p.away - 1.0) < 1e-12
    assert p.overround > 0


def test_history_assessment_builds_three_selections():
    predictions = pd.DataFrame([{
        "match_id": "m1",
        "home_win_probability": 0.55,
        "draw_probability": 0.25,
        "away_win_probability": 0.20,
        "uncertainty_haircut": 0.04,
    }])
    prices = pd.DataFrame([
        {"match_id": "m1", "selection": "home", "decimal_odds": 2.00},
        {"match_id": "m1", "selection": "draw", "decimal_odds": 3.60},
        {"match_id": "m1", "selection": "away", "decimal_odds": 4.20},
    ])
    out = assess_1x2_history(predictions, prices)
    assert len(out) == 3
    assert set(out["selection"]) == {"home", "draw", "away"}
