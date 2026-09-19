from __future__ import annotations

from dataclasses import dataclass
import math
import pandas as pd


@dataclass(frozen=True)
class BacktestSummary:
    bets: int
    strike_rate: float
    average_odds: float
    roi: float
    average_ev: float
    brier_score: float
    log_loss: float


def binary_metrics(
    probability: pd.Series,
    outcome: pd.Series,
) -> tuple[float, float]:
    p = pd.to_numeric(probability, errors="raise").clip(1e-9, 1 - 1e-9)
    y = pd.to_numeric(outcome, errors="raise")
    brier = float(((p - y) ** 2).mean())
    log_loss = float((-(y * p.map(math.log) + (1 - y) * (1 - p).map(math.log))).mean())
    return brier, log_loss


def calibration_table(
    probability: pd.Series,
    outcome: pd.Series,
    bins: int = 10,
) -> pd.DataFrame:
    frame = pd.DataFrame({
        "probability": pd.to_numeric(probability, errors="raise"),
        "outcome": pd.to_numeric(outcome, errors="raise"),
    }).dropna()

    frame["bin"] = pd.cut(
        frame["probability"],
        bins=[i / bins for i in range(bins + 1)],
        include_lowest=True,
    )

    return (
        frame.groupby("bin", observed=False)
        .agg(
            bets=("outcome", "size"),
            mean_model_probability=("probability", "mean"),
            realized_rate=("outcome", "mean"),
        )
        .reset_index()
    )


def settled_profit(
    won: pd.Series,
    decimal_odds: pd.Series,
    stake: float = 1.0,
) -> pd.Series:
    y = pd.to_numeric(won, errors="raise")
    odds = pd.to_numeric(decimal_odds, errors="raise")
    return y * stake * (odds - 1.0) - (1 - y) * stake


def summarize_binary_bets(
    frame: pd.DataFrame,
    probability_col: str = "model_probability",
    outcome_col: str = "won",
    odds_col: str = "decimal_odds",
) -> BacktestSummary:
    required = {probability_col, outcome_col, odds_col}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Backtest frame missing columns: {sorted(missing)}")

    work = frame.dropna(subset=list(required)).copy()
    if work.empty:
        raise ValueError("Backtest frame contains no usable rows.")

    p = pd.to_numeric(work[probability_col], errors="raise")
    y = pd.to_numeric(work[outcome_col], errors="raise")
    odds = pd.to_numeric(work[odds_col], errors="raise")

    profit = settled_profit(y, odds)
    brier, log_loss = binary_metrics(p, y)

    return BacktestSummary(
        bets=len(work),
        strike_rate=float(y.mean()),
        average_odds=float(odds.mean()),
        roi=float(profit.sum() / len(work)),
        average_ev=float((p * odds - 1).mean()),
        brier_score=brier,
        log_loss=log_loss,
    )


def closing_line_value(
    bet_odds: pd.Series,
    closing_odds: pd.Series,
) -> pd.Series:
    """
    Decimal-odds CLV ratio.

    Positive values mean the bet was taken at a better price than close:
      2.20 taken vs 2.00 close -> +10% CLV.
    """
    bet = pd.to_numeric(bet_odds, errors="raise")
    close = pd.to_numeric(closing_odds, errors="raise")
    return bet / close - 1.0
