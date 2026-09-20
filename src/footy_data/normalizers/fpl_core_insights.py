from __future__ import annotations

from datetime import datetime, timezone
import pandas as pd

from footy_data.identity import default_resolver
from footy_data.normalise import canonical_text


def _canonical_team(value: object) -> str:
    return default_resolver().resolve(str(value))


def _number(value: object):
    return pd.to_numeric(value, errors="coerce")


def _territory_share(match: pd.Series, side: str, other: str):
    own = _number(match.get(f"{side}_opposition_half"))
    opp = _number(match.get(f"{other}_opposition_half"))
    if pd.isna(own) or pd.isna(opp) or float(own) + float(opp) <= 0:
        return float("nan")
    return 100.0 * float(own) / (float(own) + float(opp))


def normalise_fpl_core_matches(
    matches: pd.DataFrame,
    teams: pd.DataFrame,
    retrieved_at: str | None = None,
) -> pd.DataFrame:
    """
    Convert finished Premier League FPL-Core-Insights match rows into
    provider-specific Footy team rows.

    Provider xG is deliberately NOT promoted into the canonical xG fields yet.
    It is validated separately because provider-model xG definitions differ.
    """
    if matches.empty or teams.empty:
        return pd.DataFrame()

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    mapping = {
        int(row["code"]): _canonical_team(row["name"])
        for _, row in teams.dropna(subset=["code", "name"]).iterrows()
    }

    rows: list[dict] = []
    league_rows = matches[
        (matches["tournament"].astype(str).str.lower() == "prem")
        & (matches["finished"].astype(str).str.lower() == "true")
        & (matches["stats_processed"].astype(str).str.lower() == "true")
    ].copy()

    for _, match in league_rows.iterrows():
        home_code = int(float(match["home_team"]))
        away_code = int(float(match["away_team"]))
        home = mapping.get(home_code, str(home_code))
        away = mapping.get(away_code, str(away_code))
        provider_id = str(match["match_id"])
        kickoff = pd.to_datetime(match["kickoff_time"], errors="coerce", utc=True)

        for side, team, opponent in (
            ("home", home, away),
            ("away", away, home),
        ):
            other = "away" if side == "home" else "home"
            rows.append(
                {
                    "provider_match_id": provider_id,
                    "match_date": kickoff,
                    "team": team,
                    "opponent": opponent,
                    "home_away": "H" if side == "home" else "A",
                    "goals": pd.to_numeric(
                        match.get(f"{side}_score"), errors="coerce"
                    ),
                    "goals_conceded": pd.to_numeric(
                        match.get(f"{other}_score"), errors="coerce"
                    ),
                    # Understat remains designated xG/npxG source until the
                    # provider models are separately calibrated.
                    "xg": float("nan"),
                    "npxg": float("nan"),
                    "xga": float("nan"),
                    "npxga": float("nan"),
                    "shots": pd.to_numeric(
                        match.get(f"{side}_total_shots"), errors="coerce"
                    ),
                    "shots_on_target": pd.to_numeric(
                        match.get(f"{side}_shots_on_target"), errors="coerce"
                    ),
                    "shots_conceded": pd.to_numeric(
                        match.get(f"{other}_total_shots"), errors="coerce"
                    ),
                    "sot_conceded": pd.to_numeric(
                        match.get(f"{other}_shots_on_target"), errors="coerce"
                    ),
                    "big_chances": pd.to_numeric(
                        match.get(f"{side}_big_chances"), errors="coerce"
                    ),
                    "big_chances_conceded": pd.to_numeric(
                        match.get(f"{other}_big_chances"), errors="coerce"
                    ),
                    "box_touches": pd.to_numeric(
                        match.get(f"{side}_touches_in_opposition_box"),
                        errors="coerce",
                    ),
                    "opposition_half_passes": pd.to_numeric(
                        match.get(f"{side}_opposition_half"), errors="coerce"
                    ),
                    "territory_proxy": _territory_share(match, side, other),
                    "set_piece_xg": pd.to_numeric(
                        match.get(f"{side}_xg_set_play"), errors="coerce"
                    ),
                    "set_piece_xga": pd.to_numeric(
                        match.get(f"{other}_xg_set_play"), errors="coerce"
                    ),
                    "possession": pd.to_numeric(
                        match.get(f"{side}_possession"), errors="coerce"
                    ),
                    "crosses": pd.to_numeric(
                        match.get(f"{side}_accurate_crosses"), errors="coerce"
                    ),
                    "shots_inside_box": pd.to_numeric(
                        match.get(f"{side}_shots_inside_box"), errors="coerce"
                    ),
                    "xgot": pd.to_numeric(
                        match.get(f"{side}_xg_on_target_xgot"), errors="coerce"
                    ),
                    "source": "fpl-core-insights",
                    "retrieved_at": stamp,
                }
            )

    return pd.DataFrame(rows)


def reconcile_fpl_core_to_footy(
    provider: pd.DataFrame,
    footy: pd.DataFrame,
) -> tuple[pd.DataFrame, float]:
    if provider.empty or footy.empty:
        return pd.DataFrame(), 0.0

    p = provider.copy()
    f = footy.copy()

    p["date_key"] = pd.to_datetime(
        p["match_date"], errors="coerce", utc=True
    ).dt.floor("D")
    p["team_key"] = p["team"].map(lambda value: canonical_text(str(value)))
    p["opponent_key"] = p["opponent"].map(
        lambda value: canonical_text(str(value))
    )

    f["date_key"] = pd.to_datetime(
        f["match_date"], errors="coerce", utc=True
    ).dt.floor("D")
    f["team_key"] = f["team"].map(lambda value: canonical_text(str(value)))
    f["opponent_key"] = f["opponent"].map(
        lambda value: canonical_text(str(value))
    )

    mapping = f[
        ["match_id", "date_key", "team_key", "opponent_key", "home_away"]
    ].drop_duplicates()

    joined = p.merge(
        mapping,
        on=["date_key", "team_key", "opponent_key", "home_away"],
        how="left",
        suffixes=("_provider", ""),
        validate="many_to_one",
    )
    total = len(joined)
    matched = int(joined["match_id"].notna().sum())
    rate = matched / total if total else 0.0

    joined = joined.dropna(subset=["match_id"]).copy()
    joined["match_id"] = joined["match_id"].astype(str)
    return (
        joined.drop(
            columns=["date_key", "team_key", "opponent_key"],
            errors="ignore",
        ),
        float(rate),
    )



def normalise_fpl_core_player_match_stats(
    player_match_stats: pd.DataFrame,
    players: pd.DataFrame,
    teams: pd.DataFrame,
    matches: pd.DataFrame,
    season: str,
    retrieved_at: str | None = None,
) -> pd.DataFrame:
    """
    Build one verified-enrichment row per positive-minute player appearance.

    Official FPL IDs remain the identity spine. Team/opponent identity is
    resolved from the gameweek snapshot so historical transfer rows are not
    silently assigned to a player's current club.
    """
    if (
        player_match_stats.empty
        or players.empty
        or teams.empty
        or matches.empty
    ):
        return pd.DataFrame()

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    team_by_code = {
        int(float(row["code"])): _canonical_team(row["name"])
        for _, row in teams.dropna(subset=["code", "name"]).iterrows()
    }
    team_by_id = {
        int(float(row["id"])): _canonical_team(row["name"])
        for _, row in teams.dropna(subset=["id", "name"]).iterrows()
    }
    player_by_id = {
        int(float(row["player_id"])): row
        for _, row in players.dropna(subset=["player_id"]).iterrows()
    }
    match_by_id = {
        str(row["match_id"]): row
        for _, row in matches.dropna(subset=["match_id"]).iterrows()
    }

    numeric_map = {
        "minutes": "minutes_played",
        "goals": "goals",
        "assists": "assists",
        "shots": "total_shots",
        "shots_on_target": "shots_on_target",
        "xg": "xg",
        "xa": "xa",
        "xgot": "xgot",
        "big_chances_missed": "big_chances_missed",
        "touches": "touches",
        "box_touches": "touches_opposition_box",
        "chances_created": "chances_created",
        "final_third_passes": "final_third_passes",
        "accurate_crosses": "accurate_crosses",
        "interceptions": "interceptions",
        "recoveries": "recoveries",
        "blocks": "blocks",
        "clearances": "clearances",
        "headed_clearances": "headed_clearances",
        "duels_won": "duels_won",
        "duels_lost": "duels_lost",
        "was_fouled": "was_fouled",
        "fouls_committed": "fouls_committed",
        "saves": "saves",
        "goals_conceded": "goals_conceded",
        "xgot_faced": "xgot_faced",
        "goals_prevented": "goals_prevented",
        "sweeper_actions": "sweeper_actions",
        "high_claims": "high_claim",
        "saves_inside_box": "saves_inside_box",
        "defensive_contributions": "defensive_contributions",
    }

    rows: list[dict] = []
    for _, stat in player_match_stats.iterrows():
        player_id = _number(stat.get("player_id"))
        minutes = _number(stat.get("minutes_played"))
        if pd.isna(player_id) or pd.isna(minutes) or float(minutes) <= 0:
            continue

        player_id_int = int(float(player_id))
        provider_match_id = str(stat.get("match_id", ""))
        player = player_by_id.get(player_id_int)
        match = match_by_id.get(provider_match_id)
        if player is None or match is None:
            continue

        team_code = _number(player.get("team_code"))
        if pd.isna(team_code):
            continue
        team = team_by_code.get(int(float(team_code)))
        home_id = _number(match.get("home_team"))
        away_id = _number(match.get("away_team"))
        home = (
            team_by_id.get(int(float(home_id)))
            if not pd.isna(home_id)
            else None
        )
        away = (
            team_by_id.get(int(float(away_id)))
            if not pd.isna(away_id)
            else None
        )
        if team == home:
            opponent = away
        elif team == away:
            opponent = home
        else:
            # A stale/current-squad mismatch should never be guessed through.
            continue

        record = {
            "season": str(season),
            "gameweek": _number(match.get("gameweek")),
            "competition": str(match.get("tournament") or "unknown"),
            "provider_match_id": provider_match_id,
            "footy_match_id": None,
            "kickoff_at": pd.to_datetime(
                match.get("kickoff_time"), errors="coerce", utc=True
            ),
            "player_id": player_id_int,
            "player_code": _number(player.get("player_code")),
            "player_name": str(player.get("web_name") or player_id_int),
            "team": team,
            "opponent": opponent,
            "source": "fpl-core-insights",
            "retrieved_at": stamp,
        }
        for target, upstream in numeric_map.items():
            record[target] = _number(stat.get(upstream))
        rows.append(record)

    return pd.DataFrame(rows)


def attach_fpl_core_player_match_ids(
    player_rows: pd.DataFrame,
    reconciled_team_rows: pd.DataFrame,
) -> pd.DataFrame:
    if player_rows.empty:
        return player_rows.copy()
    out = player_rows.copy()
    if reconciled_team_rows.empty:
        return out

    mapping = (
        reconciled_team_rows[
            ["provider_match_id", "match_id"]
        ]
        .dropna()
        .drop_duplicates(subset=["provider_match_id"])
        .set_index("provider_match_id")["match_id"]
        .astype(str)
        .to_dict()
    )
    out["footy_match_id"] = out["provider_match_id"].map(mapping)
    return out


def enrich_fpl_core_team_rows_from_players(
    team_rows: pd.DataFrame,
    player_rows: pd.DataFrame,
) -> pd.DataFrame:
    """
    Promote only definition-compatible player aggregates into the team row.

    xA/chances-created/progression and goalkeeper post-shot metrics are summed
    from linked positive-minute appearances. Missing values remain missing.
    """
    if team_rows.empty or player_rows.empty:
        return team_rows.copy()

    numeric = [
        "xa",
        "chances_created",
        "final_third_passes",
        "xgot_faced",
        "goals_prevented",
    ]
    usable = player_rows.copy()
    for column in numeric:
        usable[column] = pd.to_numeric(usable[column], errors="coerce")

    grouped = (
        usable.groupby(
            ["provider_match_id", "team"],
            as_index=False,
            dropna=False,
        )
        .agg(
            xa=("xa", lambda values: values.sum(min_count=1)),
            key_passes=(
                "chances_created",
                lambda values: values.sum(min_count=1),
            ),
            final_third_passes=(
                "final_third_passes",
                lambda values: values.sum(min_count=1),
            ),
            xgot_faced=(
                "xgot_faced",
                lambda values: values.sum(min_count=1),
            ),
            goals_prevented=(
                "goals_prevented",
                lambda values: values.sum(min_count=1),
            ),
        )
    )

    out = team_rows.merge(
        grouped,
        on=["provider_match_id", "team"],
        how="left",
        suffixes=("", "_players"),
        validate="one_to_one",
    )
    for column in [
        "xa",
        "key_passes",
        "final_third_passes",
        "xgot_faced",
        "goals_prevented",
    ]:
        player_column = f"{column}_players"
        if player_column not in out.columns:
            continue
        if column in out.columns:
            out[column] = out[column].combine_first(out[player_column])
        else:
            out[column] = out[player_column]
        out = out.drop(columns=[player_column])
    return out
