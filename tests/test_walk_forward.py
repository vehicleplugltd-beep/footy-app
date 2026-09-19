import pandas as pd

from footy_data.walk_forward import build_walk_forward_predictions


def test_walk_forward_skips_early_matches_and_uses_prior_history():
    rows = []
    dates = pd.date_range("2026-01-01", periods=8, freq="7D", tz="UTC")

    for i, dt in enumerate(dates):
        home_team = "A" if i % 2 == 0 else "B"
        away_team = "B" if i % 2 == 0 else "A"
        rows.extend([
            {
                "match_id": f"m{i}",
                "match_date": dt,
                "league": "TEST",
                "season": "2627",
                "team": home_team,
                "opponent": away_team,
                "home_away": "H",
                "goals": 2 if home_team == "A" else 1,
                "goals_conceded": 1 if home_team == "A" else 2,
                "xg": 1.6 if home_team == "A" else 1.0,
                "xga": 1.0 if home_team == "A" else 1.6,
                "source": "test",
                "retrieved_at": "2026-09-19T00:00:00Z",
            },
            {
                "match_id": f"m{i}",
                "match_date": dt,
                "league": "TEST",
                "season": "2627",
                "team": away_team,
                "opponent": home_team,
                "home_away": "A",
                "goals": 1 if away_team == "B" else 2,
                "goals_conceded": 2 if away_team == "B" else 1,
                "xg": 1.0 if away_team == "B" else 1.6,
                "xga": 1.6 if away_team == "B" else 1.0,
                "source": "test",
                "retrieved_at": "2026-09-19T00:00:00Z",
            },
        ])

    out = build_walk_forward_predictions(
        pd.DataFrame(rows),
        min_team_matches=3,
    )

    assert not out.empty
    assert out["match_date"].min() > dates[2]
    prob_sum = (
        out["home_win_probability"]
        + out["draw_probability"]
        + out["away_win_probability"]
    )
    assert ((prob_sum - 1).abs() < 1e-8).all()
