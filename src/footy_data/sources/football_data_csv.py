from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import pandas as pd
import requests


@dataclass
class FootballDataCSVSource:
    timeout: int = 30

    def read_csv_url(self, url: str) -> pd.DataFrame:
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        return pd.read_csv(BytesIO(response.content))
