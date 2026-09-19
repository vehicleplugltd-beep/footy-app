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


def summarize_qualified_1x2(
    assessed: pd.DataFrame,
    outcomes: pd.DataFrame,
) -> tuple[dict, pd.DataFrame]:
    """
    Settle qualifying historical 1X2 selections.

    If more than one selection clears the take-price threshold in the same
    match, keep only the largest raw-EV edge. This prevents correlated
    multi-selection stacking from overstating the backtest.
    """
    required_assessed = {
        "match_id", "selection", "decimal_odds", "raw_ev",
        "probability_edge", "qualifies", "market_overround",
    }
    missing = required_assessed - set(assessed.columns)
    if missing:
        raise ValueError(f"Assessed frame missing: {sorted(missing)}")

    required_outcomes = {"match_id", "home_goals", "away_goals"}
    missing = required_outcomes - set(outcomes.columns)
    if missing:
        raise ValueError(f"Outcome frame missing: {sorted(missing)}")

    bets = assessed[assessed["qualifies"]].copy()
    if bets.empty:
        return {
            "bets": 0,
            "strike_rate": None,
            "average_odds": None,
            "roi": None,
            "average_raw_ev": None,
            "average_probability_edge": None,
            "average_market_overround": None,
            "by_selection": {},
            "by_edge_bucket": {},
        }, bets

    bets = (
        bets.sort_values(
            ["match_id", "raw_ev"],
            ascending=[True, False],
        )
        .drop_duplicates("match_id", keep="first")
    )
    bets = bets.merge(
        outcomes[["match_id", "home_goals", "away_goals"]],
        on="match_id",
        how="inner",
        validate="one_to_one",
    )

    def won(row) -> int:
        if row["selection"] == "home":
            return int(row["home_goals"] > row["away_goals"])
        if row["selection"] == "draw":
            return int(row["home_goals"] == row["away_goals"])
        if row["selection"] == "away":
            return int(row["home_goals"] < row["away_goals"])
        raise ValueError(f"Unknown 1X2 selection: {row['selection']}")

    bets["won"] = bets.apply(won, axis=1)
    bets["profit"] = (
        bets["won"] * (bets["decimal_odds"] - 1.0)
        - (1 - bets["won"])
    )

    bets["edge_bucket"] = pd.cut(
        bets["raw_ev"],
        bins=[-float("inf"), 0.05, 0.10, 0.15, float("inf")],
        labels=["<5%", "5-10%", "10-15%", "15%+"],
        right=False,
    )

    def group_summary(group: pd.DataFrame) -> dict:
        return {
            "bets": int(len(group)),
            "strike_rate": float(group["won"].mean()),
            "average_odds": float(group["decimal_odds"].mean()),
            "roi": float(group["profit"].mean()),
            "average_raw_ev": float(group["raw_ev"].mean()),
            "average_probability_edge": float(
                group["probability_edge"].mean()
            ),
        }

    by_selection = {
        str(name): group_summary(group)
        for name, group in bets.groupby("selection", observed=True)
    }
    by_edge_bucket = {
        str(name): group_summary(group)
        for name, group in bets.groupby("edge_bucket", observed=True)
    }

    summary = {
        "bets": int(len(bets)),
        "strike_rate": float(bets["won"].mean()),
        "average_odds": float(bets["decimal_odds"].mean()),
        "roi": float(bets["profit"].mean()),
        "average_raw_ev": float(bets["raw_ev"].mean()),
        "average_probability_edge": float(
            bets["probability_edge"].mean()
        ),
        "average_market_overround": float(
            bets["market_overround"].mean()
        ),
        "by_selection": by_selection,
        "by_edge_bucket": by_edge_bucket,
    }
    return summary, bets
