import pandas as pd

from footy_data.upcoming import model_output_records


def test_forward_model_outputs_publish_1x2_totals_and_btts():
    predictions = pd.DataFrame([
        {
            "match_id": "match-1",
            "model_version": "v-test",
            "home_xg": 1.65,
            "away_xg": 0.95,
            "uncertainty_haircut": 0.05,
            "home_win_probability": 0.55,
            "draw_probability": 0.26,
            "away_win_probability": 0.19,
            "over_2_5_probability": 0.52,
            "under_2_5_probability": 0.48,
            "btts_yes_probability": 0.47,
            "btts_no_probability": 0.53,
        }
    ])

    rows = model_output_records(predictions, target_ev=0.02)

    assert len(rows) == 7
    by_key = {
        (row["market"], row["selection"]): row
        for row in rows
    }
    assert set(by_key) == {
        ("1X2", "home"),
        ("1X2", "draw"),
        ("1X2", "away"),
        ("TOTAL_2.5", "over"),
        ("TOTAL_2.5", "under"),
        ("BTTS", "yes"),
        ("BTTS", "no"),
    }
    assert by_key[("TOTAL_2.5", "over")]["model_probability"] == 0.52
    assert by_key[("BTTS", "no")]["fair_odds"] == 1 / 0.53
    assert (
        by_key[("1X2", "home")]["minimum_take_price"]
        > by_key[("1X2", "home")]["fair_odds"]
    )
