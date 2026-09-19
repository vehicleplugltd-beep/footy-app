import pandas as pd

from footy_data.process_ridge import (
    FEATURE_COLUMNS,
    build_process_feature_rows,
    holdout_match_predictions,
)


def _history():
    rows = []
    dates = pd.date_range("2025-01-01", periods=10, freq="7D", tz="UTC")
    for i, dt in enumerate(dates):
        home = "A" if i % 2 == 0 else "B"
        away = "B" if i % 2 == 0 else "A"
        for team, opponent, venue, strength in [
            (home, away, "H", 1.15 if home == "A" else 0.90),
            (away, home, "A", 1.15 if away == "A" else 0.90),
        ]:
            rows.append({
                "match_id": f"m{i}",
                "match_date": dt,
                "league": "TEST",
                "season": "2425" if i < 6 else "2526",
                "team": team,
                "opponent": opponent,
                "home_away": venue,
                "goals": 1,
                "goals_conceded": 1,
                "xg": 1.4 * strength,
                "npxg": 1.3 * strength,
                "xga": 1.2 / strength,
                "npxga": 1.1 / strength,
                "shots": 12 * strength,
                "shots_on_target": 4.5 * strength,
                "shots_conceded": 11 / strength,
                "sot_conceded": 4 / strength,
                "set_piece_xg": 0.18 * strength,
                "set_piece_xga": 0.16 / strength,
                "ppda": 10 / strength,
                "deep_completions": 8 * strength,
            })
    return pd.DataFrame(rows)


def test_current_match_metrics_do_not_leak_into_current_features():
    raw = _history()
    first = build_process_feature_rows(raw, min_team_matches=3)

    changed = raw.copy()
    final_match = changed["match_id"] == "m9"
    changed.loc[final_match, "xg"] = 3.5
    changed.loc[final_match, "shots"] = 30
    changed.loc[final_match, "shots_on_target"] = 12
    changed.loc[final_match, "set_piece_xg"] = 1.0
    changed.loc[final_match, "ppda"] = 3.0
    changed.loc[final_match, "deep_completions"] = 20

    second = build_process_feature_rows(changed, min_team_matches=3)

    a = first[first["match_id"] == "m9"].sort_values("team").reset_index(drop=True)
    b = second[second["match_id"] == "m9"].sort_values("team").reset_index(drop=True)
    pd.testing.assert_frame_equal(
        a[list(FEATURE_COLUMNS)],
        b[list(FEATURE_COLUMNS)],
        check_dtype=False,
    )


def test_holdout_ridge_returns_valid_match_probabilities():
    rows = []
    for i in range(24):
        season = "2223" if i < 8 else "2324" if i < 16 else "2425"
        match_id = f"r{i // 2}"
        venue = "H" if i % 2 == 0 else "A"
        base = 1.0 + (i % 5) * 0.08
        row = {
            "match_id": match_id,
            "match_date": pd.Timestamp("2024-01-01", tz="UTC") + pd.Timedelta(days=i),
            "season": season,
            "team": f"T{i % 4}",
            "opponent": f"T{(i + 1) % 4}",
            "home_away": venue,
            "target_xg": 1.2 * base,
            "team_matches_before": 8 + i,
            "opp_matches_before": 8 + i,
        }
        for j, col in enumerate(FEATURE_COLUMNS):
            row[col] = float(venue == "H") if col == "home_indicator" else base + j * 0.03
        rows.append(row)

    fit, predictions = holdout_match_predictions(
        pd.DataFrame(rows),
        train_seasons={"2223", "2324"},
        holdout_seasons={"2425"},
        alpha=10.0,
    )

    assert fit.alpha == 10.0
    assert not predictions.empty
    assert (predictions["model_home_xg"] > 0).all()
    assert (predictions["model_away_xg"] > 0).all()
    total = (
        predictions["home_win_probability"]
        + predictions["draw_probability"]
        + predictions["away_win_probability"]
    )
    assert ((total - 1.0).abs() < 1e-8).all()
