import pandas as pd

from footy_data.features import add_rolling_process, add_schedule_adjusted_process


def test_schedule_adjustment_uses_only_prematch_opponent_strength():
    rows = []
    dates = pd.date_range("2026-01-01", periods=4, freq="7D", tz="UTC")
    for i, dt in enumerate(dates):
        rows.extend([
            {
                "match_id": f"m{i}",
                "match_date": dt,
                "team": "A",
                "opponent": "B",
                "home_away": "H",
                "xg": 1.5 + i * 0.1,
                "xga": 0.8,
                "npxg": 1.4 + i * 0.1,
                "npxga": 0.7,
                "goals": 1,
                "goals_conceded": 0,
                "ppda": 8.0,
                "deep_completions": 10.0,
            },
            {
                "match_id": f"m{i}",
                "match_date": dt,
                "team": "B",
                "opponent": "A",
                "home_away": "A",
                "xg": 0.8,
                "xga": 1.5 + i * 0.1,
                "npxg": 0.7,
                "npxga": 1.4 + i * 0.1,
                "goals": 0,
                "goals_conceded": 1,
                "ppda": 14.0,
                "deep_completions": 5.0,
            },
        ])

    raw = pd.DataFrame(rows)
    rolled = add_rolling_process(raw)
    out = add_schedule_adjusted_process(rolled)

    first_a = out[(out["team"] == "A") & (out["match_id"] == "m0")].iloc[0]
    second_a = out[(out["team"] == "A") & (out["match_id"] == "m1")].iloc[0]

    assert pd.isna(first_a["xg_sched_process"])
    assert pd.notna(second_a["xg_sched_process"])
    assert "deep_completions_conceded_process" in out.columns
