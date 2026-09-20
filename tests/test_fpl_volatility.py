import pandas as pd
import pytest

from footy_data.fpl_volatility import build_calibration, prepare_samples


def _history() -> pd.DataFrame:
    rows = []
    for gw in range(1, 9):
        for element, position, start_pattern, point_base in (
            (1, "MID", [1, 1, 1, 1, 1, 1, 1, 1], 5),
            (2, "DEF", [0, 1, 0, 1, 0, 1, 0, 1], 3),
        ):
            start = start_pattern[gw - 1]
            minutes = 90 if start else 0
            rows.append(
                {
                    "element": element,
                    "position": position,
                    "round": gw,
                    "minutes": minutes,
                    "starts": start,
                    "total_points": point_base + (gw % 3) if start else 0,
                    "expected_goal_involvements": (
                        0.45 if element == 1 and start else 0.0
                    ),
                    "bonus": 1 if element == 1 and start and gw % 2 == 0 else 0,
                    "clean_sheets": 1 if element == 2 and start and gw % 2 == 0 else 0,
                }
            )
    return pd.DataFrame(rows)


def test_volatility_calibration_uses_only_required_pre_deadline_fields():
    frame = _history()
    # xP is deliberately absent: calibration must never depend on the
    # historically unsafe post-match expected-points field.
    payload = build_calibration(frame, min_samples=1)

    assert payload["version"] == "counterplay-volatility-v1"
    assert payload["sample_count"] > 0
    assert payload["profiles"]["GLOBAL"]["sample_size"] > 0
    assert "standardized_quantiles" in payload["profiles"]["GLOBAL"]


def test_same_gameweek_outcome_does_not_change_peer_baseline():
    frame = _history()
    original = prepare_samples(frame)

    mutated = frame.copy()
    # Alter player 1's GW5 outcome wildly. Player 2's GW5 residual must remain
    # unchanged because histories are updated only after the whole GW is scored.
    mutated.loc[
        (mutated["element"] == 1) & (mutated["round"] == 5),
        "total_points",
    ] = 40
    changed = prepare_samples(mutated)

    # Rows are emitted deterministically by GW then element. GW5 is the second
    # emitted deadline after three prior observations, so player 2 is row 3.
    assert original.iloc[3]["residual"] == pytest.approx(
        changed.iloc[3]["residual"]
    )


def test_missing_historical_fields_fail_closed():
    frame = _history().drop(columns=["total_points"])
    with pytest.raises(ValueError, match="missing columns"):
        build_calibration(frame, min_samples=1)
