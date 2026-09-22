from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Mapping

import pandas as pd


SOURCE = "fotmob"


def _number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _stat_pairs(details: Mapping[str, Any]) -> dict[str, tuple[Any, Any]]:
    root = (
        details.get("content", {})
        .get("stats", {})
        .get("Periods", {})
        .get("All", {})
        .get("stats", [])
    )
    pairs: dict[str, tuple[Any, Any]] = {}

    def walk(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                walk(item)
            return
        if not isinstance(value, Mapping):
            return

        key = value.get("key")
        stats = value.get("stats")
        if (
            isinstance(key, str)
            and isinstance(stats, list)
            and len(stats) >= 2
            and not any(isinstance(item, (dict, list)) for item in stats[:2])
        ):
            pairs.setdefault(key, (stats[0], stats[1]))

        for child in value.values():
            if isinstance(child, (dict, list)):
                walk(child)

    walk(root)
    return pairs


def _score(match: Mapping[str, Any]) -> tuple[float | None, float | None]:
    home = match.get("home", {})
    away = match.get("away", {})
    home_score = _number(home.get("score")) if isinstance(home, Mapping) else None
    away_score = _number(away.get("score")) if isinstance(away, Mapping) else None
    if home_score is not None and away_score is not None:
        return home_score, away_score

    status = match.get("status", {})
    if isinstance(status, Mapping):
        score = status.get("scoreStr")
        if isinstance(score, str):
            parts = re.split(r"\s*[-–:]\s*", score.strip(), maxsplit=1)
            if len(parts) == 2:
                return _number(parts[0]), _number(parts[1])
    return None, None


def _kickoff(match: Mapping[str, Any]) -> Any:
    status = match.get("status", {})
    if isinstance(status, Mapping) and status.get("utcTime"):
        return status.get("utcTime")
    return match.get("kickoff_at") or match.get("kickoffAt")


def _team_name(match: Mapping[str, Any], side: str) -> str:
    team = match.get(side, {})
    if isinstance(team, Mapping):
        return str(team.get("name") or "").strip()
    return ""


def _pair(
    pairs: Mapping[str, tuple[Any, Any]],
    key: str,
) -> tuple[float | None, float | None]:
    raw = pairs.get(key, (None, None))
    return _number(raw[0]), _number(raw[1])


def normalise_fotmob_match(
    match: Mapping[str, Any],
    details: Mapping[str, Any],
    *,
    league: str,
    season: str,
    retrieved_at: str | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Normalize one finished FotMob match into Footy's canonical match and
    team-process frames.

    Only verified team-level fields from content.stats.Periods.All are mapped.
    Metrics not present there remain absent rather than being inferred.
    """
    event_id = match.get("id")
    home_team = _team_name(match, "home")
    away_team = _team_name(match, "away")
    kickoff_at = _kickoff(match)

    if event_id is None:
        raise ValueError("FotMob match missing id")
    if not home_team or not away_team:
        raise ValueError("FotMob match missing home/away team")
    if kickoff_at is None:
        raise ValueError("FotMob match missing kickoff time")

    home_goals, away_goals = _score(match)
    if home_goals is None or away_goals is None:
        raise ValueError("FotMob finished match missing final score")

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    match_id = f"fotmob:{event_id}"
    pairs = _stat_pairs(details)

    home_xg, away_xg = _pair(pairs, "expected_goals")
    home_npxg, away_npxg = _pair(pairs, "expected_goals_non_penalty")
    home_shots, away_shots = _pair(pairs, "total_shots")
    home_sot, away_sot = _pair(pairs, "ShotsOnTarget")
    home_big, away_big = _pair(pairs, "big_chance")
    home_box, away_box = _pair(pairs, "touches_opp_box")
    home_set, away_set = _pair(pairs, "expected_goals_set_play")
    home_poss, away_poss = _pair(pairs, "BallPossesion")
    home_cross, away_cross = _pair(pairs, "accurate_crosses")
    home_inside, away_inside = _pair(pairs, "shots_inside_box")
    home_xgot, away_xgot = _pair(pairs, "expected_goals_on_target")
    home_opp_half, away_opp_half = _pair(pairs, "opposition_half_passes")

    match_frame = pd.DataFrame([{
        "match_id": match_id,
        "league": league,
        "season": str(season),
        "kickoff_at": kickoff_at,
        "home_team": home_team,
        "away_team": away_team,
        "status": "finished",
        "source": SOURCE,
        "retrieved_at": stamp,
    }])

    common = {
        "match_id": match_id,
        "source": SOURCE,
        "retrieved_at": stamp,
        "verified": True,
        "verification_status": "WARN",
        "verified_at": stamp,
    }

    metrics = pd.DataFrame([
        {
            **common,
            "team": home_team,
            "opponent": away_team,
            "home_away": "H",
            "goals": home_goals,
            "goals_conceded": away_goals,
            "xg": home_xg,
            "xga": away_xg,
            "npxg": home_npxg,
            "npxga": away_npxg,
            "shots": home_shots,
            "shots_on_target": home_sot,
            "shots_conceded": away_shots,
            "sot_conceded": away_sot,
            "big_chances": home_big,
            "big_chances_conceded": away_big,
            "box_touches": home_box,
            "set_piece_xg": home_set,
            "set_piece_xga": away_set,
            "possession": home_poss,
            "crosses": home_cross,
            "shots_inside_box": home_inside,
            "xgot": home_xgot,
            "xgot_faced": away_xgot,
            "opposition_half_passes": home_opp_half,
        },
        {
            **common,
            "team": away_team,
            "opponent": home_team,
            "home_away": "A",
            "goals": away_goals,
            "goals_conceded": home_goals,
            "xg": away_xg,
            "xga": home_xg,
            "npxg": away_npxg,
            "npxga": home_npxg,
            "shots": away_shots,
            "shots_on_target": away_sot,
            "shots_conceded": home_shots,
            "sot_conceded": home_sot,
            "big_chances": away_big,
            "big_chances_conceded": home_big,
            "box_touches": away_box,
            "set_piece_xg": away_set,
            "set_piece_xga": home_set,
            "possession": away_poss,
            "crosses": away_cross,
            "shots_inside_box": away_inside,
            "xgot": away_xgot,
            "xgot_faced": home_xgot,
            "opposition_half_passes": away_opp_half,
        },
    ])

    return match_frame, metrics
