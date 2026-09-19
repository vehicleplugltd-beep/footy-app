import pandas as pd

from footy_data.features import add_rolling_process, add_home_away_process


def _sample():
    return pd.DataFrame([
        {"team":"A","match_date":"2026-01-01","home_away":"H","xg":1.0,"xga":0.8,"goals":1,"goals_conceded":0},
        {"team":"A","match_date":"2026-01-08","home_away":"A","xg":3.0,"xga":1.2,"goals":2,"goals_conceded":1},
        {"team":"A","match_date":"2026-01-15","home_away":"H","xg":2.0,"xga":1.0,"goals":2,"goals_conceded":1},
    ])


def test_rolling_features_do_not_use_current_match():
    out = add_rolling_process(_sample(), span=3, prior_weight=0.35)
    assert pd.isna(out.iloc[0]["xg_process"])
    assert out.iloc[1]["xg_process"] == 1.0


def test_home_away_split_blends_with_overall():
    base = add_rolling_process(_sample(), span=3, prior_weight=0.35)
    out = add_home_away_process(base, span=3, split_weight=0.35)
    assert "xg_venue_process" in out.columns
