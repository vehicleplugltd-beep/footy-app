from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd
import requests


FPL_BASE = "https://fantasy.premierleague.com/api"

TEAM_ALIASES = {
    "Man City": "Manchester City",
    "Man Utd": "Manchester United",
    "Newcastle": "Newcastle United",
    "Nott'm Forest": "Nottingham Forest",
    "Spurs": "Tottenham",
    "Wolves": "Wolverhampton Wanderers",
    "Leeds": "Leeds United",
}


def canonical_team_name(value: str) -> str:
    return TEAM_ALIASES.get(str(value).strip(), str(value).strip())


def normalise_official_fpl_schedule(
    fixtures: list[dict[str, Any]],
    teams: list[dict[str, Any]],
    season: str,
    league: str = "ENG-Premier League",
) -> pd.DataFrame:
    team_map = {
        int(team["id"]): canonical_team_name(str(team["name"]))
        for team in teams
        if team.get("id") is not None and team.get("name")
    }

    rows: list[dict[str, Any]] = []
    for fixture in fixtures:
        kickoff = fixture.get("kickoff_time")
        home_id = fixture.get("team_h")
        away_id = fixture.get("team_a")
        fixture_id = fixture.get("id")
        if not kickoff or home_id is None or away_id is None or fixture_id is None:
            continue
        if int(home_id) not in team_map or int(away_id) not in team_map:
            continue

        rows.append({
            "league": league,
            "season": str(season),
            "game": f"fpl-{fixture_id}",
            "date": kickoff,
            "home_team": team_map[int(home_id)],
            "away_team": team_map[int(away_id)],
            "is_result": bool(fixture.get("finished", False)),
        })

    if not rows:
        return pd.DataFrame(
            columns=[
                "league",
                "season",
                "game",
                "date",
                "home_team",
                "away_team",
                "is_result",
            ]
        )
    return pd.DataFrame(rows)


@dataclass
class OfficialFPLSource:
    timeout: int = 30

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json,text/plain,*/*",
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 Chrome/140 Safari/537.36"
            ),
            "Referer": "https://fantasy.premierleague.com/",
            "Accept-Language": "en-GB,en;q=0.9",
        }

    def _get(self, path: str) -> Any:
        response = requests.get(
            f"{FPL_BASE}/{path.lstrip('/')}",
            headers=self.headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

    def schedule(
        self,
        season: str,
        league: str = "ENG-Premier League",
    ) -> pd.DataFrame:
        bootstrap = self._get("bootstrap-static/")
        fixtures = self._get("fixtures/")
        return normalise_official_fpl_schedule(
            fixtures=list(fixtures),
            teams=list(bootstrap.get("teams", [])),
            season=season,
            league=league,
        )
