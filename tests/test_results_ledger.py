import pandas as pd

from footy_data.results_ledger import (
    _identity_result,
    _latest_complete_1x2,
    _settlement,
)


def test_latest_complete_1x2_uses_latest_full_snapshot():
    frame = pd.DataFrame([
        {"match_id":"m1","market":"1X2","selection":"home","model_probability":0.50,"created_at":"2026-09-20T08:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"draw","model_probability":0.25,"created_at":"2026-09-20T08:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"away","model_probability":0.25,"created_at":"2026-09-20T08:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"home","model_probability":0.55,"created_at":"2026-09-20T09:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"draw","model_probability":0.23,"created_at":"2026-09-20T09:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"away","model_probability":0.22,"created_at":"2026-09-20T09:00:00Z"},
    ])

    latest = _latest_complete_1x2(frame)

    assert len(latest) == 3
    assert set(latest["selection"]) == {"home","draw","away"}
    assert set(latest["created_at"]) == {pd.Timestamp("2026-09-20T09:00:00Z")}


def test_latest_complete_1x2_ignores_incomplete_newer_snapshot():
    frame = pd.DataFrame([
        {"match_id":"m1","market":"1X2","selection":"home","model_probability":0.50,"created_at":"2026-09-20T08:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"draw","model_probability":0.25,"created_at":"2026-09-20T08:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"away","model_probability":0.25,"created_at":"2026-09-20T08:00:00Z"},
        {"match_id":"m1","market":"1X2","selection":"home","model_probability":0.55,"created_at":"2026-09-20T09:00:00Z"},
    ])

    latest = _latest_complete_1x2(frame)

    assert len(latest) == 3
    assert set(latest["created_at"]) == {pd.Timestamp("2026-09-20T08:00:00Z")}


def test_1x2_settlement():
    assert _settlement("home", 2, 1) == "WON"
    assert _settlement("home", 1, 1) == "LOST"
    assert _settlement("draw", 1, 1) == "WON"
    assert _settlement("away", 0, 2) == "WON"
    assert _settlement("away", 2, 0) == "LOST"



def test_identity_result_reconciles_official_fixture_id_to_provider_result():
    results = pd.DataFrame([
        {
            "match_id": "understat-123",
            "kickoff_at": pd.Timestamp("2026-09-26T14:00:00Z"),
            "home_team_key": "manchestercity",
            "away_team_key": "nottinghamforest",
            "home_goals": 2,
            "away_goals": 0,
        }
    ])
    call = {
        "match_id": "fpl-99",
        "kickoff_at": "2026-09-26T14:00:00Z",
        "home_team": "Man City",
        "away_team": "Nott'm Forest",
    }

    assert _identity_result(call, results) == (2, 0)
