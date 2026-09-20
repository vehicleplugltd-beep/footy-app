import pandas as pd

from footy_data.normalizers.fpl_core_insights import (
    normalise_fpl_core_matches,
    reconcile_fpl_core_to_footy,
)


def test_fpl_core_enrichment_does_not_replace_designated_xg():
    teams = pd.DataFrame([
        {"code": 3, "name": "Arsenal"},
        {"code": 36, "name": "Brighton"},
    ])
    matches = pd.DataFrame([
        {
            "tournament": "prem",
            "finished": True,
            "stats_processed": True,
            "kickoff_time": "2026-09-19T14:00:00Z",
            "home_team": 36,
            "away_team": 3,
            "home_score": 3,
            "away_score": 0,
            "match_id": "provider-1",
            "home_expected_goals_xg": 1.31,
            "away_expected_goals_xg": 1.63,
            "home_total_shots": 17,
            "away_total_shots": 11,
            "home_shots_on_target": 5,
            "away_shots_on_target": 2,
            "home_big_chances": 3,
            "away_big_chances": 2,
            "home_touches_in_opposition_box": 30,
            "away_touches_in_opposition_box": 36,
            "home_xg_set_play": 0.56,
            "away_xg_set_play": 0.55,
            "home_possession": 40,
            "away_possession": 60,
            "home_accurate_crosses": 6,
            "away_accurate_crosses": 6,
            "home_shots_inside_box": 10,
            "away_shots_inside_box": 10,
            "home_xg_on_target_xgot": 2.04,
            "away_xg_on_target_xgot": 1.08,
        }
    ])
    frame = normalise_fpl_core_matches(matches, teams)
    assert len(frame) == 2
    brighton = frame[frame["team"] == "Brighton"].iloc[0]
    assert pd.isna(brighton["xg"])
    assert brighton["big_chances"] == 3
    assert brighton["box_touches"] == 30
    assert brighton["xgot"] == 2.04

    footy = pd.DataFrame([
        {
            "match_id": "understat-abc",
            "match_date": "2026-09-19T14:00:00Z",
            "team": "Brighton",
            "opponent": "Arsenal",
            "home_away": "H",
        },
        {
            "match_id": "understat-abc",
            "match_date": "2026-09-19T14:00:00Z",
            "team": "Arsenal",
            "opponent": "Brighton",
            "home_away": "A",
        },
    ])
    reconciled, rate = reconcile_fpl_core_to_footy(frame, footy)
    assert rate == 1.0
    assert set(reconciled["match_id"]) == {"understat-abc"}
