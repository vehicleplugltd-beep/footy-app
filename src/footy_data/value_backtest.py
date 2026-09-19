from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class Devigged1X2:
    home: float
    draw: float
    away: float
    overround: float


def devig_1x2(home_odds: float, draw_odds: float, away_odds: float) -> Devigged1X2:
    odds = [float(home_odds), float(draw_odds), float(away_odds)]
    if any(o <= 1.0 for o in odds):
        raise ValueError("Decimal odds must all be greater than 1.")

    raw = [1.0 / o for o in odds]
    total = sum(raw)
    return Devigged1X2(
        home=raw[0] / total,
        draw=raw[1] / total,
        away=raw[2] / total,
        overround=total - 1.0,
    )


def minimum_take_price(
    model_probability: float,
    uncertainty_haircut: float,
    target_ev: float = 0.02,
) -> float:
    if not 0 < model_probability <= 1:
        raise ValueError("model_probability must be in (0, 1].")
    if not 0 <= uncertainty_haircut < 1:
        raise ValueError("uncertainty_haircut must be in [0, 1).")
    conservative_probability = model_probability * (1 - uncertainty_haircut)
    return (1 + target_ev) / conservative_probability


def assess_1x2_history(
    predictions: pd.DataFrame,
    prices: pd.DataFrame,
    target_ev: float = 0.02,
) -> pd.DataFrame:
    """
    Join stored probabilities to one bookmaker/price-kind 1X2 price set.

    The output has one row per selection, with model fair price, de-vigged
    market probability, raw EV and uncertainty-adjusted minimum take price.
    """
    required_pred = {
        "match_id",
        "home_win_probability",
        "draw_probability",
        "away_win_probability",
        "uncertainty_haircut",
    }
    missing = required_pred - set(predictions.columns)
    if missing:
        raise ValueError(f"Prediction frame missing: {sorted(missing)}")

    required_price = {"match_id", "selection", "decimal_odds"}
    missing = required_price - set(prices.columns)
    if missing:
        raise ValueError(f"Price frame missing: {sorted(missing)}")

    price_pivot = prices.pivot_table(
        index="match_id",
        columns="selection",
        values="decimal_odds",
        aggfunc="first",
    ).reset_index()

    needed = {"home", "draw", "away"}
    if not needed.issubset(price_pivot.columns):
        raise ValueError("Each priced match needs home, draw, and away odds.")

    joined = predictions.merge(price_pivot, on="match_id", how="inner")
    rows = []

    for row in joined.itertuples(index=False):
        market = devig_1x2(row.home, row.draw, row.away)
        mapping = [
            (
                "home",
                float(row.home_win_probability),
                float(row.home),
                market.home,
            ),
            (
                "draw",
                float(row.draw_probability),
                float(row.draw),
                market.draw,
            ),
            (
                "away",
                float(row.away_win_probability),
                float(row.away),
                market.away,
            ),
        ]
        for selection, probability, odds, market_probability in mapping:
            fair = 1.0 / probability
            take = minimum_take_price(
                probability,
                float(row.uncertainty_haircut),
                target_ev=target_ev,
            )
            rows.append(
                {
                    "match_id": row.match_id,
                    "selection": selection,
                    "model_probability": probability,
                    "market_probability_devig": market_probability,
                    "probability_edge": probability - market_probability,
                    "fair_odds": fair,
                    "decimal_odds": odds,
                    "raw_ev": probability * odds - 1.0,
                    "minimum_take_price": take,
                    "qualifies": bool(odds >= take),
                    "market_overround": market.overround,
                }
            )

    return pd.DataFrame(rows)
