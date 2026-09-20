import pandas as pd

from footy_data.verification import verify_provider_rows


def _frame(shots_delta=0, goal_delta=0):
    rows = []
    for match in range(12):
        for team, opponent, goals, conceded in (
            ("A", "B", 2, 1),
            ("B", "A", 1, 2),
        ):
            rows.append(
                {
                    "match_id": f"m{match}",
                    "team": team,
                    "opponent": opponent,
                    "home_away": "H" if team == "A" else "A",
                    "goals": goals + goal_delta,
                    "goals_conceded": conceded,
                    "xg": 1.7 if team == "A" else 0.9,
                    "xga": 0.9 if team == "A" else 1.7,
                    "shots": (14 if team == "A" else 8) + shots_delta,
                    "shots_on_target": 5 if team == "A" else 3,
                    "source": "provider",
                }
            )
    return pd.DataFrame(rows)


def test_verification_passes_consistent_provider():
    reference = _frame()
    provider = _frame()
    report = verify_provider_rows(provider, reference, "test")
    assert report.status == "PASS"
    assert report.exact_goal_mismatches == 0
    assert report.match_rate == 1.0


def test_verification_blocks_goal_mismatch():
    reference = _frame()
    provider = _frame(goal_delta=1)
    report = verify_provider_rows(provider, reference, "test")
    assert report.status == "BLOCKED"
    assert report.exact_goal_mismatches > 0


def test_verification_blocks_material_shot_definition_drift():
    reference = _frame()
    provider = _frame(shots_delta=4)
    report = verify_provider_rows(provider, reference, "test")
    assert report.status == "BLOCKED"
