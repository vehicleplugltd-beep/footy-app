import pandas as pd
import pytest

from footy_data.upcoming import (
    normalise_upcoming_fixtures,
    build_upcoming_predictions,
    model_output_records,
)


def _history():
    rows = []
    dates = pd.date_range("2026-01-01", periods=10, freq="7D", tz="UTC")
    for i, dt in enumerate(dates):
        home = "A" if i % 2 == 0 else "B"
        away = "B" if i % 2 == 0 else "A"
        rows.extend([
            {
                "match_id": f"m{i}",
                "match_date": dt,
                "league": "TEST",
                "season": "2526",
                "team": home,
                "opponent": away,
                "home_away": "H",
                "goals": 2 if home == "A" else 1,
                "goals_conceded": 1 if home == "A" else 2,
                "xg": 1.6 if home == "A" else 1.1,
                "xga": 1.1 if home == "A" else 1.6,
                "npxg": 1.5 if home == "A" else 1.0,
                "npxga": 1.0 if home == "A" else 1.5,
                "ppda": 9.0 if home == "A" else 13.0,
                "deep_completions": 9.0 if home == "A" else 5.0,
                "source": "test",
                "retrieved_at": "2026-09-19T00:00:00Z",
            },
            {
                "match_id": f"m{i}",
                "match_date": dt,
                "league": "TEST",
                "season": "2526",
                "team": away,
                "opponent": home,
                "home_away": "A",
                "goals": 1 if away == "B" else 2,
                "goals_conceded": 2 if away == "B" else 1,
                "xg": 1.1 if away == "B" else 1.6,
                "xga": 1.6 if away == "B" else 1.1,
                "npxg": 1.0 if away == "B" else 1.5,
                "npxga": 1.5 if away == "B" else 1.0,
                "ppda": 13.0 if away == "B" else 9.0,
                "deep_completions": 5.0 if away == "B" else 9.0,
                "source": "test",
                "retrieved_at": "2026-09-19T00:00:00Z",
            },
        ])
    return pd.DataFrame(rows)


def test_upcoming_prediction_uses_completed_history():
    schedule = pd.DataFrame([{
        "league": "TEST",
        "season": "2627",
        "game": "future1",
        "date": "2026-09-21T15:00:00Z",
        "home_team": "A",
        "away_team": "B",
        "is_result": False,
    }])
    fixtures = normalise_upcoming_fixtures(
        schedule,
        horizon_days=5,
        now=pd.Timestamp("2026-09-19T12:00:00Z"),
    )
    out = build_upcoming_predictions(
        _history(),
        fixtures,
        model_version="test-v6",
        min_team_matches=5,
    )

    assert len(out) == 1
    row = out.iloc[0]
    total = (
        row["home_win_probability"]
        + row["draw_probability"]
        + row["away_win_probability"]
    )
    assert abs(total - 1.0) < 1e-8

    assert abs(
        row["over_2_5_probability"] + row["under_2_5_probability"] - 1.0
    ) < 1e-8
    assert abs(
        row["btts_yes_probability"] + row["btts_no_probability"] - 1.0
    ) < 1e-8

    records = model_output_records(out)
    assert len(records) == 7
    assert {
        (record["market"], record["selection"])
        for record in records
    } == {
        ("1X2", "home"),
        ("1X2", "draw"),
        ("1X2", "away"),
        ("TOTAL_2.5", "over"),
        ("TOTAL_2.5", "under"),
        ("BTTS", "yes"),
        ("BTTS", "no"),
    }



def test_upcoming_process_mode_matches_calibrated_family():
    schedule = pd.DataFrame([{
        "league": "TEST",
        "season": "2627",
        "game": "future2",
        "date": "2026-09-21T15:00:00Z",
        "home_team": "A",
        "away_team": "B",
        "is_result": False,
    }])
    fixtures = normalise_upcoming_fixtures(
        schedule,
        horizon_days=5,
        now=pd.Timestamp("2026-09-19T12:00:00Z"),
    )

    history = _history()
    # Create a meaningful penalty-noise discrepancy for A so the npxG
    # challenger is observably different from the raw-xG model.
    history.loc[history["team"] == "A", "npxg"] = 0.75
    history.loc[history["team"] == "A", "npxga"] = 0.90

    raw = build_upcoming_predictions(
        history,
        fixtures,
        model_version="raw-xg",
        min_team_matches=5,
        process_mode="xg",
    )
    nonpen = build_upcoming_predictions(
        history,
        fixtures,
        model_version="npxg",
        min_team_matches=5,
        process_mode="npxg_blend",
        npxg_weight=0.70,
    )

    assert len(raw) == len(nonpen) == 1
    assert nonpen.iloc[0]["home_xg"] != pytest.approx(
        raw.iloc[0]["home_xg"]
    )


def test_upcoming_rejects_unknown_process_mode():
    schedule = pd.DataFrame([{
        "league": "TEST",
        "season": "2627",
        "game": "future3",
        "date": "2026-09-21T15:00:00Z",
        "home_team": "A",
        "away_team": "B",
        "is_result": False,
    }])
    fixtures = normalise_upcoming_fixtures(
        schedule,
        horizon_days=5,
        now=pd.Timestamp("2026-09-19T12:00:00Z"),
    )
    with pytest.raises(ValueError, match="process_mode"):
        build_upcoming_predictions(
            _history(),
            fixtures,
            model_version="bad",
            process_mode="not-a-model",
        )
