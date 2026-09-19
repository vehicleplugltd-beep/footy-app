from __future__ import annotations

from dataclasses import dataclass
import requests


@dataclass
class OpenFootballSource:
    timeout: int = 30

    def read_json_url(self, url: str):
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json()
