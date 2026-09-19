from __future__ import annotations

from datetime import datetime, timezone
import pandas as pd


SOT_RESULTS = {"Goal", "Saved Shot"}


def _shot_summary(shots: pd.DataFrame) -> pd.DataFrame:
    if shots.empty:
        return pd.DataFrame(
            columns=["game", "team", "shots", "shots_on_target", "set_piece_xg"]
        )

    required = {"game", "team", "result", "xg", "situation"}
    missing = required - set(shots.columns)
    if missing:
        raise ValueError(f"Understat shots missing columns: {sorted(missing)}")

    s = shots.copy()
    s["shots"] = 1
    s["shots_on_target"] = s["result"].isin(SOT_RESULTS).astype(int)
    s["set_piece_xg_component"] = s["xg"].where(
        s["situation"].isin({"From Corner", "Set Piece", "Direct Freekick"}),
        0.0,
    )
    return (
        s.groupby(["game", "team"], as_index=False)
        .agg(
            shots=("shots", "sum"),
            shots_on_target=("shots_on_target", "sum"),
            set_piece_xg=("set_piece_xg_component", "sum"),
        )
    )


def normalise_understat_matches(
    team_match_stats: pd.DataFrame,
    retrieved_at: str | None = None,
) -> pd.DataFrame:
    required = {
        "league", "season", "game", "date", "home_team", "away_team"
    }
    missing = required - set(team_match_stats.columns)
    if missing:
        raise ValueError(
            f"Understat team-match frame missing columns: {sorted(missing)}"
        )

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    out = pd.DataFrame({
        "match_id": team_match_stats["game"].astype(str),
        "league": team_match_stats["league"],
        "season": team_match_stats["season"].astype(str),
        "kickoff_at": team_match_stats["date"],
        "home_team": team_match_stats["home_team"],
        "away_team": team_match_stats["away_team"],
        "status": "finished",
        "source": "understat",
        "retrieved_at": stamp,
    })
    return out.drop_duplicates(subset=["match_id"])


def normalise_understat(
    team_match_stats: pd.DataFrame,
    shots: pd.DataFrame | None = None,
    retrieved_at: str | None = None,
) -> pd.DataFrame:
    """
    Convert soccerdata Understat match stats into one row per team per match.

    Required verified upstream fields:
      league, season, game, date, home_team, away_team,
      home_goals, away_goals, home_xg, away_xg,
      home_np_xg, away_np_xg.
    """
    required = {
        "league", "season", "game", "date",
        "home_team", "away_team",
        "home_goals", "away_goals",
        "home_xg", "away_xg",
        "home_np_xg", "away_np_xg",
    }
    missing = required - set(team_match_stats.columns)
    if missing:
        raise ValueError(
            f"Understat team-match frame missing columns: {sorted(missing)}"
        )

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []

    for _, m in team_match_stats.iterrows():
        common = {
            "match_id": str(m["game"]),
            "match_date": m["date"],
            "league": m["league"],
            "season": str(m["season"]),
            "source": "understat",
            "retrieved_at": stamp,
        }

        rows.append({
            **common,
            "team": m["home_team"],
            "opponent": m["away_team"],
            "home_away": "H",
            "goals": m["home_goals"],
            "goals_conceded": m["away_goals"],
            "xg": m["home_xg"],
            "xga": m["away_xg"],
            "npxg": m["home_np_xg"],
            "npxga": m["away_np_xg"],
            "ppda": m.get("home_ppda"),
            "deep_completions": m.get("home_deep_completions"),
        })
        rows.append({
            **common,
            "team": m["away_team"],
            "opponent": m["home_team"],
            "home_away": "A",
            "goals": m["away_goals"],
            "goals_conceded": m["home_goals"],
            "xg": m["away_xg"],
            "xga": m["home_xg"],
            "npxg": m["away_np_xg"],
            "npxga": m["home_np_xg"],
            "ppda": m.get("away_ppda"),
            "deep_completions": m.get("away_deep_completions"),
        })

    out = pd.DataFrame(rows)

    if shots is not None and not shots.empty:
        agg = _shot_summary(shots)
        out = out.merge(
            agg,
            how="left",
            left_on=["match_id", "team"],
            right_on=["game", "team"],
        ).drop(columns=["game"], errors="ignore")

        opp = agg.rename(columns={
            "team": "opponent",
            "shots": "shots_conceded",
            "shots_on_target": "sot_conceded",
            "set_piece_xg": "set_piece_xga",
        })
        out = out.merge(
            opp,
            how="left",
            left_on=["match_id", "opponent"],
            right_on=["game", "opponent"],
        ).drop(columns=["game"], errors="ignore")

    return out
