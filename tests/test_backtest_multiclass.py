import pandas as pd

from footy_data.backtest import multiclass_log_loss


def test_multiclass_log_loss_prefers_correct_confident_predictions():
    actual = pd.Series(["home", "draw", "away"])

    good = pd.DataFrame({
        "home": [0.80, 0.10, 0.10],
        "draw": [0.10, 0.80, 0.10],
        "away": [0.10, 0.10, 0.80],
    })
    bad = pd.DataFrame({
        "home": [0.10, 0.45, 0.45],
        "draw": [0.45, 0.10, 0.45],
        "away": [0.45, 0.45, 0.10],
    })

    assert multiclass_log_loss(good, actual) < multiclass_log_loss(bad, actual)
