from __future__ import annotations

from dataclasses import dataclass
import pandas as pd


@dataclass(frozen=True)
class QualityReport:
    rows: int
    missing_fraction: dict[str, float]
    duplicate_rows: int
    impossible_values: dict[str, int]
    usable: bool


def assess_match_team_metrics(frame: pd.DataFrame) -> QualityReport:
    important = [
        c for c in
        ["goals", "goals_conceded", "xg", "xga", "shots", "shots_on_target"]
        if c in frame.columns
    ]
    missing = {c: float(frame[c].isna().mean()) for c in important}

    dup_subset = [c for c in ["match_id", "team", "source"] if c in frame.columns]
    duplicate_rows = int(frame.duplicated(dup_subset).sum()) if dup_subset else 0

    impossible = {}
    for col in ["goals", "goals_conceded", "xg", "xga", "shots", "shots_on_target"]:
        if col in frame.columns:
            vals = pd.to_numeric(frame[col], errors="coerce")
            impossible[col] = int((vals < 0).sum())

    if {"shots", "shots_on_target"}.issubset(frame.columns):
        shots = pd.to_numeric(frame["shots"], errors="coerce")
        sot = pd.to_numeric(frame["shots_on_target"], errors="coerce")
        impossible["sot_gt_shots"] = int((sot > shots).sum())

    usable = (
        len(frame) > 0
        and duplicate_rows == 0
        and all(v == 0 for v in impossible.values())
        and all(v <= 0.10 for v in missing.values())
    )

    return QualityReport(
        rows=len(frame),
        missing_fraction=missing,
        duplicate_rows=duplicate_rows,
        impossible_values=impossible,
        usable=usable,
    )
