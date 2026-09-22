from footy_data.normalizers.fotmob import normalise_fotmob_match
from footy_data.quality import assess_match_team_metrics


def _details():
    def stat(key, home, away):
        return {"key": key, "stats": [home, away]}

    return {
        "content": {
            "stats": {
                "Periods": {
                    "All": {
                        "stats": [
                            {
                                "key": "top_stats",
                                "stats": [
                                    stat("BallPossesion", 55, 45),
                                    stat("expected_goals", "1.97", "0.84"),
                                    stat("total_shots", 18, 10),
                                    stat("ShotsOnTarget", 3, 5),
                                    stat("touches_opp_box", 21, 17),
                                    stat("big_chance", 2, 1),
                                ],
                            },
                            {
                                "key": "expected_goals",
                                "stats": [
                                    stat("expected_goals_non_penalty", "1.18", "0.84"),
                                    stat("expected_goals_set_play", "0.25", "0.11"),
                                    stat("expected_goals_on_target", "1.19", "0.95"),
                                ],
                            },
                            {
                                "key": "shots",
                                "stats": [
                                    stat("shots_inside_box", 9, 6),
                                ],
                            },
                            {
                                "key": "passes",
                                "stats": [
                                    stat("accurate_crosses", "3 (16%)", "5 (26%)"),
                                    stat("opposition_half_passes", 203, 118),
                                ],
                            },
                        ]
                    }
                }
            }
        }
    }


def test_normalise_fotmob_match_maps_verified_process_fields():
    match = {
        "id": 12345,
        "home": {"name": "Hull City", "score": 2},
        "away": {"name": "Southampton", "score": 1},
        "status": {
            "finished": True,
            "utcTime": "2026-08-15T19:45:00.000Z",
            "scoreStr": "2 - 1",
        },
    }

    matches, metrics = normalise_fotmob_match(
        match,
        _details(),
        league="ENG-Championship",
        season="2627",
        retrieved_at="2026-09-22T06:00:00+00:00",
    )

    assert len(matches) == 1
    assert matches.iloc[0]["match_id"] == "fotmob:12345"
    assert matches.iloc[0]["league"] == "ENG-Championship"

    assert len(metrics) == 2
    home = metrics[metrics["home_away"] == "H"].iloc[0]
    away = metrics[metrics["home_away"] == "A"].iloc[0]

    assert home["team"] == "Hull City"
    assert home["xg"] == 1.97
    assert home["xga"] == 0.84
    assert home["npxg"] == 1.18
    assert home["shots"] == 18
    assert home["shots_on_target"] == 3
    assert home["shots_conceded"] == 10
    assert home["big_chances"] == 2
    assert home["box_touches"] == 21
    assert home["set_piece_xg"] == 0.25
    assert home["xgot"] == 1.19
    assert home["xgot_faced"] == 0.95
    assert home["crosses"] == 3
    assert home["opposition_half_passes"] == 203
    assert bool(home["verified"]) is False
    assert home["verification_status"] == "WARN"
    assert home["verified_at"] is None

    assert away["xg"] == 0.84
    assert away["xga"] == 1.97
    assert away["goals"] == 1
    assert away["goals_conceded"] == 2


def test_fotmob_process_frame_passes_quality_gate():
    match = {
        "id": 12345,
        "home": {"name": "Hull City", "score": 2},
        "away": {"name": "Southampton", "score": 1},
        "status": {"utcTime": "2026-08-15T19:45:00.000Z"},
    }
    _, metrics = normalise_fotmob_match(
        match,
        _details(),
        league="ENG-Championship",
        season="2627",
    )
    report = assess_match_team_metrics(metrics)
    assert report.usable
    assert report.duplicate_rows == 0


def test_fotmob_normalizer_rejects_missing_score():
    match = {
        "id": 12345,
        "home": {"name": "Hull City"},
        "away": {"name": "Southampton"},
        "status": {"utcTime": "2026-08-15T19:45:00.000Z"},
    }

    try:
        normalise_fotmob_match(
            match,
            _details(),
            league="ENG-Championship",
            season="2627",
        )
    except ValueError as exc:
        assert "final score" in str(exc)
    else:
        raise AssertionError("expected missing final score to be rejected")
