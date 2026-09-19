from footy_data.markets import asian_handicap, asian_total, team_total
from footy_data.model import ExpectedGoals

def test_dnb_has_push_probability():
    w = asian_handicap(ExpectedGoals(1.4, 1.0), "home", 0.0)
    assert w.push_weight > 0
    assert abs(w.win_weight + w.loss_weight + w.push_weight - 1) < 1e-8

def test_quarter_handicap_weights_sum_to_one():
    w = asian_handicap(ExpectedGoals(1.4, 1.0), "home", -0.25)
    assert abs(w.win_weight + w.loss_weight + w.push_weight - 1) < 1e-8

def test_total_quarter_line():
    w = asian_total(ExpectedGoals(1.4, 1.0), "over", 2.25)
    assert w.fair_odds > 1.0

def test_team_total():
    w = team_total(ExpectedGoals(1.7, 0.8), "home", "over", 1.5)
    assert 1.0 < w.fair_odds < 10.0
