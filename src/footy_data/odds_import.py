from __future__ import annotations

import hashlib
from dataclasses import dataclass

import pandas as pd

from .identity import default_resolver
from .normalise import canonical_text


@dataclass(frozen=True)
class OddsImportReport:
    footy_matches: int
    matched_matches: int
    unmatched_matches: int
    match_rate: float
    price_rows: int


KNOWN_1X2_COLUMN_SETS = [
    ("home_close", "draw_close", "away_close"),
    ("OddHome", "OddDraw", "OddAway"),
    ("B365CH", "B365CD", "B365CA"),
    ("B365H", "B365D", "B365A"),
    ("AvgH", "AvgD", "AvgA"),
    ("MaxH", "MaxD", "MaxA"),
]


def _team_key(value: object) -> str:
    resolved = default_resolver().resolve(str(value))
    return canonical_text(resolved)


def detect_1x2_columns(frame: pd.DataFrame) -> tuple[str, str, str]:
    columns = set(frame.columns)
    for candidate in KNOWN_1X2_COLUMN_SETS:
        if set(candidate).issubset(columns):
            return candidate
    raise ValueError(
        "Could not detect 1X2 odds columns. Pass explicit home/draw/away columns."
    )


def _price_key(
    match_id: str,
    bookmaker: str,
    market: str,
    selection: str,
    line: float | None,
    price_kind: str,
    source: str,
) -> str:
    raw = "|".join(
        [
            str(match_id),
            bookmaker,
            market,
            selection,
            "" if line is None else str(line),
            price_kind,
            source,
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def normalise_1x2_prices(
    external: pd.DataFrame,
    footy_metrics: pd.DataFrame,
    bookmaker: str,
    source: str,
    price_kind: str,
    date_col: str = "Date",
    home_team_col: str = "HomeTeam",
    away_team_col: str = "AwayTeam",
    home_odds_col: str | None = None,
    draw_odds_col: str | None = None,
    away_odds_col: str | None = None,
) -> tuple[pd.DataFrame, OddsImportReport]:
    if price_kind not in {"open", "close", "snapshot"}:
        raise ValueError("price_kind must be open, close, or snapshot.")

    required_external = {date_col, home_team_col, away_team_col}
    missing = required_external - set(external.columns)
    if missing:
        raise ValueError(f"Odds CSV missing columns: {sorted(missing)}")

    required_footy = {"match_id", "match_date", "team", "home_away"}
    missing = required_footy - set(footy_metrics.columns)
    if missing:
        raise ValueError(f"Footy frame missing columns: {sorted(missing)}")

    if not all([home_odds_col, draw_odds_col, away_odds_col]):
        detected = detect_1x2_columns(external)
        home_odds_col, draw_odds_col, away_odds_col = detected

    for col in (home_odds_col, draw_odds_col, away_odds_col):
        if col not in external.columns:
            raise ValueError(f"Odds CSV missing price column: {col}")

    ext = external.copy()
    ext["match_date_key"] = pd.to_datetime(
        ext[date_col], errors="coerce", dayfirst=True, utc=True
    ).dt.floor("D")
    ext["home_key"] = ext[home_team_col].map(_team_key)
    ext["away_key"] = ext[away_team_col].map(_team_key)
    ext["price_home"] = pd.to_numeric(ext[home_odds_col], errors="coerce")
    ext["price_draw"] = pd.to_numeric(ext[draw_odds_col], errors="coerce")
    ext["price_away"] = pd.to_numeric(ext[away_odds_col], errors="coerce")
    ext = ext.dropna(
        subset=[
            "match_date_key",
            "price_home",
            "price_draw",
            "price_away",
        ]
    )
    ext = ext[
        (ext["price_home"] > 1)
        & (ext["price_draw"] > 1)
        & (ext["price_away"] > 1)
    ]

    footy = footy_metrics.copy()
    footy["match_date"] = pd.to_datetime(
        footy["match_date"], errors="coerce", utc=True
    )
    footy["match_date_key"] = footy["match_date"].dt.floor("D")

    home = (
        footy[footy["home_away"] == "H"]
        [["match_id", "match_date", "match_date_key", "team"]]
        .rename(columns={"team": "home_team"})
    )
    away = (
        footy[footy["home_away"] == "A"]
        [["match_id", "match_date_key", "team"]]
        .rename(columns={"team": "away_team"})
    )
    matches = home.merge(
        away,
        on=["match_id", "match_date_key"],
        how="inner",
        validate="one_to_one",
    )
    matches["home_key"] = matches["home_team"].map(_team_key)
    matches["away_key"] = matches["away_team"].map(_team_key)

    joined = matches.merge(
        ext[
            [
                "match_date_key",
                "home_key",
                "away_key",
                "price_home",
                "price_draw",
                "price_away",
            ]
        ],
        on=["match_date_key", "home_key", "away_key"],
        how="left",
        validate="one_to_one",
    )

    matched = joined.dropna(
        subset=["price_home", "price_draw", "price_away"]
    ).copy()

    records: list[dict] = []
    for row in matched.itertuples(index=False):
        for selection, odds in (
            ("home", row.price_home),
            ("draw", row.price_draw),
            ("away", row.price_away),
        ):
            records.append(
                {
                    "price_key": _price_key(
                        str(row.match_id),
                        bookmaker,
                        "1X2",
                        selection,
                        None,
                        price_kind,
                        source,
                    ),
                    "match_id": str(row.match_id),
                    "bookmaker": bookmaker,
                    "market": "1X2",
                    "selection": selection,
                    "line": None,
                    "decimal_odds": float(odds),
                    "price_kind": price_kind,
                    "source": source,
                    "captured_at": row.match_date,
                }
            )

    prices = pd.DataFrame(records)
    report = OddsImportReport(
        footy_matches=int(len(matches)),
        matched_matches=int(len(matched)),
        unmatched_matches=int(len(matches) - len(matched)),
        match_rate=float(len(matched) / len(matches)) if len(matches) else 0.0,
        price_rows=int(len(prices)),
    )
    return prices, report
