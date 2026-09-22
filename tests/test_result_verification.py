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



def test_championship_provider_aliases_reconcile():
    matches = pd.DataFrame([
        {
            "match_id": "fotmob:qpr",
            "kickoff_at": "2025-08-09T14:00:00Z",
            "home_team": "Queens Park Rangers",
            "away_team": "Sheffield Wednesday",
        },
        {
            "match_id": "fotmob:wba",
            "kickoff_at": "2025-08-16T14:00:00Z",
            "home_team": "West Bromwich Albion",
            "away_team": "Blackburn Rovers",
        },
    ])
    metrics = pd.DataFrame([
        {"match_id": "fotmob:qpr", "team": "Queens Park Rangers", "home_away": "H", "goals": 1},
        {"match_id": "fotmob:qpr", "team": "Sheffield Wednesday", "home_away": "A", "goals": 0},
        {"match_id": "fotmob:wba", "team": "West Bromwich Albion", "home_away": "H", "goals": 2},
        {"match_id": "fotmob:wba", "team": "Blackburn Rovers", "home_away": "A", "goals": 2},
    ])
    external = pd.DataFrame([
        {"date": "09/08/2025", "home_team": "QPR", "away_team": "Sheffield Weds", "FTHG": 1, "FTAG": 0},
        {"date": "16/08/2025", "home_team": "West Brom", "away_team": "Blackburn", "FTHG": 2, "FTAG": 2},
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
