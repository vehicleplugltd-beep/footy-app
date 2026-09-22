from footy_data.quality_gate import QualitySnapshot
from footy_data.scanner import MarketAssessment, apply_quality_snapshot


def assessment():
    return MarketAssessment(
        market="1X2",
        selection="home",
        current_odds=2.20,
        fair_odds=1.95,
        minimum_take_price=2.10,
        expected_value=0.12,
        verdict="BET",
        raw_verdict="BET",
    )


def test_ready_quality_preserves_raw_bet():
    snapshot = QualitySnapshot(
        league="Championship",
        market="1X2",
        model_version="wf-v1",
        sample_size=600,
        data_completeness=0.995,
        model_log_loss=0.93,
        benchmark_log_loss=1.00,
        calibration_error=0.03,
        price_sample_size=180,
        mean_clv=0.012,
    )
    gated = apply_quality_snapshot(assessment(), snapshot)
    assert gated.verdict == "BET"
    assert gated.validation_status == "APPROVED"


def test_limited_quality_demotes_raw_bet_to_watch():
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
    gated = apply_quality_snapshot(assessment(), snapshot)
    assert gated.verdict == "WATCH"
    assert gated.validation_status == "WATCH"


def test_blocked_quality_forces_pass():
    snapshot = QualitySnapshot(
        league="Championship",
        market="1X2",
        model_version="wf-v2",
        sample_size=600,
        data_completeness=0.90,
        model_log_loss=1.08,
        benchmark_log_loss=1.00,
        calibration_error=0.12,
        price_sample_size=180,
        mean_clv=-0.04,
    )
    gated = apply_quality_snapshot(assessment(), snapshot)
    assert gated.verdict == "PASS"
    assert gated.validation_status == "PASS"
