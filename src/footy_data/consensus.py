from __future__ import annotations

from dataclasses import dataclass
import json
import math
from typing import Iterable

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SourceProfile:
    name: str
    reliability: float


# Reliability is only used when two compatible observations compete. It does
# not make an unavailable metric appear and it does not imply licensing.
SOURCE_PROFILES: dict[str, SourceProfile] = {
    "opta": SourceProfile("opta", 1.00),
    "statsbomb": SourceProfile("statsbomb", 0.98),
    "statsbomb-open": SourceProfile("statsbomb-open", 0.96),
    "understat": SourceProfile("understat", 0.96),
    "fpl-core-insights": SourceProfile("fpl-core-insights", 0.88),
    "fbref": SourceProfile("fbref", 0.90),
    "sofascore": SourceProfile("sofascore", 0.86),
    "football-data.co.uk": SourceProfile("football-data.co.uk", 0.82),
    "openfootball": SourceProfile("openfootball", 0.78),
}

IDENTITY_FIELDS = ["match_id", "team", "opponent", "home_away"]

# Provider-modelled quantities are not definition-identical. We keep the
# highest-priority observation as the canonical value and use other sources as
# a cross-check/confidence signal instead of averaging incompatible models.
MODELLED_METRICS = {
    "xg",
    "npxg",
    "xga",
    "npxga",
    "xa",
    "set_piece_xg",
    "set_piece_xga",
    "field_tilt",
}

# Event/counting metrics are generally compatible enough for robust synthesis
# once they have been mapped to the same definition by a source normalizer.
ROBUST_METRICS = {
    "goals",
    "goals_conceded",
    "shots",
    "shots_on_target",
    "shots_conceded",
    "sot_conceded",
    "big_chances",
    "big_chances_conceded",
    "box_touches",
    "key_passes",
    "possession",
    "ppda",
    "deep_completions",
    "crosses",
    "shots_inside_box",
    "xgot",
    "final_third_passes",
    "opposition_half_passes",
    "territory_proxy",
    "xgot_faced",
    "goals_prevented",
}

METRICS = sorted(MODELLED_METRICS | ROBUST_METRICS)


def _source_key(value: object) -> str:
    raw = str(value or "unknown").strip().lower()
    aliases = {
        "statsbomb open": "statsbomb-open",
        "statsbomb_open": "statsbomb-open",
        "football-data": "football-data.co.uk",
        "football_data": "football-data.co.uk",
        "soccerdata-understat": "understat",
        "soccerdata-sofascore": "sofascore",
        "soccerdata-fbref": "fbref",
    }
    return aliases.get(raw, raw)


def _weight(source: object) -> float:
    key = _source_key(source)
    return SOURCE_PROFILES.get(key, SourceProfile(key, 0.70)).reliability


def _weighted_median(values: Iterable[float], weights: Iterable[float]) -> float:
    pairs = sorted(
        (float(value), max(0.0, float(weight)))
        for value, weight in zip(values, weights)
        if math.isfinite(float(value))
    )
    if not pairs:
        return float("nan")
    total = sum(weight for _, weight in pairs)
    if total <= 0:
        return float(np.median([value for value, _ in pairs]))
    threshold = total / 2
    running = 0.0
    for value, weight in pairs:
        running += weight
        if running >= threshold:
            return value
    return pairs[-1][0]


def _agreement(values: list[float], canonical: float) -> float:
    if len(values) <= 1:
        return 0.74
    finite = np.asarray([value for value in values if math.isfinite(value)])
    if len(finite) <= 1:
        return 0.74
    scale = max(abs(float(canonical)), float(np.mean(np.abs(finite))), 0.50)
    mad = float(np.median(np.abs(finite - canonical)))
    relative = mad / scale
    # Full agreement gets close to 1; material disagreement is visible rather
    # than silently averaged away.
    return float(np.clip(0.98 - relative * 0.90, 0.35, 0.98))


def _canonical_metric(group: pd.DataFrame, metric: str):
    if metric not in group.columns:
        return np.nan, None, 0.0, False

    observed = group[["source", metric]].copy()
    observed[metric] = pd.to_numeric(observed[metric], errors="coerce")
    observed = observed.dropna(subset=[metric])
    if observed.empty:
        return np.nan, None, 0.0, False

    observed["_weight"] = observed["source"].map(_weight)
    values = observed[metric].astype(float).tolist()

    if metric in MODELLED_METRICS:
        chosen = observed.sort_values(
            ["_weight", metric], ascending=[False, False]
        ).iloc[0]
        canonical = float(chosen[metric])
        selected_source = _source_key(chosen["source"])
    else:
        canonical = _weighted_median(
            observed[metric].astype(float),
            observed["_weight"].astype(float),
        )
        nearest = observed.iloc[
            (observed[metric].astype(float) - canonical).abs().argsort().iloc[0]
        ]
        selected_source = _source_key(nearest["source"])

    agreement = _agreement(values, canonical)
    coverage_bonus = min(0.08, 0.04 * max(0, len(observed) - 1))
    source_quality = float(observed["_weight"].max())
    confidence = float(
        np.clip(
            agreement * 0.62 + source_quality * 0.30 + coverage_bonus,
            0.0,
            1.0,
        )
    )

    # Flag a conflict if providers disagree enough that a human/model should
    # not treat the canonical number as settled.
    conflict = len(values) > 1 and agreement < 0.72
    return canonical, selected_source, confidence, conflict


def synthesize_match_team_metrics(frame: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse provider-specific match/team observations into one canonical row.

    Raw provider rows stay stored in Supabase. This function only constructs
    the modelling view. Model-derived metrics (xG, npxG, xA, etc.) are selected
    from the most reliable available compatible source and cross-checked;
    event/count metrics use a robust weighted median.

    The returned frame includes provenance/confidence metadata so downstream
    models can haircut uncertainty instead of pretending all data agrees.
    """
    if frame.empty:
        return frame.copy()

    missing = [field for field in IDENTITY_FIELDS if field not in frame.columns]
    if missing:
        raise ValueError(
            f"Cannot synthesize provider metrics; missing identity fields: {missing}"
        )
    if "source" not in frame.columns:
        raise ValueError("Cannot synthesize provider metrics without source.")

    rows: list[dict] = []
    for keys, group in frame.groupby(IDENTITY_FIELDS, dropna=False, sort=False):
        row = dict(zip(IDENTITY_FIELDS, keys))
        sources = sorted({_source_key(value) for value in group["source"]})
        confidences: list[float] = []
        selected: dict[str, str] = {}
        conflicts: list[str] = []

        for metric in METRICS:
            value, source, confidence, conflict = _canonical_metric(group, metric)
            if not (isinstance(value, float) and math.isnan(value)):
                row[metric] = value
                if source:
                    selected[metric] = source
                confidences.append(confidence)
                if conflict:
                    conflicts.append(metric)
            elif metric in group.columns:
                row[metric] = np.nan

        if "retrieved_at" in group.columns:
            retrieved = pd.to_datetime(
                group["retrieved_at"], errors="coerce", utc=True
            )
            latest_retrieved = retrieved.max()
            row["retrieved_at"] = (
                latest_retrieved.isoformat()
                if not pd.isna(latest_retrieved)
                else None
            )
        else:
            row["retrieved_at"] = None
        row["source"] = "consensus:" + "+".join(sources)
        row["source_count"] = len(sources)
        row["source_confidence"] = (
            float(np.mean(confidences)) if confidences else 0.0
        )
        row["source_conflicts"] = json.dumps(conflicts)
        row["metric_sources"] = json.dumps(selected, sort_keys=True)
        rows.append(row)

    out = pd.DataFrame(rows)
    return out.sort_values(["match_id", "team"]).reset_index(drop=True)
