import pytest

from footy_data.validation import ModelMarketValidation, gate_verdict


def test_only_approved_market_can_return_bet():
    assert gate_verdict("BET", "APPROVED") == "BET"
    assert gate_verdict("BET", "WATCH") == "WATCH"
    assert gate_verdict("BET", "RESEARCH") == "WATCH"
    assert gate_verdict("BET", "PASS") == "PASS"


def test_unvalidated_fade_is_not_promoted():
    assert gate_verdict("FADE", "WATCH") == "PASS"
    assert gate_verdict("FADE", "RESEARCH") == "PASS"


def test_validation_record_checks_status():
    with pytest.raises(ValueError):
        ModelMarketValidation(
            model_version="m",
            market="1X2",
            status="UNKNOWN",
            sample_size=10,
        )
