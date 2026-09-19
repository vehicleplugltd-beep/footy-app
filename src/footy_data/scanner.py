from __future__ import annotations

from dataclasses import dataclass, replace

from .markets import SettlementWeights
from .validation import gate_verdict


@dataclass(frozen=True)
class MarketAssessment:
    market: str
    selection: str
    current_odds: float
    fair_odds: float
    minimum_take_price: float
    expected_value: float
    verdict: str
    raw_verdict: str | None = None
    validation_status: str | None = None


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
        market=market,
        selection=selection,
        current_odds=current_odds,
        fair_odds=fair,
        minimum_take_price=take,
        expected_value=ev,
        verdict=verdict,
        raw_verdict=verdict,
    )


def apply_model_validation(
    assessment: MarketAssessment,
    validation_status: str,
) -> MarketAssessment:
    """
    Apply the model-market production gate to a raw price assessment.

    The statistical price calculation remains visible in raw_verdict, while
    verdict is the production-safe decision after historical validation.
    """
    raw = assessment.raw_verdict or assessment.verdict
    gated = gate_verdict(raw, validation_status)
    return replace(
        assessment,
        verdict=gated,
        raw_verdict=raw,
        validation_status=validation_status,
    )
