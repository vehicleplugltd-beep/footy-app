from __future__ import annotations

import pandas as pd

from .identity import default_resolver
from .normalise import canonical_text


def _team_key(name: object) -> str:
    resolver = default_resolver()
    resolved = resolver.resolve(str(name))
    return canonical_text(resolved)


def ratings_from_match_dataset(
    external: pd.DataFrame,
    footy_metrics: pd.DataFrame,
    division: str = "E0",
    source: str = "xgabora-club-football-match-data",
) -> tuple[pd.DataFrame, dict]:
    """
    Reconcile an external match dataset containing HomeElo/AwayElo to Footy.

    Matching is strict after explicit team alias normalization:
    match date + home team + away team.
    """
    required_external = {
        "Division", "MatchDate", "HomeTeam", "AwayTeam", "HomeElo", "AwayElo"
    }
    missing = required_external - set(external.columns)
    if missing:
        raise ValueError(
            f"External Elo dataset missing columns: {sorted(missing)}"
        )

    required_footy = {
        "match_id", "match_date", "team", "home_away"
    }
    missing = required_footy - set(footy_metrics.columns)
    if missing:
        raise ValueError(
            f"Footy frame missing columns: {sorted(missing)}"
        )

    ext = external[external["Division"] == division].copy()
    ext["rating_date"] = pd.to_datetime(
        ext["MatchDate"], errors="coerce", utc=True
    ).dt.floor("D")
    ext["home_key"] = ext["HomeTeam"].map(_team_key)
    ext["away_key"] = ext["AwayTeam"].map(_team_key)
    ext["HomeElo"] = pd.to_numeric(ext["HomeElo"], errors="coerce")
    ext["AwayElo"] = pd.to_numeric(ext["AwayElo"], errors="coerce")
    ext = ext.dropna(
        subset=["rating_date", "HomeElo", "AwayElo"]
    )

    footy = footy_metrics.copy()
    footy["rating_date"] = pd.to_datetime(
        footy["match_date"], errors="coerce", utc=True
    ).dt.floor("D")

    home = (
        footy[footy["home_away"] == "H"]
        [["match_id", "rating_date", "team"]]
        .rename(columns={"team": "home_team"})
    )
    away = (
        footy[footy["home_away"] == "A"]
        [["match_id", "rating_date", "team"]]
        .rename(columns={"team": "away_team"})
    )
    matches = home.merge(
        away,
        on=["match_id", "rating_date"],
        how="inner",
        validate="one_to_one",
    )
    matches["home_key"] = matches["home_team"].map(_team_key)
    matches["away_key"] = matches["away_team"].map(_team_key)

    joined = matches.merge(
        ext[
            [
                "rating_date", "home_key", "away_key",
                "HomeElo", "AwayElo"
            ]
        ],
        on=["rating_date", "home_key", "away_key"],
        how="left",
        validate="one_to_one",
    )

    matched = joined.dropna(subset=["HomeElo", "AwayElo"]).copy()

    home_ratings = pd.DataFrame({
        "team": matched["home_team"],
        "rating_type": "clubelo",
        "rating_value": matched["HomeElo"],
        "rating_date": matched["rating_date"],
        "source": source,
    })
    away_ratings = pd.DataFrame({
        "team": matched["away_team"],
        "rating_type": "clubelo",
        "rating_value": matched["AwayElo"],
        "rating_date": matched["rating_date"],
        "source": source,
    })
    ratings = pd.concat(
        [home_ratings, away_ratings],
        ignore_index=True,
    ).drop_duplicates(
        ["team", "rating_type", "rating_date", "source"]
    )

    report = {
        "footy_matches": int(len(matches)),
        "matched_matches": int(len(matched)),
        "unmatched_matches": int(len(matches) - len(matched)),
        "match_rate": float(len(matched) / len(matches)) if len(matches) else 0.0,
        "ratings": int(len(ratings)),
    }
    return ratings, report
