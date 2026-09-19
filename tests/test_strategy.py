from footy_data.strategy import StrategyRule


def _rule(status="APPROVED"):
    return StrategyRule(
        strategy_id="home-edge-v1",
        model_version="baseline-v1",
        market="1X2",
        selection="home",
        status=status,
        min_probability_edge=0.06,
        min_model_probability=0.30,
        max_decimal_odds=4.0,
        min_raw_ev=0.10,
    )


def test_strategy_requires_approved_status():
    assert not _rule("WATCH").qualifies(
        selection="home",
        model_probability=0.50,
        decimal_odds=2.5,
        raw_ev=0.25,
        probability_edge=0.10,
    )


def test_strategy_applies_frozen_thresholds():
    rule = _rule()
    assert rule.qualifies(
        selection="home",
        model_probability=0.50,
        decimal_odds=2.5,
        raw_ev=0.25,
        probability_edge=0.10,
    )
    assert not rule.qualifies(
        selection="home",
        model_probability=0.50,
        decimal_odds=4.2,
        raw_ev=1.10,
        probability_edge=0.20,
    )
