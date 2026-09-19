from __future__ import annotations

from dataclasses import dataclass
from .markets import SettlementWeights


@dataclass(frozen=True)
class MarketAssessment:
    market: str
    selection: str
    current_odds: float
    fair_odds: float
    minimum_take_price: float
    expected_value: float
    verdict: str


def assess_market(
    market: str,
    selection: str,
    current_odds: float,
    weights: SettlementWeights,
    uncertainty_haircut: float,
    target_ev: float = 0.02,
    fade_ratio: float = 0.92,
) -> MarketAssessment:
    fair = weights.fair_odds
    take = weights.minimum_take_price(uncertainty_haircut, target_ev)
    ev = weights.expected_value(current_odds)
    if current_odds >= take:
        verdict = "BET"
    elif current_odds >= fair:
        verdict = "WATCH"
    elif current_odds <= fair * fade_ratio:
        verdict = "FADE"
    else:
        verdict = "PASS"
    return MarketAssessment(
        market, selection, current_odds, fair, take, ev, verdict
    )
