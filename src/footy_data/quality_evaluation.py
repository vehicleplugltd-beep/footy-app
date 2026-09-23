from __future__ import annotations

import numpy as np
import pandas as pd

from .backtest import closing_line_value, multiclass_log_loss
from .value_backtest import devig_1x2, devig_two_way


def expected_calibration_error(
    probability: pd.Series,
    outcome: pd.Series,
    bins: int = 10,
) -> float:
    """Weighted absolute calibration error across equal-width probability bins."""
    frame = pd.DataFrame({
        "probability": pd.to_numeric(probability, errors="raise"),
        "outcome": pd.to_numeric(outcome, errors="raise"),
    }).dropna()
    if frame.empty:
        raise ValueError("Calibration frame contains no usable rows.")

    frame["bin"] = pd.cut(
        frame["probability"].clip(0.0, 1.0),
        bins=np.linspace(0.0, 1.0, bins + 1),
        include_lowest=True,
    )
    grouped = (
        frame.groupby("bin", observed=True)
        .agg(
            n=("outcome", "size"),
            mean_probability=("probability", "mean"),
            realized_rate=("outcome", "mean"),
        )
        .reset_index(drop=True)
    )
    total = float(grouped["n"].sum())
    return float(
        (
            grouped["n"] / total
            * (grouped["mean_probability"] - grouped["realized_rate"]).abs()
        ).sum()
    )


def multiclass_expected_calibration_error(
    probabilities: pd.DataFrame,
    actual: pd.Series,
    classes: tuple[str, ...] = ("home", "draw", "away"),
    bins: int = 10,
) -> float:
    """Macro-average one-vs-rest ECE for mutually exclusive outcomes."""
    missing = set(classes) - set(probabilities.columns)
    if missing:
        raise ValueError(f"Probability frame missing classes: {sorted(missing)}")
    labels = actual.astype(str)
    if not labels.isin(classes).all():
        raise ValueError("Actual labels contain an unsupported class.")

    return float(np.mean([
        expected_calibration_error(
            probabilities[label],
            (labels == label).astype(int),
            bins=bins,
        )
        for label in classes
    ]))


def benchmark_1x2_log_loss(
    close_prices: pd.DataFrame,
    outcomes: pd.DataFrame,
) -> float:
    """De-vigged closing-market multiclass log loss."""
    pivot = close_prices.pivot_table(
        index="match_id",
        columns="selection",
        values="decimal_odds",
        aggfunc="first",
    ).reset_index()
    if not {"home", "draw", "away"}.issubset(pivot.columns):
        raise ValueError("Closing 1X2 prices require home/draw/away.")

    rows = []
    for row in pivot.itertuples(index=False):
        market = devig_1x2(row.home, row.draw, row.away)
        rows.append({
            "match_id": row.match_id,
            "home": market.home,
            "draw": market.draw,
            "away": market.away,
        })
    joined = pd.DataFrame(rows).merge(
        outcomes[["match_id", "home_goals", "away_goals"]],
        on="match_id",
        how="inner",
        validate="one_to_one",
    )
    if joined.empty:
        raise ValueError("No overlapping closing 1X2 prices and outcomes.")

    actual = pd.Series(
        [
            "home" if hg > ag else "away" if hg < ag else "draw"
            for hg, ag in zip(joined["home_goals"], joined["away_goals"])
        ],
        index=joined.index,
    )
    return multiclass_log_loss(joined[["home", "draw", "away"]], actual)


def benchmark_total_2_5_log_loss(
    close_prices: pd.DataFrame,
    outcomes: pd.DataFrame,
) -> float:
    """De-vigged closing-market binary log loss for Over 2.5."""
    pivot = close_prices.pivot_table(
        index="match_id",
        columns="selection",
        values="decimal_odds",
        aggfunc="first",
    ).reset_index()
    if not {"over", "under"}.issubset(pivot.columns):
        raise ValueError("Closing total prices require over/under.")

    rows = []
    for row in pivot.itertuples(index=False):
        market = devig_two_way(row.over, row.under)
        rows.append({
            "match_id": row.match_id,
            "over_probability": market.first,
        })
    joined = pd.DataFrame(rows).merge(
        outcomes[["match_id", "home_goals", "away_goals"]],
        on="match_id",
        how="inner",
        validate="one_to_one",
    )
    if joined.empty:
        raise ValueError("No overlapping closing total prices and outcomes.")

    p = joined["over_probability"].clip(1e-9, 1 - 1e-9)
    y = (joined["home_goals"] + joined["away_goals"] >= 3).astype(int)
    return float((-(y * np.log(p) + (1 - y) * np.log(1 - p))).mean())


def qualified_clv(
    assessed_snapshot: pd.DataFrame,
    close_prices: pd.DataFrame,
) -> tuple[int, float | None]:
    """
    Mean snapshot-to-close CLV on independently qualified selections.

    At most one selection per match is retained: the qualifying selection with
    the greatest raw model EV, matching the settlement backtest's anti-stacking
    rule.
    """
    required = {
        "match_id", "selection", "decimal_odds", "raw_ev", "qualifies",
    }
    missing = required - set(assessed_snapshot.columns)
    if missing:
        raise ValueError(f"Assessed snapshot missing: {sorted(missing)}")

    bets = assessed_snapshot[assessed_snapshot["qualifies"]].copy()
    if bets.empty:
        return 0, None

    bets = (
        bets.sort_values(["match_id", "raw_ev"], ascending=[True, False])
        .drop_duplicates("match_id", keep="first")
        .rename(columns={"decimal_odds": "snapshot_odds"})
    )
    close = (
        close_prices[["match_id", "selection", "decimal_odds"]]
        .drop_duplicates(["match_id", "selection"])
        .rename(columns={"decimal_odds": "close_odds"})
    )
    joined = bets.merge(
        close,
        on=["match_id", "selection"],
        how="inner",
        validate="one_to_one",
    )
    if joined.empty:
        return 0, None

    clv = closing_line_value(joined["snapshot_odds"], joined["close_odds"])
    return int(len(joined)), float(clv.mean())
