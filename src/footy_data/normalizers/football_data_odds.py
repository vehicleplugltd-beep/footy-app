from __future__ import annotations

from datetime import datetime, timezone
import pandas as pd


PRICE_SPECS = {
    "Market Average": {
        ("1X2", "HOME"): "AvgH",
        ("1X2", "DRAW"): "AvgD",
        ("1X2", "AWAY"): "AvgA",
        ("TOTAL_2.5", "OVER"): "Avg>2.5",
        ("TOTAL_2.5", "UNDER"): "Avg<2.5",
    },
    "Market Maximum": {
        ("1X2", "HOME"): "MaxH",
        ("1X2", "DRAW"): "MaxD",
        ("1X2", "AWAY"): "MaxA",
        ("TOTAL_2.5", "OVER"): "Max>2.5",
        ("TOTAL_2.5", "UNDER"): "Max<2.5",
    },
    "Bet365": {
        ("1X2", "HOME"): "B365H",
        ("1X2", "DRAW"): "B365D",
        ("1X2", "AWAY"): "B365A",
        ("TOTAL_2.5", "OVER"): "B365>2.5",
        ("TOTAL_2.5", "UNDER"): "B365<2.5",
    },
    "William Hill": {
        ("1X2", "HOME"): "WHH",
        ("1X2", "DRAW"): "WHD",
        ("1X2", "AWAY"): "WHA",
        ("TOTAL_2.5", "OVER"): "WH>2.5",
        ("TOTAL_2.5", "UNDER"): "WH<2.5",
    },
}


def normalise_football_data_odds(
    games: pd.DataFrame,
    retrieved_at: str | None = None,
) -> pd.DataFrame:
    """Convert Football-Data.co.uk historical odds columns to long form."""
    required = {"game", "date", "home_team", "away_team"}
    missing = required - set(games.columns)
    if missing:
        raise ValueError(
            f"Football-Data frame missing columns: {sorted(missing)}"
        )

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []

    for _, match in games.iterrows():
        for bookmaker, specs in PRICE_SPECS.items():
            for (market, selection), col in specs.items():
                if col not in games.columns:
                    continue
                value = pd.to_numeric(match.get(col), errors="coerce")
                if pd.isna(value) or float(value) <= 1.0:
                    continue

                rows.append({
                    "match_id": str(match["game"]),
                    "bookmaker": bookmaker,
                    "market": market,
                    "selection": selection,
                    "line": 2.5 if market == "TOTAL_2.5" else None,
                    "decimal_odds": float(value),
                    "captured_at": pd.Timestamp(match["date"]).isoformat(),
                    "retrieved_at": stamp,
                })

    return pd.DataFrame(rows)
