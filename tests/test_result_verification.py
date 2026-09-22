import pandas as pd

from footy_data.result_verification import verify_external_results


def test_external_result_verification_passes_exact_scores():
    matches = pd.DataFrame([
        {
            "match_id": "fotmob:1",
            "kickoff_at": "2025-08-08T19:00:00Z",
            "home_team": "Hull City",
            "away_team": "Ipswich Town",
        }
    ])
    metrics = pd.DataFrame([
        {
            "match_id": "fotmob:1",
            "team": "Hull City",
            "home_away": "H",
            "goals": 2,
        },
        {
            "match_id": "fotmob:1",
            "team": "Ipswich Town",
            "home_away": "A",
            "goals": 1,
        },
    ])
    external = pd.DataFrame([
        {
            "date": "08/08/2025",
            "home_team": "Hull",
            "away_team": "Ipswich",
            "FTHG": 2,
            "FTAG": 1,
        }
    ])

    report = verify_external_results(
        matches,
        metrics,
        external,
        minimum_match_rate=0.95,
    )

    assert report.match_rate == 1.0
    assert report.score_mismatches == 0
    assert report.status == "PASS"
    assert report.matched_match_ids == ("fotmob:1",)


def test_external_result_verification_blocks_score_mismatch():
    matches = pd.DataFrame([
        {
            "match_id": "fotmob:1",
            "kickoff_at": "2025-08-08T19:00:00Z",
            "home_team": "Hull City",
            "away_team": "Ipswich Town",
        }
    ])
    metrics = pd.DataFrame([
        {"match_id": "fotmob:1", "team": "Hull City", "home_away": "H", "goals": 2},
        {"match_id": "fotmob:1", "team": "Ipswich Town", "home_away": "A", "goals": 1},
    ])
    external = pd.DataFrame([
        {
            "date": "08/08/2025",
            "home_team": "Hull",
            "away_team": "Ipswich",
            "FTHG": 1,
            "FTAG": 1,
        }
    ])

    report = verify_external_results(matches, metrics, external)
    assert report.status == "BLOCKED"
    assert report.score_mismatches == 1
    assert report.matched_match_ids == ()
