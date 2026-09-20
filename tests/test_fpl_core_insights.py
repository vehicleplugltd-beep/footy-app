import pandas as pd

from footy_data.normalizers.fpl_core_insights import (
    normalise_fpl_core_matches,
    normalise_fpl_core_player_match_stats,
    reconcile_fpl_core_to_footy,
    reconcile_fpl_core_player_matches_to_footy,
    supplement_fpl_core_team_rows_from_players,
    enrich_fpl_core_team_rows_from_players,
    normalise_fpl_core_player_priors,
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



def test_player_match_enrichment_promotes_only_supported_team_metrics():
    teams = pd.DataFrame([
        {"code": 3, "id": 1, "name": "Arsenal"},
        {"code": 36, "id": 5, "name": "Brighton"},
    ])
    players = pd.DataFrame([
        {
            "player_code": 208706,
            "player_id": 12,
            "web_name": "Saka",
            "team_code": 3,
        },
        {
            "player_code": 116535,
            "player_id": 1,
            "web_name": "Raya",
            "team_code": 3,
        },
    ])
    matches = pd.DataFrame([
        {
            "gameweek": 5,
            "kickoff_time": "2026-09-19T14:00:00Z",
            # matches.csv uses persistent team codes, not FPL team ids.
            "home_team": 36,
            "away_team": 3,
            "match_id": "provider-1",
            "tournament": "prem",
            "player_stats_processed": True,
        }
    ])
    player_stats = pd.DataFrame([
        {
            "player_id": 12,
            "match_id": "provider-1",
            "minutes_played": 90,
            "total_shots": 3,
            "shots_on_target": 2,
            "xg": 0.4,
            "xa": 0.3,
            "xgot": 0.5,
            "chances_created": 4,
            "final_third_passes": 11,
            "touches_opposition_box": 7,
            "defensive_contributions": 2,
        },
        {
            "player_id": 1,
            "match_id": "provider-1",
            "minutes_played": 90,
            "xgot_faced": 1.2,
            "goals_prevented": 0.2,
            "saves": 4,
        },
        {
            "player_id": 98,
            "match_id": "provider-1",
            "minutes_played": 90,
            "total_shots": 1,
            "xg": 0.79,
            "penalties_scored": 1,
            "penalties_missed": 0,
        },
        {
            "player_id": 99,
            "match_id": "provider-1",
            "minutes_played": 90,
            "total_shots": 1,
            "xg": 0.79,
            "penalties_scored": 0,
            "penalties_missed": 1,
        },
    ])

    player_rows = normalise_fpl_core_player_match_stats(
        player_stats, players, teams, matches, season="2627"
    )
    assert len(player_rows) == 2
    saka = player_rows[player_rows["player_id"] == 12].iloc[0]
    assert saka["team"] == "Arsenal"
    assert saka["opponent"] == "Brighton"
    assert saka["xa"] == 0.3
    assert saka["npxg"] == 0.4
    assert saka["penalty_xg_value"] == 0.79
    assert saka["final_third_passes"] == 11

    footy = pd.DataFrame([
        {
            "match_id": "understat-abc",
            "match_date": "2026-09-19T14:00:00Z",
            "team": "Arsenal",
            "opponent": "Brighton",
            "home_away": "A",
        },
        {
            "match_id": "understat-abc",
            "match_date": "2026-09-19T14:00:00Z",
            "team": "Brighton",
            "opponent": "Arsenal",
            "home_away": "H",
        },
    ])
    linked, rate = reconcile_fpl_core_player_matches_to_footy(
        player_rows, footy
    )
    assert rate == 1.0
    assert set(linked["footy_match_id"]) == {"understat-abc"}

    team_rows = pd.DataFrame(columns=[
        "provider_match_id", "match_id", "team", "opponent", "home_away",
        "source", "retrieved_at",
    ])
    team_rows = supplement_fpl_core_team_rows_from_players(
        team_rows, linked, footy
    )
    assert len(team_rows) == 1
    assert team_rows.iloc[0]["team"] == "Arsenal"

    enriched = enrich_fpl_core_team_rows_from_players(team_rows, linked)
    row = enriched.iloc[0]
    assert row["shots"] == 3
    assert row["shots_on_target"] == 2
    assert row["box_touches"] == 7
    assert row["xa"] == 0.3
    assert row["key_passes"] == 4
    assert row["final_third_passes"] == 11
    assert row["xgot_faced"] == 1.2
    assert row["goals_prevented"] == 0.2



def test_player_prior_uses_stable_code_and_recomputed_rates():
    teams = pd.DataFrame([
        {"code": 3, "name": "Arsenal"},
    ])
    players = pd.DataFrame([
        {
            "player_code": 208706,
            "player_id": 12,
            "web_name": "Saka",
            "team_code": 3,
            "position": "Midfielder",
        },
    ])
    stats = pd.DataFrame([
        {
            "id": 12,
            "minutes": 1800,
            "starts": 20,
            "total_points": 150,
            "expected_goals": 10.0,
            "expected_assists": 8.0,
            "expected_goal_involvements": 18.0,
            "defensive_contribution": 40,
            "saves": 0,
        },
    ])

    priors = normalise_fpl_core_player_priors(
        stats, players, teams, season="2526"
    )
    row = priors.iloc[0]
    assert row["player_code"] == 208706
    assert row["team"] == "Arsenal"
    assert row["xg_per90"] == 0.5
    assert row["xa_per90"] == 0.4
    assert row["xgi_per90"] == 0.9
    assert row["verification_status"] == "PASS"



def test_player_npxg_fails_closed_when_penalty_convention_is_inconsistent():
    teams = pd.DataFrame([
        {"code": 3, "name": "Arsenal"},
        {"code": 36, "name": "Brighton"},
    ])
    players = pd.DataFrame([
        {
            "player_code": 208706,
            "player_id": 12,
            "web_name": "Saka",
            "team_code": 3,
        },
    ])
    matches = pd.DataFrame([
        {
            "gameweek": 5,
            "kickoff_time": "2026-09-19T14:00:00Z",
            "home_team": 36,
            "away_team": 3,
            "match_id": "provider-1",
            "tournament": "prem",
            "player_stats_processed": True,
        }
    ])
    player_stats = pd.DataFrame([
        {
            "player_id": 12,
            "match_id": "provider-1",
            "minutes_played": 90,
            "total_shots": 3,
            "xg": 0.4,
            "penalties_scored": 0,
            "penalties_missed": 0,
        },
        {
            "player_id": 98,
            "match_id": "provider-1",
            "minutes_played": 90,
            "total_shots": 1,
            "xg": 0.70,
            "penalties_scored": 1,
            "penalties_missed": 0,
        },
        {
            "player_id": 99,
            "match_id": "provider-1",
            "minutes_played": 90,
            "total_shots": 1,
            "xg": 0.88,
            "penalties_scored": 0,
            "penalties_missed": 1,
        },
    ])

    rows = normalise_fpl_core_player_match_stats(
        player_stats,
        players,
        teams,
        matches,
        season="2627",
    )
    assert len(rows) == 1
    assert pd.isna(rows.iloc[0]["npxg"])
    assert pd.isna(rows.iloc[0]["penalty_xg_value"])
