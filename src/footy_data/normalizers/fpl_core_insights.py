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



def _verified_penalty_xg_value(
    player_match_stats: pd.DataFrame,
) -> float | None:
    """
    Infer the provider's penalty xG convention from rows where every shot is a
    recorded penalty. Fail closed unless at least two observations agree
    tightly enough to support the derivation.
    """
    required = {
        "total_shots",
        "xg",
        "penalties_scored",
        "penalties_missed",
    }
    if not required.issubset(player_match_stats.columns):
        return None

    frame = player_match_stats.copy()
    shots = pd.to_numeric(frame["total_shots"], errors="coerce")
    xg = pd.to_numeric(frame["xg"], errors="coerce")
    scored = pd.to_numeric(
        frame["penalties_scored"], errors="coerce"
    ).fillna(0)
    missed = pd.to_numeric(
        frame["penalties_missed"], errors="coerce"
    ).fillna(0)
    penalties = scored + missed

    pure_penalty = frame[
        (penalties > 0)
        & shots.notna()
        & xg.notna()
        & (shots == penalties)
    ].copy()
    if len(pure_penalty) < 2:
        return None

    penalty_counts = (
        pd.to_numeric(
            pure_penalty["penalties_scored"], errors="coerce"
        ).fillna(0)
        + pd.to_numeric(
            pure_penalty["penalties_missed"], errors="coerce"
        ).fillna(0)
    )
    values = (
        pd.to_numeric(pure_penalty["xg"], errors="coerce")
        / penalty_counts.replace(0, pd.NA)
    ).dropna()
    if len(values) < 2:
        return None

    median = float(values.median())
    max_deviation = float((values - median).abs().max())
    if not 0.72 <= median <= 0.86 or max_deviation > 0.03:
        return None
    return median


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
        "penalties_scored": "penalties_scored",
        "penalties_missed": "penalties_missed",
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

    penalty_xg_value = _verified_penalty_xg_value(player_match_stats)

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
        if str(match.get("player_stats_processed")).lower() != "true":
            continue

        team_code = _number(player.get("team_code"))
        if pd.isna(team_code):
            continue
        team = team_by_code.get(int(float(team_code)))
        # FPL-Core match rows use the persistent club code, not the
        # season-scoped FPL team id. Keep the same identity key as players.csv.
        home_code = _number(match.get("home_team"))
        away_code = _number(match.get("away_team"))
        home = (
            team_by_code.get(int(float(home_code)))
            if not pd.isna(home_code)
            else None
        )
        away = (
            team_by_code.get(int(float(away_code)))
            if not pd.isna(away_code)
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

        penalties = (
            0.0
            if pd.isna(record["penalties_scored"])
            else float(record["penalties_scored"])
        ) + (
            0.0
            if pd.isna(record["penalties_missed"])
            else float(record["penalties_missed"])
        )
        if penalty_xg_value is not None and not pd.isna(record["xg"]):
            record["npxg"] = max(
                0.0,
                float(record["xg"]) - penalty_xg_value * penalties,
            )
            record["penalty_xg_value"] = penalty_xg_value
        else:
            # Reliable current NPxG is preferable to a silent 0.76/0.79
            # assumption. The web model will exclude NPxG when this is null.
            record["npxg"] = float("nan")
            record["penalty_xg_value"] = float("nan")
        rows.append(record)

    return pd.DataFrame(rows)


def reconcile_fpl_core_player_matches_to_footy(
    player_rows: pd.DataFrame,
    footy: pd.DataFrame,
) -> tuple[pd.DataFrame, float]:
    if player_rows.empty or footy.empty:
        return player_rows.copy(), 0.0

    out = player_rows.copy()
    league_mask = out["competition"].astype(str).str.lower().eq("prem")
    league = out.loc[
        league_mask,
        ["provider_match_id", "kickoff_at", "team", "opponent"],
    ].drop_duplicates()

    league["date_key"] = pd.to_datetime(
        league["kickoff_at"], errors="coerce", utc=True
    ).dt.floor("D")
    league["team_key"] = league["team"].map(canonical_text)
    league["opponent_key"] = league["opponent"].map(canonical_text)

    f = footy.copy()
    f["date_key"] = pd.to_datetime(
        f["match_date"], errors="coerce", utc=True
    ).dt.floor("D")
    f["team_key"] = f["team"].map(canonical_text)
    f["opponent_key"] = f["opponent"].map(canonical_text)

    matched = league.merge(
        f[["match_id", "date_key", "team_key", "opponent_key"]],
        on=["date_key", "team_key", "opponent_key"],
        how="left",
        validate="many_to_one",
    )
    mapping = (
        matched.dropna(subset=["match_id"])
        [["provider_match_id", "match_id"]]
        .drop_duplicates()
    )
    ambiguous = mapping.groupby("provider_match_id")["match_id"].nunique()
    bad = set(ambiguous[ambiguous > 1].index.astype(str))
    if bad:
        mapping = mapping[~mapping["provider_match_id"].astype(str).isin(bad)]

    match_map = (
        mapping.drop_duplicates("provider_match_id")
        .set_index("provider_match_id")["match_id"]
        .astype(str)
        .to_dict()
    )
    out.loc[league_mask, "footy_match_id"] = out.loc[
        league_mask, "provider_match_id"
    ].map(match_map)

    distinct_matches = league["provider_match_id"].nunique()
    linked_matches = out.loc[
        league_mask & out["footy_match_id"].notna(),
        "provider_match_id",
    ].nunique()
    match_rate = (
        float(linked_matches / distinct_matches)
        if distinct_matches
        else 0.0
    )
    return out, match_rate


def supplement_fpl_core_team_rows_from_players(
    team_rows: pd.DataFrame,
    player_rows: pd.DataFrame,
    footy: pd.DataFrame,
) -> pd.DataFrame:
    """
    Add a sparse team row when the upstream team-stat block is not processed
    but player stats are processed and identity-linked.

    Only player-derived fields are later promoted. Team-only fields remain
    null, preserving the upstream processing distinction.
    """
    if player_rows.empty or footy.empty:
        return team_rows.copy()

    linked = player_rows[
        player_rows["competition"].astype(str).str.lower().eq("prem")
        & player_rows["footy_match_id"].notna()
    ].copy()
    if linked.empty:
        return team_rows.copy()

    base = (
        linked.groupby(
            ["provider_match_id", "footy_match_id", "team"],
            as_index=False,
            dropna=False,
        )
        .agg(match_date=("kickoff_at", "first"))
        .rename(columns={"footy_match_id": "match_id"})
    )
    side = footy[["match_id", "team", "opponent", "home_away"]].copy()
    base = base.merge(
        side,
        on=["match_id", "team"],
        how="left",
        validate="many_to_one",
    )
    base["source"] = "fpl-core-insights"
    base["retrieved_at"] = datetime.now(timezone.utc).isoformat()

    existing = set()
    if not team_rows.empty:
        existing = set(
            zip(
                team_rows["match_id"].astype(str),
                team_rows["team"].astype(str),
            )
        )
    missing = base[
        ~base.apply(
            lambda row: (str(row["match_id"]), str(row["team"])) in existing,
            axis=1,
        )
    ].copy()

    if missing.empty:
        return team_rows.copy()
    return pd.concat([team_rows, missing], ignore_index=True, sort=False)

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
        "shots",
        "shots_on_target",
        "box_touches",
        "xa",
        "chances_created",
        "final_third_passes",
        "xgot",
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
            shots=("shots", lambda values: values.sum(min_count=1)),
            shots_on_target=(
                "shots_on_target",
                lambda values: values.sum(min_count=1),
            ),
            box_touches=(
                "box_touches",
                lambda values: values.sum(min_count=1),
            ),
            xa=("xa", lambda values: values.sum(min_count=1)),
            key_passes=(
                "chances_created",
                lambda values: values.sum(min_count=1),
            ),
            final_third_passes=(
                "final_third_passes",
                lambda values: values.sum(min_count=1),
            ),
            xgot=("xgot", lambda values: values.sum(min_count=1)),
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
        "shots",
        "shots_on_target",
        "box_touches",
        "xa",
        "key_passes",
        "final_third_passes",
        "xgot",
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



def normalise_fpl_core_player_priors(
    player_stats: pd.DataFrame,
    players: pd.DataFrame,
    teams: pd.DataFrame,
    season: str,
    retrieved_at: str | None = None,
) -> pd.DataFrame:
    """
    Build stable-code season priors from the completed FPL season snapshot.

    player_code is the cross-season identity key. Rates are recomputed from
    official season totals/minutes where possible so the prior has one
    transparent definition.
    """
    if player_stats.empty or players.empty:
        return pd.DataFrame()

    stamp = retrieved_at or datetime.now(timezone.utc).isoformat()
    player_lookup = {
        int(float(row["player_id"])): row
        for _, row in players.dropna(subset=["player_id"]).iterrows()
    }
    team_by_code = {
        int(float(row["code"])): _canonical_team(row["name"])
        for _, row in teams.dropna(subset=["code", "name"]).iterrows()
    }

    def rate90(total: object, minutes: object):
        value = _number(total)
        played = _number(minutes)
        if pd.isna(value) or pd.isna(played) or float(played) <= 0:
            return float("nan")
        return float(value) * 90.0 / float(played)

    rows: list[dict] = []
    for _, stat in player_stats.iterrows():
        player_id = _number(stat.get("id"))
        if pd.isna(player_id):
            continue
        player = player_lookup.get(int(float(player_id)))
        if player is None:
            continue

        player_code = _number(player.get("player_code"))
        if pd.isna(player_code):
            continue

        minutes = _number(stat.get("minutes"))
        starts = _number(stat.get("starts"))
        xg = _number(stat.get("expected_goals"))
        xa = _number(stat.get("expected_assists"))
        xgi = _number(stat.get("expected_goal_involvements"))
        if pd.isna(xgi) and not pd.isna(xg) and not pd.isna(xa):
            xgi = float(xg) + float(xa)

        team_code = _number(player.get("team_code"))
        team = (
            team_by_code.get(int(float(team_code)))
            if not pd.isna(team_code)
            else None
        )
        defensive = _number(stat.get("defensive_contribution"))
        saves = _number(stat.get("saves"))

        rows.append({
            "season": str(season),
            "player_code": int(float(player_code)),
            "player_id": int(float(player_id)),
            "player_name": str(
                player.get("web_name")
                or stat.get("web_name")
                or int(float(player_id))
            ),
            "position": str(player.get("position") or ""),
            "team": team,
            "minutes": minutes if not pd.isna(minutes) else 0.0,
            "starts": starts,
            "total_points": _number(stat.get("total_points")),
            "xg": xg,
            "xa": xa,
            "xgi": xgi,
            "xg_per90": rate90(xg, minutes),
            "xa_per90": rate90(xa, minutes),
            "xgi_per90": rate90(xgi, minutes),
            "starts_per90": rate90(starts, minutes),
            "defensive_contributions": defensive,
            "defensive_contribution_per90": rate90(defensive, minutes),
            "saves_per90": rate90(saves, minutes),
            "source": "fpl-core-insights:official-fpl-season",
            "verified": True,
            "verification_status": "PASS",
            "retrieved_at": stamp,
        })

    return pd.DataFrame(rows)
