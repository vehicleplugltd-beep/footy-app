import pandas as pd

from footy_data.storage import SupabaseRESTWriter, frame_records


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



def test_writer_inserts_model_quality_snapshot(monkeypatch):
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
    writer.insert_model_quality_snapshots([{
        "league": "ENG-Championship",
        "market": "1X2",
        "model_version": "wf-v1",
        "sample_size": 500,
        "data_completeness": 0.99,
        "model_log_loss": 0.94,
        "benchmark_log_loss": 1.0,
        "calibration_error": 0.04,
        "price_sample_size": 120,
        "mean_clv": 0.01,
        "realized_roi": 0.03,
        "gate_status": "READY",
        "validation_status": "APPROVED",
        "reasons": ["all READY quality gates passed"],
        "policy": {"min_model_sample": 250},
        "ignored": "not persisted",
    }])

    assert captured["url"].endswith(
        "/rest/v1/footy_model_quality_snapshots"
    )
    assert captured["headers"]["Authorization"] == "Bearer secret"
    assert captured["json"][0]["league"] == "ENG-Championship"
    assert "ignored" not in captured["json"][0]
