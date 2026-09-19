from footy_data.xg_engine import TeamProcess, estimate_match_xg

def test_home_advantage_applies():
    home = TeamProcess(attack_xg=1.4, defence_xga=1.2, matches=20, elo=1550)
    away = TeamProcess(attack_xg=1.4, defence_xga=1.2, matches=20, elo=1500)
    est = estimate_match_xg(home, away)
    assert est.expected_goals.home > est.expected_goals.away

def test_small_sample_has_more_uncertainty():
    a = estimate_match_xg(TeamProcess(1.4, 1.2, 4), TeamProcess(1.3, 1.3, 4))
    b = estimate_match_xg(TeamProcess(1.4, 1.2, 25), TeamProcess(1.3, 1.3, 25))
    assert a.uncertainty_haircut > b.uncertainty_haircut
