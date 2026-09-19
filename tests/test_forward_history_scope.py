import pandas as pd


def _scope(frame, league, seasons):
    out = frame[frame["league"] == league].copy()
    if seasons:
        wanted = {str(s) for s in seasons}
        out = out[out["season"].astype(str).isin(wanted)].copy()
    return out


def test_forward_history_scope_excludes_unvalidated_old_seasons():
    frame = pd.DataFrame([
        {"league": "ENG-Premier League", "season": "1819", "team": "A"},
        {"league": "ENG-Premier League", "season": "2223", "team": "A"},
        {"league": "ENG-Premier League", "season": "2526", "team": "A"},
        {"league": "ENG-Premier League", "season": "2627", "team": "A"},
    ])
    out = _scope(
        frame,
        "ENG-Premier League",
        ["2223", "2526", "2627"],
    )
    assert set(out["season"]) == {"2223", "2526", "2627"}
    assert "1819" not in set(out["season"])
