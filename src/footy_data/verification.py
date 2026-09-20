from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import math

import numpy as np
import pandas as pd

from .quality import assess_match_team_metrics


@dataclass(frozen=True)
class MetricAgreement:
    metric: str
    rows: int
    median_abs_diff: float | None
    p95_abs_diff: float | None
    correlation: float | None
    material_disagreement_fraction: float | None


@dataclass(frozen=True)
class ProviderVerificationReport:
    source: str
    provider_rows: int
    matched_rows: int
    match_rate: float
    duplicate_rows: int
    exact_goal_mismatches: int
    impossible_values: dict[str, int]
    missing_fraction: dict[str, float]
    metric_agreement: list[MetricAgreement]
    blockers: list[str]
    warnings: list[str]
    status: str
    checked_at: str

    def as_dict(self) -> dict:
        result = asdict(self)
        result["metric_agreement"] = [
            asdict(item) for item in self.metric_agreement
        ]
        return result


def _agreement(
    joined: pd.DataFrame,
    metric: str,
    material_threshold: float,
) -> MetricAgreement:
    provider_col = metric + "_provider"
    reference_col = metric + "_reference"
    if provider_col not in joined.columns or reference_col not in joined.columns:
        return MetricAgreement(metric, 0, None, None, None, None)

    left = pd.to_numeric(joined[provider_col], errors="coerce")
    right = pd.to_numeric(joined[reference_col], errors="coerce")
    usable = pd.DataFrame(
        {"provider": left.to_numpy(), "reference": right.to_numpy()},
        index=joined.index,
    ).dropna()
    if usable.empty:
        return MetricAgreement(metric, 0, None, None, None, None)

    diff = (usable["provider"] - usable["reference"]).abs()
    correlation: float | None = None
    if len(usable) >= 4:
        value = usable["provider"].corr(usable["reference"])
        if value is not None and math.isfinite(float(value)):
            correlation = float(value)

    return MetricAgreement(
        metric=metric,
        rows=int(len(usable)),
        median_abs_diff=float(diff.median()),
        p95_abs_diff=float(diff.quantile(0.95)),
        correlation=correlation,
        material_disagreement_fraction=float(
            (diff > material_threshold).mean()
        ),
    )


def verify_provider_rows(
    provider: pd.DataFrame,
    reference: pd.DataFrame,
    source: str,
    minimum_match_rate: float = 0.92,
) -> ProviderVerificationReport:
    """
    Gate provider rows before they can influence Footy.

    Facts must agree. Compatible event/counting fields are cross-checked.
    Provider-modelled xG quantities are monitored but never required to match
    exactly because models use different definitions/training.
    """
    if provider.empty:
        raise ValueError("Cannot verify an empty provider frame.")
    if reference.empty:
        raise ValueError("Cannot verify without a reference frame.")

    key = ["match_id", "team"]
    for frame, label in ((provider, "provider"), (reference, "reference")):
        missing = [column for column in key if column not in frame.columns]
        if missing:
            raise ValueError(f"{label} frame missing keys: {missing}")

    duplicate_rows = int(provider.duplicated(key).sum())
    provider_unique = provider.drop_duplicates(key).copy()
    reference_unique = reference.drop_duplicates(key).copy()

    matched = provider_unique.merge(
        reference_unique,
        on=key,
        how="inner",
        suffixes=("_provider", "_reference"),
        validate="one_to_one",
    )
    match_rate = (
        float(len(matched) / len(provider_unique))
        if len(provider_unique)
        else 0.0
    )

    quality = assess_match_team_metrics(provider_unique)
    goal_mismatch = 0
    for metric in ("goals", "goals_conceded"):
        p = pd.to_numeric(
            matched.get(metric + "_provider"), errors="coerce"
        )
        r = pd.to_numeric(
            matched.get(metric + "_reference"), errors="coerce"
        )
        goal_mismatch += int(
            ((p.notna()) & (r.notna()) & ((p - r).abs() > 1e-9)).sum()
        )

    agreements = [
        _agreement(matched, "shots", 2.0),
        _agreement(matched, "shots_on_target", 1.0),
        _agreement(matched, "xg", 0.75),
        _agreement(matched, "npxg", 0.75),
    ]
    by_metric = {item.metric: item for item in agreements}

    blockers: list[str] = []
    warnings: list[str] = []

    if match_rate < minimum_match_rate:
        blockers.append(
            f"match reconciliation {match_rate:.1%} below "
            f"{minimum_match_rate:.1%}"
        )
    if duplicate_rows:
        blockers.append(f"{duplicate_rows} duplicate match/team rows")
    if goal_mismatch:
        blockers.append(
            f"{goal_mismatch} exact goal/goals-conceded mismatches"
        )
    if any(value > 0 for value in quality.impossible_values.values()):
        blockers.append(
            "impossible metric values: "
            + str(quality.impossible_values)
        )

    shots = by_metric["shots"]
    if (
        shots.rows >= 10
        and shots.median_abs_diff is not None
        and (
            shots.median_abs_diff > 2.0
            or (
                shots.material_disagreement_fraction is not None
                and shots.material_disagreement_fraction > 0.25
            )
        )
    ):
        blockers.append(
            "shot-count definitions disagree materially with reference"
        )
    elif (
        shots.rows >= 10
        and shots.material_disagreement_fraction is not None
        and shots.material_disagreement_fraction > 0.10
    ):
        warnings.append("shot-count disagreement above 10% of overlaps")

    sot = by_metric["shots_on_target"]
    if (
        sot.rows >= 10
        and sot.median_abs_diff is not None
        and (
            sot.median_abs_diff > 1.0
            or (
                sot.material_disagreement_fraction is not None
                and sot.material_disagreement_fraction > 0.25
            )
        )
    ):
        blockers.append(
            "shots-on-target definitions disagree materially with reference"
        )
    elif (
        sot.rows >= 10
        and sot.material_disagreement_fraction is not None
        and sot.material_disagreement_fraction > 0.10
    ):
        warnings.append("SOT disagreement above 10% of overlaps")

    for metric in ("xg", "npxg"):
        agreement = by_metric[metric]
        if agreement.rows >= 10 and agreement.correlation is not None:
            if agreement.correlation < 0.70:
                warnings.append(
                    f"{metric} provider/reference correlation is only "
                    f"{agreement.correlation:.2f}; keep source-specific"
                )

    status = "BLOCKED" if blockers else ("WARN" if warnings else "PASS")
    return ProviderVerificationReport(
        source=source,
        provider_rows=int(len(provider_unique)),
        matched_rows=int(len(matched)),
        match_rate=match_rate,
        duplicate_rows=duplicate_rows,
        exact_goal_mismatches=goal_mismatch,
        impossible_values=quality.impossible_values,
        missing_fraction=quality.missing_fraction,
        metric_agreement=agreements,
        blockers=blockers,
        warnings=warnings,
        status=status,
        checked_at=datetime.now(timezone.utc).isoformat(),
    )
