from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StrategyRule:
    strategy_id: str
    model_version: str
    market: str
    selection: str
    status: str
    target_ev: float = 0.02
    min_probability_edge: float | None = None
    min_model_probability: float | None = None
    max_decimal_odds: float | None = None
    min_raw_ev: float | None = None

    def qualifies(
        self,
        *,
        selection: str,
        model_probability: float,
        decimal_odds: float,
        raw_ev: float,
        probability_edge: float,
    ) -> bool:
        if selection != self.selection:
            return False
        if self.status != "APPROVED":
            return False
        if (
            self.min_probability_edge is not None
            and probability_edge < self.min_probability_edge
        ):
            return False
        if (
            self.min_model_probability is not None
            and model_probability < self.min_model_probability
        ):
            return False
        if (
            self.max_decimal_odds is not None
            and decimal_odds > self.max_decimal_odds
        ):
            return False
        if self.min_raw_ev is not None and raw_ev < self.min_raw_ev:
            return False
        return True
