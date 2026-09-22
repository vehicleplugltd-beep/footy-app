from footy_data.quality_gate import (
    CORE_REQUIRED_MARKETS,
    CORE_TEN_LEAGUES,
    QualitySnapshot,
    evaluate_quality_gate,
    expansion_decision,
)


def ready_snapshot(league="Championship", market="1X2"):
    return QualitySnapshot(
        league=league,
        market=market,
        model_version="wf-v1",
        sample_size=600,
        data_completeness=0.995,
        model_log_loss=0.93,
        benchmark_log_loss=1.00,
        calibration_error=0.03,
        price_sample_size=180,
        mean_clv=0.012,
        realized_roi=0.04,
        previous_model_log_loss=0.94,
        previous_calibration_error=0.035,
        previous_mean_clv=0.009,
    )


def test_ready_requires_probability_and_price_quality():
    result = evaluate_quality_gate(ready_snapshot())
    assert result.status == "READY"
    assert result.validation_status == "APPROVED"
    assert result.log_loss_ratio < 1.0


def test_missing_price_validation_cannot_authorize_bets():
    snapshot = QualitySnapshot(
        league="Championship",
        market="1X2",
        model_version="wf-v1",
        sample_size=600,
        data_completeness=0.995,
        model_log_loss=0.93,
        benchmark_log_loss=1.00,
        calibration_error=0.03,
        price_sample_size=50,
        mean_clv=None,
    )
    result = evaluate_quality_gate(snapshot)
    assert result.status == "LIMITED"
    assert result.validation_status == "WATCH"


def test_material_probability_regression_blocks_market():
    snapshot = QualitySnapshot(
        league="Championship",
        market="1X2",
        model_version="wf-v2",
        sample_size=600,
        data_completeness=0.995,
        model_log_loss=0.97,
        benchmark_log_loss=1.00,
        calibration_error=0.04,
        price_sample_size=180,
        mean_clv=0.01,
        previous_model_log_loss=0.93,
        previous_calibration_error=0.03,
        previous_mean_clv=0.012,
    )
    result = evaluate_quality_gate(snapshot)
    assert result.status == "BLOCKED"
    assert result.validation_status == "PASS"


def test_league_eleven_is_blocked_until_core_ten_are_ready():
    results = [
        evaluate_quality_gate(ready_snapshot(league, market))
        for league in CORE_TEN_LEAGUES
        for market in CORE_REQUIRED_MARKETS
    ]
    assert expansion_decision(results).allowed is True

    results = [
        r for r in results
        if not (r.league == "Championship" and r.market == "TOTAL_2_5")
    ]
    decision = expansion_decision(results)
    assert decision.allowed is False
    assert any("Championship TOTAL_2_5" in reason for reason in decision.reasons)
