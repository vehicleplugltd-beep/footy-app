from footy_data.model import ExpectedGoals, calibrate_expected_goals


def test_expected_goals_calibration_is_explicit_and_monotonic():
    base = ExpectedGoals(home=2.0, away=1.0)
    calibrated = calibrate_expected_goals(
        base,
        beta=1.05,
        home_scale=0.98,
        away_scale=1.12,
    )
    assert calibrated.home > 0
    assert calibrated.away > 0
    assert calibrated.home > calibrated.away
