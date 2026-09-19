import pandas as pd

from footy_data.backtest import calibration_table, closing_line_value, summarize_binary_bets


def test_backtest_summary_and_calibration():
    frame = pd.DataFrame({
        "model_probability": [0.60, 0.55, 0.70, 0.40],
        "won": [1, 0, 1, 0],
        "decimal_odds": [2.00, 2.10, 1.70, 2.60],
    })
    summary = summarize_binary_bets(frame)
    assert summary.bets == 4
    assert summary.strike_rate == 0.5
    assert summary.brier_score > 0
    assert summary.log_loss > 0

    table = calibration_table(
        frame["model_probability"],
        frame["won"],
        bins=5,
    )
    assert table["bets"].sum() == 4


def test_clv():
    clv = closing_line_value(
        pd.Series([2.20, 1.80]),
        pd.Series([2.00, 1.90]),
    )
    assert round(float(clv.iloc[0]), 3) == 0.1
    assert float(clv.iloc[1]) < 0
