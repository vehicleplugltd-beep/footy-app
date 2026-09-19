import pandas as pd

from footy_data.normalizers.understat import normalise_understat


def test_understat_normalizer_builds_two_team_rows_and_shots():
    team_stats = pd.DataFrame([{
        "league": "ENG-Premier League",
        "season": "2026",
        "game": "A-B-2026-09-19",
        "date": "2026-09-19 15:00:00",
        "home_team": "A",
        "away_team": "B",
        "home_goals": 2,
        "away_goals": 1,
        "home_xg": 1.8,
        "away_xg": 0.9,
        "home_np_xg": 1.6,
        "away_np_xg": 0.9,
        "home_ppda": 8.0,
        "away_ppda": 14.0,
        "home_deep_completions": 10,
        "away_deep_completions": 4,
    }])
    shots = pd.DataFrame([
        {
            "game": "A-B-2026-09-19",
            "team": "A",
            "result": "Goal",
            "xg": 0.4,
            "situation": "Open Play",
        },
        {
            "game": "A-B-2026-09-19",
            "team": "A",
            "result": "Saved Shot",
            "xg": 0.2,
            "situation": "From Corner",
        },
        {
            "game": "A-B-2026-09-19",
            "team": "B",
            "result": "Missed Shot",
            "xg": 0.1,
            "situation": "Open Play",
        },
    ])

    out = normalise_understat(
        team_stats,
        shots,
        retrieved_at="2026-09-19T20:00:00+00:00",
    )
    assert len(out) == 2

    home = out[out["team"] == "A"].iloc[0]
    away = out[out["team"] == "B"].iloc[0]

    assert home["xg"] == 1.8
    assert home["xga"] == 0.9
    assert home["shots"] == 2
    assert home["shots_on_target"] == 2
    assert home["set_piece_xg"] == 0.2
    assert home["shots_conceded"] == 1
    assert away["shots"] == 1
