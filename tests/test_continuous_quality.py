import pandas as pd
import pytest

from footy_data.quality_evaluation import (
    benchmark_1x2_log_loss,
    benchmark_total_2_5_log_loss,
    expected_calibration_error,
    multiclass_expected_calibration_error,
    qualified_clv,
)
from footy_data.quality_gate import (
    CORE_REQUIRED_MARKETS,
    CORE_TEN_LEAGUES,
    QualitySnapshot,
    evaluate_quality_gate,
    expansion_decision,
    quality_snapshot_record,
)
from footy_data.storage import SupabaseRESTReader, SupabaseRESTWriter


def _ready_snapshot(league="ENG-Championship", market="1X2"):
    return QualitySnapshot(
        league=league,
        market=market,
        model_version="champion-v1",
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


def test_ready_gate_requires_probability_and_price_quality():
    result = evaluate_quality_gate(_ready_snapshot())
    assert result.status == "READY"
    assert result.validation_status == "APPROVED"
    assert result.log_loss_ratio < 1.0


def test_material_probability_regression_blocks_market():
    snapshot = QualitySnapshot(
        league="ENG-Championship",
        market="1X2",
        model_version="challenger-v2",
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


def test_league_eleven_is_locked_until_core_ten_are_ready():
    results = [
        evaluate_quality_gate(_ready_snapshot(league, market))
        for league in CORE_TEN_LEAGUES
        for market in CORE_REQUIRED_MARKETS
    ]
    assert expansion_decision(results).allowed is True

    results = [
        row for row in results
        if not (
            row.league == "ENG-Championship"
            and row.market == "TOTAL_2.5"
        )
    ]
    decision = expansion_decision(results)
    assert decision.allowed is False
    assert any(
        "ENG-Championship TOTAL_2.5" in reason
        for reason in decision.reasons
    )


def test_quality_snapshot_record_is_storage_ready():
    snapshot = _ready_snapshot()
    result = evaluate_quality_gate(snapshot)
    record = quality_snapshot_record(snapshot, result)
    assert record["gate_status"] == "READY"
    assert record["validation_status"] == "APPROVED"
    assert record["policy"]["min_model_sample"] == 250


def test_expected_calibration_error_uses_weighted_bins():
    probability = pd.Series([0.1, 0.1, 0.9, 0.9])
    outcome = pd.Series([0, 0, 1, 1])
    assert expected_calibration_error(
        probability,
        outcome,
        bins=2,
    ) == pytest.approx(0.1)


def test_multiclass_calibration_error_is_finite():
    probabilities = pd.DataFrame({
        "home": [0.7, 0.2, 0.2],
        "draw": [0.2, 0.6, 0.2],
        "away": [0.1, 0.2, 0.6],
    })
    actual = pd.Series(["home", "draw", "away"])
    value = multiclass_expected_calibration_error(
        probabilities,
        actual,
    )
    assert 0 <= value <= 1


def test_close_market_benchmarks_are_devigged():
    outcomes = pd.DataFrame([
        {"match_id": "m1", "home_goals": 2, "away_goals": 0},
        {"match_id": "m2", "home_goals": 1, "away_goals": 1},
    ])
    prices_1x2 = pd.DataFrame([
        {"match_id": "m1", "selection": "home", "decimal_odds": 2.0},
        {"match_id": "m1", "selection": "draw", "decimal_odds": 3.5},
        {"match_id": "m1", "selection": "away", "decimal_odds": 4.0},
        {"match_id": "m2", "selection": "home", "decimal_odds": 2.4},
        {"match_id": "m2", "selection": "draw", "decimal_odds": 3.0},
        {"match_id": "m2", "selection": "away", "decimal_odds": 3.1},
    ])
    prices_total = pd.DataFrame([
        {"match_id": "m1", "selection": "over", "decimal_odds": 1.9},
        {"match_id": "m1", "selection": "under", "decimal_odds": 1.9},
        {"match_id": "m2", "selection": "over", "decimal_odds": 2.0},
        {"match_id": "m2", "selection": "under", "decimal_odds": 1.8},
    ])
    assert benchmark_1x2_log_loss(prices_1x2, outcomes) > 0
    assert benchmark_total_2_5_log_loss(prices_total, outcomes) > 0


def test_qualified_clv_keeps_one_best_edge_per_match():
    assessed = pd.DataFrame([
        {
            "match_id": "m1", "selection": "home",
            "decimal_odds": 2.20, "raw_ev": 0.12, "qualifies": True,
        },
        {
            "match_id": "m1", "selection": "draw",
            "decimal_odds": 3.50, "raw_ev": 0.08, "qualifies": True,
        },
        {
            "match_id": "m2", "selection": "away",
            "decimal_odds": 2.00, "raw_ev": 0.04, "qualifies": False,
        },
    ])
    close = pd.DataFrame([
        {"match_id": "m1", "selection": "home", "decimal_odds": 2.00},
        {"match_id": "m1", "selection": "draw", "decimal_odds": 3.60},
        {"match_id": "m2", "selection": "away", "decimal_odds": 1.95},
    ])
    n, mean_clv = qualified_clv(assessed, close)
    assert n == 1
    assert mean_clv == pytest.approx(0.10)


def test_writer_persists_quality_snapshot(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

    def fake_post(url, headers=None, json=None, timeout=None, **kwargs):
        captured.update({
            "url": url,
            "headers": headers,
            "json": json,
            "timeout": timeout,
        })
        return Response()

    monkeypatch.setattr("footy_data.storage.requests.post", fake_post)
    writer = SupabaseRESTWriter(
        url="https://example.supabase.co",
        service_role_key="secret",
    )
    writer.insert_model_quality_snapshots([{
        "league": "ENG-Championship",
        "market": "1X2",
        "model_version": "champion-v1",
        "sample_size": 500,
        "data_completeness": 0.99,
        "model_log_loss": 0.94,
        "benchmark_log_loss": 1.0,
        "calibration_error": 0.04,
        "price_sample_size": 120,
        "mean_clv": 0.01,
        "gate_status": "READY",
        "validation_status": "APPROVED",
        "reasons": ["all READY quality gates passed"],
        "policy": {"min_model_sample": 250},
        "ignored": "not persisted",
    }])
    assert captured["url"].endswith(
        "/rest/v1/footy_model_quality_snapshots"
    )
    assert captured["json"][0]["league"] == "ENG-Championship"
    assert "ignored" not in captured["json"][0]


def test_reader_orders_quality_history_newest_first(monkeypatch):
    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )

    def fake_get(table, select="*", filters=None):
        assert table == "footy_model_quality_snapshots"
        assert filters == {
            "league": "eq.ENG-Championship",
            "market": "eq.1X2",
        }
        return [
            {
                "id": 1,
                "league": "ENG-Championship",
                "market": "1X2",
                "model_version": "old",
                "evaluated_at": "2026-09-20T10:00:00Z",
            },
            {
                "id": 2,
                "league": "ENG-Championship",
                "market": "1X2",
                "model_version": "new",
                "evaluated_at": "2026-09-21T10:00:00Z",
            },
        ]

    monkeypatch.setattr(reader, "_get_all_filtered", fake_get)
    frame = reader.model_quality_snapshots(
        league="ENG-Championship",
        market="1X2",
    )
    assert frame.iloc[0]["model_version"] == "new"
