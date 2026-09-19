from __future__ import annotations

from pathlib import Path
import json
import pandas as pd


class FrameCache:
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def parquet_path(self, key: str) -> Path:
        return self.root / f"{key}.parquet"

    def json_path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    def save_frame(self, key: str, frame: pd.DataFrame) -> Path:
        path = self.parquet_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        frame.to_parquet(path, index=False)
        return path

    def load_frame(self, key: str) -> pd.DataFrame | None:
        path = self.parquet_path(key)
        return pd.read_parquet(path) if path.exists() else None

    def save_json(self, key: str, payload: object) -> Path:
        path = self.json_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path
