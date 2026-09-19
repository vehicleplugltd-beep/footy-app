from __future__ import annotations

import pandas as pd


def ratings_for_match_dates(
    matches: pd.DataFrame,
    clubelo_reader,
) -> pd.DataFrame:
    """
    Build one Club Elo observation per team / match date.

    The input frame must contain team and match_date. The reader must expose
    read_team_history(team). Ratings are selected with a backward as-of join,
    so a fixture never sees a future Elo value.
    """
    required = {"team", "match_date"}
    missing = required - set(matches.columns)
    if missing:
        raise ValueError(f"Elo input missing columns: {sorted(missing)}")

    fixtures = matches.loc[:, ["team", "match_date"]].copy()
    fixtures["match_date"] = pd.to_datetime(fixtures["match_date"], utc=True)
    fixtures["rating_date"] = fixtures["match_date"].dt.floor("D")
    fixtures = fixtures.drop_duplicates(["team", "rating_date"])

    out = []
    for team, team_dates in fixtures.groupby("team", sort=True):
        history = clubelo_reader.read_team_history(str(team)).reset_index()
        if history.empty:
            continue

        if "from" not in history.columns or "elo" not in history.columns:
            raise ValueError(
                f"Club Elo history for {team} is missing from/elo columns."
            )

        history = history.copy()
        history["from"] = pd.to_datetime(history["from"], utc=True)
        history = history.sort_values("from").dropna(subset=["from", "elo"])

        dates = team_dates.sort_values("rating_date").copy()
        joined = pd.merge_asof(
            dates,
            history[["from", "elo"]].sort_values("from"),
            left_on="rating_date",
            right_on="from",
            direction="backward",
            allow_exact_matches=True,
        )
        joined = joined.dropna(subset=["elo"])
        joined["rating_type"] = "clubelo"
        joined["rating_value"] = pd.to_numeric(joined["elo"], errors="raise")
        joined["source"] = "clubelo"
        out.append(
            joined[
                ["team", "rating_type", "rating_value", "rating_date", "source"]
            ]
        )

    if not out:
        return pd.DataFrame(
            columns=[
                "team", "rating_type", "rating_value", "rating_date", "source"
            ]
        )
    return pd.concat(out, ignore_index=True)
