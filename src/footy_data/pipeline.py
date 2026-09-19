from __future__ import annotations

from pathlib import Path
import pandas as pd

from .cache import FrameCache
from .features import (
    add_process_residuals,
    add_rolling_process,
    add_home_away_process,
    apply_opponent_strength_adjustment,
)
from .normalise import validate_match_team_metrics
from .quality import assess_match_team_metrics


class ProcessPipeline:
    def __init__(self, cache_dir: str | Path = ".footy-cache"):
        self.cache = FrameCache(cache_dir)

    def build_features(self, match_team_metrics: pd.DataFrame) -> pd.DataFrame:
        frame = validate_match_team_metrics(match_team_metrics)
        report = assess_match_team_metrics(frame)
        if not report.usable:
            raise ValueError(f"Input failed quality checks: {report}")

        frame = add_process_residuals(frame)
        frame = add_rolling_process(frame)
        frame = add_home_away_process(frame)
        if "opponent_elo" in frame.columns:
            frame = apply_opponent_strength_adjustment(frame)
        return frame

    def cache_features(self, key: str, frame: pd.DataFrame) -> Path:
        return self.cache.save_frame(key, frame)
