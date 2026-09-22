import pandas as pd
import pytest

from footy_data.quality_evaluation import (
    benchmark_1x2_log_loss,
    benchmark_total_2_5_log_loss,
    expected_calibration_error,
    multiclass_expected_calibration_error,
    qualified_clv,
)


def test_expected_calibration_error_is_zero_for_perfect_bins():
    probability = pd.Series([0.1, 0.1, 0.9, 0.9])
    outcome = pd.Series([0, 0, 1, 1])
    assert expected_calibration_error(probability, outcome, bins=2) == pytest.approx(0.1)


def test_multiclass_calibration_error_is_finite():
    probabilities = pd.DataFrame({
        "home": [0.7, 0.2, 0.2],
        "draw": [0.2, 0.6, 0.2],
        "away": [0.1, 0.2, 0.6],
    })
    actual = pd.Series(["home", "draw", "away"])
    value = multiclass_expected_calibration_error(probabilities, actual)
    assert 0 <= value <= 1


def test_market_benchmarks_use_devigged_close_prices():
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


def test_qualified_clv_keeps_best_edge_per_match():
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
