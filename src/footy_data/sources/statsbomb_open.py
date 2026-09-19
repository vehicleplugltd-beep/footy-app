from __future__ import annotations

from dataclasses import dataclass
import requests


BASE = "https://raw.githubusercontent.com/hudl/open-data/master/data"


@dataclass
class StatsBombOpenSource:
    timeout: int = 30

    def _get_json(self, url: str):
        response = requests.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def competitions(self):
        return self._get_json(f"{BASE}/competitions.json")

    def matches(self, competition_id: int, season_id: int):
        return self._get_json(f"{BASE}/matches/{competition_id}/{season_id}.json")

    def events(self, match_id: int):
        return self._get_json(f"{BASE}/events/{match_id}.json")

    def lineups(self, match_id: int):
        return self._get_json(f"{BASE}/lineups/{match_id}.json")

    def three_sixty(self, match_id: int):
        return self._get_json(f"{BASE}/three-sixty/{match_id}.json")
