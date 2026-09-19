from footy_data.model import ExpectedGoals, fair_odds, market_probabilities, minimum_take_price

def test_probabilities_are_sensible():
    p = market_probabilities(ExpectedGoals(1.5, 1.0))
    assert 0 < p["home_win"] < 1
    assert 0 < p["draw"] < 1
    assert 0 < p["away_win"] < 1
    assert abs(p["home_win"] + p["draw"] + p["away_win"] - 1) < 1e-9

def test_fair_odds():
    assert fair_odds(0.5) == 2.0

def test_min_take_exceeds_raw_fair_with_haircut():
    raw = fair_odds(0.60)
    take = minimum_take_price(0.60, uncertainty_haircut=0.05, target_ev=0.02)
    assert take > raw
