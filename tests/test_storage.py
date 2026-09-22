import pandas as pd

from footy_data.storage import (
    SupabaseRESTReader,
    SupabaseRESTWriter,
    frame_records,
)


def test_frame_records_cleans_nan_and_timestamps():
    frame = pd.DataFrame([{
        "xg": float("nan"),
        "match_date": pd.Timestamp("2026-09-19T15:00:00Z"),
        "team": "A",
    }])
    row = frame_records(frame)[0]
    assert row["xg"] is None
    assert row["match_date"].startswith("2026-09-19T15:00:00")


def test_writer_upsert(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

    def fake_post(url, params=None, headers=None, json=None, timeout=None):
        captured.update({
            "url": url,
            "params": params,
            "headers": headers,
            "json": json,
            "timeout": timeout,
        })
        return Response()

    monkeypatch.setattr("footy_data.storage.requests.post", fake_post)

    writer = SupabaseRESTWriter(
        url="https://example.supabase.co",
        service_role_key="secret",
    )
    writer.upsert_matches([{
        "match_id": "m1",
        "league": "ENG-Premier League",
        "season": "2026",
        "home_team": "A",
        "away_team": "B",
        "source": "understat",
    }])

    assert captured["url"].endswith("/rest/v1/footy_matches")
    assert captured["params"]["on_conflict"] == "match_id"
    assert captured["headers"]["Authorization"] == "Bearer secret"



def test_model_validation_filters_model_and_league(monkeypatch):
    rows = [
        {
            "model_version": "v7",
            "league": "ENG-Premier League",
            "market": "1X2",
            "status": "WATCH",
        },
        {
            "model_version": "v7",
            "league": "ITA-Serie A",
            "market": "1X2",
            "status": "RESEARCH",
        },
        {
            "model_version": "v8",
            "league": "ITA-Serie A",
            "market": "1X2",
            "status": "RESEARCH",
        },
    ]

    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )
    monkeypatch.setattr(
        reader,
        "_get_all",
        lambda table, select="*": rows,
    )

    frame = reader.model_market_validation(
        "v7",
        league="ITA-Serie A",
    )

    assert len(frame) == 1
    assert frame.iloc[0]["status"] == "RESEARCH"
    assert frame.iloc[0]["league"] == "ITA-Serie A"


def test_historical_metrics_require_pass_for_fotmob(monkeypatch):
    matches = [
        {
            "match_id": "m-pass",
            "league": "ENG-Championship",
            "season": "2526",
            "kickoff_at": "2026-03-01T15:00:00Z",
            "home_team": "A",
            "away_team": "B",
        },
        {
            "match_id": "m-warn",
            "league": "ENG-Championship",
            "season": "2526",
            "kickoff_at": "2026-03-02T15:00:00Z",
            "home_team": "C",
            "away_team": "D",
        },
    ]
    metrics = [
        {
            "match_id": "m-pass",
            "team": "A",
            "opponent": "B",
            "home_away": "H",
            "goals": 1,
            "goals_conceded": 0,
            "xg": 1.2,
            "source": "fotmob",
            "retrieved_at": "2026-03-01T18:00:00Z",
            "verified": True,
            "verification_status": "PASS",
            "verified_at": "2026-03-01T18:00:00Z",
        },
        {
            "match_id": "m-warn",
            "team": "C",
            "opponent": "D",
            "home_away": "H",
            "goals": 1,
            "goals_conceded": 1,
            "xg": 0.9,
            "source": "fotmob",
            "retrieved_at": "2026-03-02T18:00:00Z",
            "verified": True,
            "verification_status": "fotmob_match_detail_verified",
            "verified_at": "2026-03-02T18:00:00Z",
        },
    ]

    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )

    def fake_get_all(table, select="*"):
        if table == "footy_matches":
            return matches
        if table == "footy_match_team_metrics":
            return metrics
        return []

    monkeypatch.setattr(reader, "_get_all", fake_get_all)

    frame = reader.historical_match_team_metrics()

    assert set(frame["match_id"]) == {"m-pass"}
    assert frame.iloc[0]["xg"] == 1.2


def test_historical_metrics_can_include_unverified_for_diagnostics(monkeypatch):
    matches = [{
        "match_id": "m-warn",
        "league": "ENG-Championship",
        "season": "2526",
        "kickoff_at": "2026-03-02T15:00:00Z",
        "home_team": "C",
        "away_team": "D",
    }]
    metrics = [{
        "match_id": "m-warn",
        "team": "C",
        "opponent": "D",
        "home_away": "H",
        "goals": 1,
        "goals_conceded": 1,
        "xg": 0.9,
        "source": "fotmob",
        "retrieved_at": "2026-03-02T18:00:00Z",
        "verified": True,
        "verification_status": "fotmob_match_detail_verified",
        "verified_at": "2026-03-02T18:00:00Z",
    }]

    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )

    def fake_get_all(table, select="*"):
        if table == "footy_matches":
            return matches
        if table == "footy_match_team_metrics":
            return metrics
        return []

    monkeypatch.setattr(reader, "_get_all", fake_get_all)

    frame = reader.historical_match_team_metrics(include_unverified=True)
    assert set(frame["match_id"]) == {"m-warn"}


def test_historical_reader_collapses_exact_paginated_repeats(monkeypatch):
    match = {
        "match_id": "m-pass",
        "league": "ENG-Championship",
        "season": "2526",
        "kickoff_at": "2026-03-01T15:00:00Z",
        "home_team": "A",
        "away_team": "B",
    }
    metrics = [
        {
            "match_id": "m-pass",
            "team": team,
            "opponent": opponent,
            "home_away": side,
            "goals": goals,
            "goals_conceded": conceded,
            "xg": xg,
            "xga": xga,
            "source": "fotmob",
            "verified": True,
            "verification_status": "PASS",
        }
        for team, opponent, side, goals, conceded, xg, xga in [
            ("A", "B", "H", 1, 0, 1.2, 0.7),
            ("B", "A", "A", 0, 1, 0.7, 1.2),
        ]
    ]
    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )

    def fake_get_all(table, select="*"):
        if table == "footy_matches":
            return [match, dict(match)]
        if table == "footy_match_team_metrics":
            return metrics + [dict(metrics[0]), dict(metrics[1])]
        return []

    monkeypatch.setattr(reader, "_get_all", fake_get_all)
    frame = reader.historical_match_team_metrics()
    assert len(frame) == 2
    assert set(frame["team"]) == {"A", "B"}
    assert frame["match_id"].nunique() == 1
    assert set(frame["source_count"]) == {1}


def test_historical_reader_rejects_conflicting_match_identity(monkeypatch):
    match = {
        "match_id": "m-pass",
        "league": "ENG-Championship",
        "season": "2526",
        "kickoff_at": "2026-03-01T15:00:00Z",
        "home_team": "A",
        "away_team": "B",
    }
    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )
    monkeypatch.setattr(
        reader,
        "_get_all",
        lambda table, select="*": [match, {**match, "away_team": "C"}]
        if table == "footy_matches" else [],
    )
    import pytest
    with pytest.raises(RuntimeError, match="Conflicting match records"):
        reader.historical_match_team_metrics()


def test_paginated_match_reads_are_deterministically_ordered(monkeypatch):
    requests_seen = []

    class Response:
        def raise_for_status(self):
            pass
        def json(self):
            return []

    def fake_get(url, params=None, headers=None, timeout=None):
        requests_seen.append((url, dict(params), dict(headers)))
        return Response()

    monkeypatch.setattr("footy_data.storage.requests.get", fake_get)
    reader = SupabaseRESTReader(
        url="https://example.supabase.co",
        service_role_key="secret",
    )
    reader._get_all_filtered("footy_matches", "match_id", {"league": "eq.ENG-Championship"})
    reader._get_all_filtered("footy_match_team_metrics", "match_id")
    assert requests_seen[0][1]["order"] == "match_id.asc"
    assert requests_seen[1][1]["order"] == "id.asc"
    assert all(row[2]["Range"] == "0-999" for row in requests_seen)
