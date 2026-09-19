import pandas as pd

from footy_data.elo import ratings_for_match_dates


class FakeClubElo:
    def read_team_history(self, team):
        if team == "A":
            rows = [
                {"from": "2026-01-01", "elo": 1500},
                {"from": "2026-01-10", "elo": 1520},
            ]
        else:
            rows = [
                {"from": "2026-01-01", "elo": 1450},
                {"from": "2026-01-10", "elo": 1440},
            ]
        frame = pd.DataFrame(rows)
        frame["from"] = pd.to_datetime(frame["from"], utc=True)
        return frame.set_index("from")


def test_elo_uses_latest_rating_available_before_match():
    matches = pd.DataFrame([
        {"team": "A", "match_date": "2026-01-05T15:00:00Z"},
        {"team": "A", "match_date": "2026-01-12T15:00:00Z"},
        {"team": "B", "match_date": "2026-01-12T15:00:00Z"},
    ])

    out = ratings_for_match_dates(matches, FakeClubElo())
    a = out[out["team"] == "A"].sort_values("rating_date")
    assert a.iloc[0]["rating_value"] == 1500
    assert a.iloc[1]["rating_value"] == 1520
