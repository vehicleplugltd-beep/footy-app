from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


CORE_TEN_LEAGUES = (
    "Premier League",
    "Championship",
    "La Liga",
    "Segunda Division",
    "Bundesliga",
    "2. Bundesliga",
    "Serie A",
    "Serie B",
    "Ligue 1",
    "Ligue 2",
)

CORE_REQUIRED_MARKETS = ("1X2", "TOTAL_2_5")

GATE_STATUSES = {"READY", "LIMITED", "BLOCKED"}
VALIDATION_STATUS_BY_GATE = {
    "READY": "APPROVED",
    "LIMITED": "WATCH",
    "BLOCKED": "PASS",
}


@dataclass(frozen=True)
class QualityGatePolicy:
    """Conservative defaults for promoting a league/market into live betting."""

    min_model_sample: int = 250
    min_price_sample: int = 75
    min_data_completeness: float = 0.97
    max_calibration_error: float = 0.06
    max_log_loss_ratio: float = 1.00
    max_log_loss_regression_ratio: float = 0.01
    max_calibration_regression: float = 0.01
    min_mean_clv: float = -0.005
    max_clv_regression: float = 0.01

    limited_min_model_sample: int = 125
    limited_min_price_sample: int = 40
    limited_min_data_completeness: float = 0.94
    limited_max_calibration_error: float = 0.09
    limited_max_log_loss_ratio: float = 1.03
    limited_min_mean_clv: float = -0.02


@dataclass(frozen=True)
class QualitySnapshot:
    league: str
    market: str
    model_version: str
    sample_size: int
    data_completeness: float
    model_log_loss: float
    benchmark_log_loss: float
    calibration_error: float
    price_sample_size: int = 0
    mean_clv: float | None = None
    realized_roi: float | None = None
    previous_model_log_loss: float | None = None
    previous_calibration_error: float | None = None
    previous_mean_clv: float | None = None

    def __post_init__(self) -> None:
        if self.sample_size < 0 or self.price_sample_size < 0:
            raise ValueError("sample sizes must be non-negative.")
        if not 0 <= self.data_completeness <= 1:
            raise ValueError("data_completeness must be in [0, 1].")
        if self.model_log_loss <= 0 or self.benchmark_log_loss <= 0:
            raise ValueError("log-loss values must be positive.")
        if self.calibration_error < 0:
            raise ValueError("calibration_error must be non-negative.")


@dataclass(frozen=True)
class QualityGateResult:
    league: str
    market: str
    model_version: str
    status: str
    validation_status: str
    reasons: tuple[str, ...]
    log_loss_ratio: float
    model_log_loss_delta: float | None
    calibration_error_delta: float | None
    mean_clv_delta: float | None

    def __post_init__(self) -> None:
        if self.status not in GATE_STATUSES:
            raise ValueError(f"Unknown gate status: {self.status!r}.")


@dataclass(frozen=True)
class ExpansionDecision:
    allowed: bool
    reasons: tuple[str, ...]


def _relative_regression(current: float, previous: float | None) -> float | None:
    if previous is None:
        return None
    if previous <= 0:
        raise ValueError("previous metric must be positive.")
    return (current - previous) / previous


def evaluate_quality_gate(
    snapshot: QualitySnapshot,
    policy: QualityGatePolicy = QualityGatePolicy(),
) -> QualityGateResult:
    """
    Convert a historical validation snapshot into a production gate.

    READY is intentionally hard to earn: the model must have enough history,
    beat the benchmark on log loss, be calibrated, avoid material regression,
    and demonstrate acceptable price selection through CLV.

    ROI is retained in the snapshot for diagnostics but is not a hard promotion
    criterion because short-run ROI is substantially noisier than probability
    quality and closing-line value.
    """
    log_loss_ratio = snapshot.model_log_loss / snapshot.benchmark_log_loss
    log_loss_delta = _relative_regression(
        snapshot.model_log_loss,
        snapshot.previous_model_log_loss,
    )
    calibration_delta = (
        None
        if snapshot.previous_calibration_error is None
        else snapshot.calibration_error - snapshot.previous_calibration_error
    )
    clv_delta = (
        None
        if snapshot.mean_clv is None or snapshot.previous_mean_clv is None
        else snapshot.mean_clv - snapshot.previous_mean_clv
    )

    ready_failures: list[str] = []
    if snapshot.sample_size < policy.min_model_sample:
        ready_failures.append("model sample below READY minimum")
    if snapshot.data_completeness < policy.min_data_completeness:
        ready_failures.append("data completeness below READY minimum")
    if log_loss_ratio > policy.max_log_loss_ratio:
        ready_failures.append("model log loss does not beat benchmark")
    if snapshot.calibration_error > policy.max_calibration_error:
        ready_failures.append("calibration error above READY maximum")
    if (
        log_loss_delta is not None
        and log_loss_delta > policy.max_log_loss_regression_ratio
    ):
        ready_failures.append("model log loss regressed materially")
    if (
        calibration_delta is not None
        and calibration_delta > policy.max_calibration_regression
    ):
        ready_failures.append("calibration regressed materially")
    if snapshot.price_sample_size < policy.min_price_sample:
        ready_failures.append("price-selection sample below READY minimum")
    if snapshot.mean_clv is None:
        ready_failures.append("closing-line value unavailable")
    elif snapshot.mean_clv < policy.min_mean_clv:
        ready_failures.append("closing-line value below READY minimum")
    if (
        clv_delta is not None
        and clv_delta < -policy.max_clv_regression
    ):
        ready_failures.append("closing-line value regressed materially")

    if not ready_failures:
        status = "READY"
        reasons = ("all READY quality gates passed",)
    else:
        limited_failures: list[str] = []
        if snapshot.sample_size < policy.limited_min_model_sample:
            limited_failures.append("model sample below LIMITED minimum")
        if snapshot.data_completeness < policy.limited_min_data_completeness:
            limited_failures.append("data completeness below LIMITED minimum")
        if log_loss_ratio > policy.limited_max_log_loss_ratio:
            limited_failures.append("model log loss too weak for LIMITED")
        if snapshot.calibration_error > policy.limited_max_calibration_error:
            limited_failures.append("calibration error too high for LIMITED")
        if snapshot.price_sample_size < policy.limited_min_price_sample:
            limited_failures.append("price-selection sample below LIMITED minimum")
        if (
            snapshot.mean_clv is not None
            and snapshot.mean_clv < policy.limited_min_mean_clv
        ):
            limited_failures.append("closing-line value too weak for LIMITED")
        if (
            log_loss_delta is not None
            and log_loss_delta > 2 * policy.max_log_loss_regression_ratio
        ):
            limited_failures.append("model quality regression exceeds tolerance")
        if (
            calibration_delta is not None
            and calibration_delta > 2 * policy.max_calibration_regression
        ):
            limited_failures.append("calibration regression exceeds tolerance")
        if (
            clv_delta is not None
            and clv_delta < -2 * policy.max_clv_regression
        ):
            limited_failures.append("price-selection regression exceeds tolerance")

        if limited_failures:
            status = "BLOCKED"
            reasons = tuple(limited_failures)
        else:
            status = "LIMITED"
            reasons = tuple(ready_failures)

    return QualityGateResult(
        league=snapshot.league,
        market=snapshot.market,
        model_version=snapshot.model_version,
        status=status,
        validation_status=VALIDATION_STATUS_BY_GATE[status],
        reasons=reasons,
        log_loss_ratio=float(log_loss_ratio),
        model_log_loss_delta=log_loss_delta,
        calibration_error_delta=calibration_delta,
        mean_clv_delta=clv_delta,
    )


def expansion_decision(
    results: Iterable[QualityGateResult],
    required_leagues: tuple[str, ...] = CORE_TEN_LEAGUES,
    required_markets: tuple[str, ...] = CORE_REQUIRED_MARKETS,
) -> ExpansionDecision:
    """
    Block league eleven until every core league/market is production-ready.

    Because READY itself includes non-regression checks for probability quality,
    calibration and CLV when previous snapshots exist, this makes continuous
    improvement/stability a prerequisite for expansion rather than an optional
    follow-up.
    """
    keyed = {(r.league, r.market): r for r in results}
    reasons: list[str] = []

    for league in required_leagues:
        for market in required_markets:
            result = keyed.get((league, market))
            if result is None:
                reasons.append(f"{league} {market}: quality snapshot missing")
                continue
            if result.status != "READY":
                reasons.append(
                    f"{league} {market}: {result.status} "
                    f"({'; '.join(result.reasons)})"
                )

    if reasons:
        return ExpansionDecision(False, tuple(reasons))

    return ExpansionDecision(
        True,
        ("all core ten league/market gates are READY and non-regressing",),
    )
