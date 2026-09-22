from __future__ import annotations

from dataclasses import dataclass, replace

from .markets import SettlementWeights
from .quality_gate import (
    QualityGatePolicy,
    QualitySnapshot,
    evaluate_quality_gate,
)
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


def apply_quality_snapshot(
    assessment: MarketAssessment,
    snapshot: QualitySnapshot,
    policy: QualityGatePolicy = QualityGatePolicy(),
) -> MarketAssessment:
    """
    Gate a live price decision using the latest league x market quality record.

    The scanner never upgrades a raw verdict. READY may preserve BET/FADE,
    LIMITED can only surface WATCH, and BLOCKED forces PASS.
    """
    if assessment.market != snapshot.market:
        raise ValueError(
            "Assessment market and quality snapshot market must match: "
            f"{assessment.market!r} != {snapshot.market!r}."
        )

    quality = evaluate_quality_gate(snapshot, policy=policy)
    return apply_model_validation(
        assessment,
        validation_status=quality.validation_status,
    )
