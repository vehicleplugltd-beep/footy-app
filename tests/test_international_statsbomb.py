from footy_data.international_statsbomb import extract_match
import pytest


def fixture():
    return {"match_id": 123, "home_team": {"home_team_name": "Alpha"},
            "away_team": {"away_team_name": "Beta"}, "home_score": 1, "away_score": 0,
            "match_date": "2024-06-01", "kick_off": "20:00:00"}


def shot(team, xg, outcome="Saved", kind="Open Play"):
    return {"type": {"name": "Shot"}, "team": {"name": team},
            "shot": {"statsbomb_xg": xg, "type": {"name": kind},
                     "outcome": {"name": outcome}}}


def test_verified_two_sided_xg_and_non_penalty():
    match, rows = extract_match(fixture(), [
        shot("Alpha", .2, "Goal"), shot("Alpha", .78, kind="Penalty"),
        shot("Beta", .3)], "UEFA Euro", "2024")
    assert match["match_id"] == "statsbomb-int-123"
    assert match["source"] == "statsbomb-open-international"
    home, away = rows
    assert home["home_away"] == "H" and away["home_away"] == "A"
    assert home["xg"] == .98 and home["npxg"] == .2
    assert home["xga"] == away["xg"] == .3
    assert away["xga"] == home["xg"]
    assert all(row["verified"] for row in rows)


def test_missing_shot_xg_rejected():
    with pytest.raises(ValueError):
        extract_match(fixture(), [shot("Alpha", None), shot("Beta", .1)], "UEFA Euro", "2024")


def test_one_sided_events_rejected():
    with pytest.raises(ValueError):
        extract_match(fixture(), [shot("Alpha", .1)], "UEFA Euro", "2024")


def test_goal_reconciliation_rejected():
    with pytest.raises(ValueError):
        extract_match(fixture(), [shot("Alpha", .1, "Goal"),
                                  shot("Alpha", .2, "Goal"), shot("Beta", .1)], "UEFA Euro", "2024")


def test_shootout_shots_excluded_from_xg():
    shootout = shot("Alpha", .8, "Goal")
    shootout["period"] = 5
    _, rows = extract_match(fixture(), [shot("Alpha", .2, "Goal"),
                                       shot("Beta", .3), shootout], "FIFA World Cup", "2022")
    assert rows[0]["xg"] == .2
    assert rows[0]["shots"] == 1
