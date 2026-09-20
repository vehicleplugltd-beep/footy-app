from __future__ import annotations

from datetime import datetime, timezone
import pandas as pd

from footy_data.identity import default_resolver
from footy_data.normalise import canonical_text


def _canonical_team(value: object) -> str:
    return default_resolver().resolve(str(value))


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
