import pandas as pd

from footy_data.walk_forward import build_walk_forward_predictions


def _history(with_elo: bool):
    rows = []
    dates = pd.date_range("2026-01-01", periods=10, freq="7D", tz="UTC")
    for i, dt in enumerate(dates):
        home = "A" if i % 2 == 0 else "B"
        away = "B" if i % 2 == 0 else "A"
        for team, opponent, side in [(home, away, "H"), (away, home, "A")]:
            row = {
                "match_id": f"m{i}",
                "match_date": dt,
                "league": "TEST",
                "season": "2627",
                "team": team,
                "opponent": opponent,
                "home_away": side,
                "goals": 1,
                "goals_conceded": 1,
                "xg": 1.3,
                "xga": 1.3,
                "source": "test",
                "retrieved_at": "2026-09-19T00:00:00Z",
            }
            if with_elo:
                row["team_elo"] = 1700 if team == "A" else 1400
                row["opponent_elo"] = 1400 if team == "A" else 1700
            rows.append(row)
    return pd.DataFrame(rows)


def test_elo_changes_walk_forward_probabilities():
    base = build_walk_forward_predictions(
        _history(False),
        min_team_matches=3,
        use_elo=False,
    )
    elo = build_walk_forward_predictions(
        _history(True),
        min_team_matches=3,
        use_elo=True,
    )
    merged = base[["match_id", "home_win_probability"]].merge(
        elo[["match_id", "home_win_probability"]],
        on="match_id",
        suffixes=("_base", "_elo"),
    )
    assert (
        merged["home_win_probability_base"]
        != merged["home_win_probability_elo"]
    ).any()
