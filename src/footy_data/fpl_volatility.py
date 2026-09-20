from __future__ import annotations

import argparse
from datetime import datetime, timezone
from io import StringIO
from typing import Iterable

import numpy as np
import pandas as pd
import requests

from .storage import SupabaseRESTWriter


SOURCE_URL = (
    "https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/"
    "master/data/2025-26/gws/merged_gw.csv"
)
SNAPSHOT_KEY = "counterplay-volatility-v1"
SOURCE_NAME = "vaastav-fpl-official-api-derived"
CALIBRATION_VERSION = "counterplay-volatility-v1"
REQUIRED_COLUMNS = {
    "element",
    "position",
    "round",
    "minutes",
    "starts",
    "total_points",
    "expected_goal_involvements",
    "bonus",
    "clean_sheets",
}


def _position(value: object) -> str:
    raw = str(value or "").upper().strip()
    if raw in {"GK", "GKP"}:
        return "GKP"
    if raw in {"DEF", "MID", "FWD"}:
        return raw
    return "OTHER"


def _reliability_bucket(value: float) -> str:
    if value >= 0.80:
        return "HIGH"
    if value >= 0.45:
        return "MIXED"
    return "LOW"


def _xgi_bucket(value: float) -> str:
    if value >= 0.45:
        return "HIGH"
    if value >= 0.20:
        return "MID"
    return "LOW"


def _cs_bucket(value: float) -> str:
    if value >= 0.40:
        return "HIGH"
    if value >= 0.20:
        return "MID"
    return "LOW"


def _safe_std(values: Iterable[float]) -> float:
    arr = np.asarray(list(values), dtype=float)
    if len(arr) <= 1:
        return 0.0
    return float(np.nanstd(arr, ddof=0))


def _quantiles(values: np.ndarray) -> dict[str, float]:
    points = (0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99)
    return {
        f"q{int(point * 100):02d}": round(float(np.quantile(values, point)), 4)
        for point in points
    }


def _profile(frame: pd.DataFrame) -> dict[str, object]:
    residuals = (
        pd.to_numeric(frame["residual"], errors="coerce")
        .dropna()
        .to_numpy(dtype=float)
    )
    if len(residuals) == 0:
        return {
            "sample_size": 0,
            "residual_sd": 1.0,
            "standardized_quantiles": {
                "q01": -2.33,
                "q05": -1.645,
                "q10": -1.282,
                "q25": -0.674,
                "q50": 0.0,
                "q75": 0.674,
                "q90": 1.282,
                "q95": 1.645,
                "q99": 2.33,
            },
            "zero_minute_rate": 0.0,
            "cameo_rate": 0.0,
            "starter_60_rate": 0.0,
        }

    mean = float(np.mean(residuals))
    centered = residuals - mean
    scale = max(0.75, float(np.std(centered, ddof=0)))
    standardized = centered / scale
    minutes = (
        pd.to_numeric(frame["minutes"], errors="coerce")
        .fillna(0)
        .to_numpy(dtype=float)
    )

    return {
        "sample_size": int(len(frame)),
        "residual_mean": round(mean, 4),
        "residual_sd": round(scale, 4),
        "standardized_quantiles": _quantiles(standardized),
        "zero_minute_rate": round(float(np.mean(minutes <= 0)), 4),
        "cameo_rate": round(float(np.mean((minutes > 0) & (minutes < 60))), 4),
        "starter_60_rate": round(float(np.mean(minutes >= 60)), 4),
    }


def _shrunk_multiplier(group_sd: float, base_sd: float, sample_size: int) -> float:
    if base_sd <= 0 or group_sd <= 0:
        return 1.0
    raw = group_sd / base_sd
    reliability = min(1.0, sample_size / 1200.0)
    value = 1.0 + (raw - 1.0) * reliability * 0.65
    return round(float(np.clip(value, 0.88, 1.15)), 4)


def prepare_samples(frame: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS - set(frame.columns)
    if missing:
        raise ValueError(
            f"Historical FPL calibration missing columns: {sorted(missing)}"
        )

    data = frame.copy()
    data["position"] = data["position"].map(_position)
    data["round"] = pd.to_numeric(data["round"], errors="coerce")
    data["element"] = pd.to_numeric(data["element"], errors="coerce")
    for column in (
        "minutes",
        "starts",
        "total_points",
        "expected_goal_involvements",
        "bonus",
        "clean_sheets",
    ):
        data[column] = pd.to_numeric(
            data[column], errors="coerce"
        ).fillna(0.0)

    data = data[
        data["round"].notna()
        & data["element"].notna()
        & data["position"].isin({"GKP", "DEF", "MID", "FWD"})
    ].copy()
    data["round"] = data["round"].astype(int)
    data["element"] = data["element"].astype(int)
    data = data.sort_values(["round", "element"]).reset_index(drop=True)

    histories: dict[int, list[dict[str, float]]] = {}
    position_points = {
        position: [0.0, 0] for position in ("GKP", "DEF", "MID", "FWD")
    }
    samples: list[dict[str, object]] = []

    # A current-GW outcome is never allowed to inform another row at the same
    # deadline. This also prevents a first DGW fixture leaking into the second.
    for gameweek in sorted(data["round"].unique()):
        current = data[data["round"] == gameweek]

        for _, row in current.iterrows():
            player_id = int(row["element"])
            position = str(row["position"])
            history = histories.get(player_id, [])
            if len(history) < 3:
                continue

            prior = history[-5:]
            starts = np.array(
                [item["starts"] for item in prior], dtype=float
            )
            minutes = np.array(
                [item["minutes"] for item in prior], dtype=float
            )
            points = np.array(
                [item["points"] for item in prior], dtype=float
            )
            xgi = np.array([item["xgi"] for item in prior], dtype=float)
            bonus = np.array(
                [item["bonus"] for item in prior], dtype=float
            )
            clean_sheets = np.array(
                [item["clean_sheets"] for item in prior], dtype=float
            )

            start_reliability = float(np.mean(starts > 0))
            minute_sd = _safe_std(minutes)
            played_minutes = float(minutes.sum())
            xgi90 = (
                float(xgi.sum() * 90.0 / played_minutes)
                if played_minutes > 0
                else 0.0
            )
            bonus90 = (
                float(bonus.sum() * 90.0 / played_minutes)
                if played_minutes > 0
                else 0.0
            )
            start_mask = starts > 0
            cs_rate = (
                float(clean_sheets[start_mask].mean())
                if bool(start_mask.any())
                else 0.0
            )

            pos_sum, pos_count = position_points[position]
            position_prior = (
                pos_sum / pos_count if pos_count else float(points.mean())
            )
            baseline = float(
                (points.sum() + position_prior * 3.0)
                / (len(points) + 3.0)
            )
            residual = float(row["total_points"]) - baseline

            samples.append(
                {
                    "position": position,
                    "reliability": _reliability_bucket(start_reliability),
                    "xgi_band": _xgi_bucket(xgi90),
                    "minute_band": (
                        "UNSTABLE" if minute_sd >= 28.0 else "STABLE"
                    ),
                    "bonus_band": "HIGH" if bonus90 >= 0.45 else "LOW",
                    "cs_band": _cs_bucket(cs_rate),
                    "minutes": float(row["minutes"]),
                    "residual": residual,
                }
            )

        for _, row in current.iterrows():
            player_id = int(row["element"])
            position = str(row["position"])
            histories.setdefault(player_id, []).append(
                {
                    "starts": float(row["starts"]),
                    "minutes": float(row["minutes"]),
                    "points": float(row["total_points"]),
                    "xgi": float(row["expected_goal_involvements"]),
                    "bonus": float(row["bonus"]),
                    "clean_sheets": float(row["clean_sheets"]),
                }
            )
            position_points[position][0] += float(row["total_points"])
            position_points[position][1] += 1

    return pd.DataFrame(samples)


def build_calibration(
    frame: pd.DataFrame,
    *,
    season: str = "2025-26",
    source_url: str = SOURCE_URL,
    min_samples: int = 10000,
) -> dict[str, object]:
    samples = prepare_samples(frame)
    if len(samples) < min_samples:
        raise ValueError(
            f"Historical FPL calibration has only {len(samples)} usable "
            f"samples; requires at least {min_samples}."
        )

    profiles: dict[str, dict[str, object]] = {}
    for position in ("GKP", "DEF", "MID", "FWD"):
        position_frame = samples[samples["position"] == position]
        profiles[f"{position}_ALL"] = _profile(position_frame)
        for reliability in ("LOW", "MIXED", "HIGH"):
            subset = position_frame[
                position_frame["reliability"] == reliability
            ]
            if len(subset) >= 120:
                profiles[f"{position}_{reliability}"] = _profile(subset)

    profiles["GLOBAL"] = _profile(samples)

    modifiers: dict[str, dict[str, dict[str, float | int]]] = {
        "xgi": {},
        "minute_stability": {},
        "bonus": {},
        "clean_sheet": {},
    }

    attacking = samples[samples["position"].isin({"MID", "FWD"})]
    attacking_sd = max(0.75, _safe_std(attacking["residual"]))
    for band in ("LOW", "MID", "HIGH"):
        subset = attacking[attacking["xgi_band"] == band]
        modifiers["xgi"][band] = {
            "sample_size": int(len(subset)),
            "multiplier": _shrunk_multiplier(
                _safe_std(subset["residual"]),
                attacking_sd,
                len(subset),
            ),
        }

    overall_sd = max(0.75, _safe_std(samples["residual"]))
    for band in ("STABLE", "UNSTABLE"):
        subset = samples[samples["minute_band"] == band]
        modifiers["minute_stability"][band] = {
            "sample_size": int(len(subset)),
            "multiplier": _shrunk_multiplier(
                _safe_std(subset["residual"]),
                overall_sd,
                len(subset),
            ),
        }

    for band in ("LOW", "HIGH"):
        subset = samples[samples["bonus_band"] == band]
        modifiers["bonus"][band] = {
            "sample_size": int(len(subset)),
            "multiplier": _shrunk_multiplier(
                _safe_std(subset["residual"]),
                overall_sd,
                len(subset),
            ),
        }

    defenders = samples[samples["position"].isin({"GKP", "DEF"})]
    defender_sd = max(0.75, _safe_std(defenders["residual"]))
    for band in ("LOW", "MID", "HIGH"):
        subset = defenders[defenders["cs_band"] == band]
        modifiers["clean_sheet"][band] = {
            "sample_size": int(len(subset)),
            "multiplier": _shrunk_multiplier(
                _safe_std(subset["residual"]),
                defender_sd,
                len(subset),
            ),
        }

    return {
        "version": CALIBRATION_VERSION,
        "season": season,
        "source": SOURCE_NAME,
        "source_url": source_url,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sample_count": int(len(samples)),
        "row_count": int(len(frame)),
        "methodology": {
            "lookahead_control": (
                "All reliability, points, xGI, bonus and clean-sheet "
                "features are lagged to prior Gameweeks. Same-GW fixtures "
                "never update another fixture in that Gameweek."
            ),
            "mean_baseline": (
                "Prior five player fixtures are shrunk toward the position "
                "mean available before that Gameweek."
            ),
            "tails": (
                "Position/start-reliability residuals are centred, "
                "standardized and stored as empirical "
                "1/5/10/25/50/75/90/95/99 percentiles."
            ),
            "xP_excluded": (
                "The historical xP field is intentionally excluded because "
                "the upstream repository warns it may contain post-match "
                "information."
            ),
        },
        "profiles": profiles,
        "modifiers": modifiers,
    }


def fetch_history(
    url: str = SOURCE_URL,
    timeout: int = 60,
) -> pd.DataFrame:
    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": "Footy calibration/1.0"},
    )
    response.raise_for_status()
    return pd.read_csv(StringIO(response.text))


def write_snapshot(payload: dict[str, object]) -> None:
    SupabaseRESTWriter().upsert_fpl_snapshot(
        SNAPSHOT_KEY,
        payload,
        source=SOURCE_NAME,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Calibrate CounterPlay FPL score volatility."
    )
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--season", default="2025-26")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    history = fetch_history(args.source_url)
    payload = build_calibration(
        history,
        season=args.season,
        source_url=args.source_url,
    )
    if args.write:
        write_snapshot(payload)

    import json

    print(
        json.dumps(
            {
                "version": payload["version"],
                "season": payload["season"],
                "row_count": payload["row_count"],
                "sample_count": payload["sample_count"],
                "profiles": {
                    key: {
                        "sample_size": value["sample_size"],
                        "residual_sd": value["residual_sd"],
                    }
                    for key, value in payload["profiles"].items()
                },
                "written": bool(args.write),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
