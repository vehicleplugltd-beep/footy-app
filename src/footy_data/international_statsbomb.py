"""Ingest genuine StatsBomb open international event data as isolated research history.

Run: python -m footy_data.international_statsbomb --dry-run
     python -m footy_data.international_statsbomb --write

Never links to existing fixture IDs by fuzzy name or promotes model validation.
StatsBomb credit: https://github.com/hudl/open-data
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import math

from .sources.statsbomb_open import StatsBombOpenSource
from .storage import SupabaseRESTWriter

COMPETITIONS = {"FIFA World Cup", "UEFA Euro", "African Cup of Nations", "Copa America", "International Friendlies", "International Friendly", "Friendlies"}
SEASONS = {"2018", "2022", "2020", "2024", "2023"}
SOURCE = "statsbomb-open-international"


def extract_match(match: dict, events: list[dict], competition: str, season: str):
    home = match["home_team"]["home_team_name"]
    away = match["away_team"]["away_team_name"]
    match_id = f"statsbomb-int-{match['match_id']}"
    teams = {home, away}
    totals = {team: defaultdict(float) for team in teams}
    shots = {team: 0 for team in teams}
    for event in events:
        if event.get("type", {}).get("name") != "Shot":
            continue
        team = event.get("team", {}).get("name")
        if team not in teams:
            raise ValueError(f"Unexpected shooting team in {match_id}: {team}")
        shot = event.get("shot") or {}
        # Shootout attempts are not match xG and must never enter team totals.
        if (event.get("period") == 5):
            continue
        xg = shot.get("statsbomb_xg")
        if not isinstance(xg, (int, float)) or not math.isfinite(xg) or not 0 <= xg <= 1:
            raise ValueError(f"Missing/invalid StatsBomb xG for {match_id}")
        shots[team] += 1
        totals[team]["xg"] += xg
        if shot.get("type", {}).get("name") != "Penalty":
            totals[team]["npxg"] += xg
        if shot.get("outcome", {}).get("name") == "Goal":
            totals[team]["shot_goals"] += 1
    if not all(shots.values()):
        raise ValueError(f"Missing shot events for one side of {match_id}")
    # Exclude shootouts and reject inconsistent event/score records.
    for team in teams:
        if totals[team]["shot_goals"] > int(match["home_score"] if team == home else match["away_score"]):
            raise ValueError(f"Goal reconciliation failed for {match_id}; exclude shootout/extra-time ambiguity")
    stamp = datetime.now(timezone.utc).isoformat()
    kickoff = f"{match['match_date']}T{match.get('kick_off') or '00:00:00'}"
    fixture = dict(match_id=match_id, league=f"INT-StatsBomb {competition}", season=season,
                   kickoff_at=kickoff, home_team=home, away_team=away, status="FINISHED",
                   source=SOURCE, retrieved_at=stamp)
    rows = []
    for team, opponent, venue in ((home, away, "H"), (away, home, "A")):
        own, other = totals[team], totals[opponent]
        rows.append(dict(match_id=match_id, team=team, opponent=opponent, home_away=venue,
                         goals=int(match["home_score"] if team == home else match["away_score"]),
                         goals_conceded=int(match["away_score"] if team == home else match["home_score"]),
                         xg=round(own["xg"], 6), npxg=round(own["npxg"], 6),
                         xga=round(other["xg"], 6), npxga=round(other["npxg"], 6),
                         shots=shots[team], shots_conceded=shots[opponent],
                         source=SOURCE, retrieved_at=stamp, verified=True,
                         verification_status="PASS", verified_at=stamp))
    return fixture, rows


def run(write: bool = False, limit: int = 0):
    source = StatsBombOpenSource()
    writer = SupabaseRESTWriter() if write else None
    fixtures, metrics, rejected = [], [], []
    competitions = [c for c in source.competitions()
                    if c.get("competition_name") in COMPETITIONS and c.get("season_name") in SEASONS
                    and c.get("competition_gender") == "male"
                    and c.get("competition_international") is True
                    and c.get("competition_youth") is False]
    available = sorted({c["competition_name"] for c in competitions})
    print(f"Available eligible competitions: {available}; friendlies are ingested only if source events exist.")
    for competition in competitions:
        name, season = competition["competition_name"], competition["season_name"]
        for match in source.matches(competition["competition_id"], competition["season_id"]):
            if limit and len(fixtures) >= limit:
                break
            try:
                fixture, rows = extract_match(match, source.events(match["match_id"]), name, season)
                fixtures.append(fixture)
                metrics.extend(rows)
            except (ValueError, KeyError, TypeError) as exc:
                rejected.append((match.get("match_id"), str(exc)))
        if limit and len(fixtures) >= limit:
            break
    print(f"StatsBomb research fixtures={len(fixtures)} verified team rows={len(metrics)} rejected={len(rejected)}")
    for item in rejected[:20]:
        print(f"REJECT {item}")
    if writer and fixtures:
        # Distinct provider IDs: no accidental overwrite of the live fixture feed.
        for start in range(0, len(fixtures), 50):
            writer.upsert_matches(fixtures[start:start + 50])
        for start in range(0, len(metrics), 100):
            writer.upsert_match_team_metrics(metrics[start:start + 100])
        print("Persisted isolated international research history. Market approval unchanged.")
    return len(fixtures), len(rejected)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--write", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    run(write=args.write, limit=args.limit)
