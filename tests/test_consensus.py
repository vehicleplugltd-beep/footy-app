import pandas as pd
import pytest

from footy_data.consensus import synthesize_match_team_metrics


def test_single_source_is_preserved_without_duplication():
    frame = pd.DataFrame([
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "xg": 1.1,
            "shots": 10,
            "source": "understat",
            "retrieved_at": "2026-09-20T10:00:00Z",
        }
    ])

    result = synthesize_match_team_metrics(frame)

    assert len(result) == 1
    assert result.iloc[0]["xg"] == pytest.approx(1.1)
    assert result.iloc[0]["shots"] == pytest.approx(10)
    assert result.iloc[0]["source_count"] == 1
    assert "understat" in result.iloc[0]["source"]


def test_modelled_metric_uses_preferred_source_and_counts_use_robust_consensus():
    frame = pd.DataFrame([
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "xg": 1.10,
            "shots": 10,
            "source": "understat",
            "retrieved_at": "2026-09-20T10:00:00Z",
        },
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "xg": 1.35,
            "shots": 11,
            "source": "sofascore",
            "retrieved_at": "2026-09-20T10:02:00Z",
        },
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "xg": 1.18,
            "shots": 10,
            "source": "fbref",
            "retrieved_at": "2026-09-20T10:03:00Z",
        },
    ])

    result = synthesize_match_team_metrics(frame)
    row = result.iloc[0]

    # xG models are definition-dependent: select the preferred model rather
    # than averaging incompatible expected-goal definitions.
    assert row["xg"] == pytest.approx(1.10)
    # Counting data uses robust consensus.
    assert row["shots"] == pytest.approx(10)
    assert row["source_count"] == 3
    assert row["source_confidence"] > 0.7


def test_large_provider_disagreement_is_flagged():
    frame = pd.DataFrame([
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "xg": 0.55,
            "source": "understat",
        },
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "xg": 2.20,
            "source": "sofascore",
        },
    ])

    result = synthesize_match_team_metrics(frame)
    assert "xg" in result.iloc[0]["source_conflicts"]
    assert result.iloc[0]["source_confidence"] < 0.8


def test_two_provider_rows_become_one_model_row():
    frame = pd.DataFrame([
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "shots": 9,
            "source": "understat",
        },
        {
            "match_id": "1",
            "team": "Leeds",
            "opponent": "Arsenal",
            "home_away": "A",
            "shots": 10,
            "source": "sofascore",
        },
        {
            "match_id": "1",
            "team": "Arsenal",
            "opponent": "Leeds",
            "home_away": "H",
            "shots": 16,
            "source": "understat",
        },
        {
            "match_id": "1",
            "team": "Arsenal",
            "opponent": "Leeds",
            "home_away": "H",
            "shots": 16,
            "source": "sofascore",
        },
    ])

    result = synthesize_match_team_metrics(frame)
    assert len(result) == 2
    assert set(result["team"]) == {"Leeds", "Arsenal"}
