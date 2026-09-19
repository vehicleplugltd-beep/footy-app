from __future__ import annotations

from dataclasses import dataclass


VALID_STATUSES = {"APPROVED", "WATCH", "RESEARCH", "PASS"}


@dataclass(frozen=True)
class ModelMarketValidation:
    model_version: str
    market: str
    status: str
    sample_size: int
    model_log_loss: float | None = None
    benchmark_log_loss: float | None = None
    close_roi: float | None = None
    clv_proxy: float | None = None
    bookmaker_reference: str | None = None
    notes: str | None = None

    def __post_init__(self) -> None:
        if self.status not in VALID_STATUSES:
            raise ValueError(
                f"Unknown validation status {self.status!r}. "
                f"Expected one of {sorted(VALID_STATUSES)}."
            )
        if self.sample_size < 0:
            raise ValueError("sample_size must be non-negative.")


def gate_verdict(raw_verdict: str, validation_status: str) -> str:
    """
    Enforce model/market validation before a live recommendation.

    Only APPROVED model-market pairs may return BET or FADE.
    WATCH/RESEARCH models may surface a positive-price concept as WATCH,
    but cannot automatically authorize a bet.
    """
    if validation_status not in VALID_STATUSES:
        raise ValueError(
            f"Unknown validation status {validation_status!r}."
        )

    if validation_status == "APPROVED":
        return raw_verdict

    if validation_status == "PASS":
        return "PASS"

    if raw_verdict in {"BET", "WATCH"}:
        return "WATCH"

    return "PASS"
