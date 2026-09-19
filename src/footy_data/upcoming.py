from __future__ import annotations

from datetime import datetime, timezone
import pandas as pd

from .features import (
    add_rolling_process,
    add_home_away_process,
    add_schedule_adjusted_process,
)
from .model import (
    calibrate_expected_goals,
    fair_odds,
    market_probabilities,
    minimum_take_price,
)
from .walk_forward import _league_environment_before_match, _process_value
from .xg_engine import TeamProcess, LeagueEnvironment, estimate_match_xg


def normalise_upcoming_fixtures(
    schedule: pd.DataFrame,
    horizon_days: int = 10,
    now: pd.Timestamp | None = None,
) -> pd.DataFrame:
    required = {
        "league", "season", "game", "date", "home_team", "away_team",
    }
    missing = required - set(schedule.columns)
    if missing:
        raise ValueError(
            "Understat schedule missing columns: "
            + ", ".join(sorted(missing))
        )

    current = now or pd.Timestamp.now(tz="UTC")
    if current.tzinfo is None:
        current = current.tz_localize("UTC")
    else:
        current = current.tz_convert("UTC")
    end = current + pd.Timedelta(days=horizon_days)

    frame = schedule.copy()
    frame["match_date"] = pd.to_datetime(
        frame["date"], errors="coerce", utc=True
    )
    frame = frame[
        frame["match_date"].between(current, end, inclusive="both")
    ].copy()
    if "is_result" in frame.columns:
        frame = frame[~frame["is_result"].fillna(False).astype(bool)]

    stamp = datetime.now(timezone.utc).isoformat()
    frame["match_id"] = frame["game"].astype(str)
    frame["kickoff_at"] = frame["match_date"]
    frame["status"] = "scheduled"
    frame["source"] = "understat"
    frame["retrieved_at"] = stamp

    columns = [
        "match_id", "league", "season", "match_date", "kickoff_at",
        "home_team", "away_team", "status", "source", "retrieved_at",
    ]
    return (
        frame[columns]
        .sort_values("match_date")
        .drop_duplicates("match_id")
        .reset_index(drop=True)
    )


def _fixture_dummy_rows(fixture: pd.Series) -> pd.DataFrame:
    common = {
        "match_id": str(fixture["match_id"]),
        "match_date": fixture["match_date"],
        "league": fixture["league"],
        "season": str(fixture["season"]),
        "goals": None,
        "goals_conceded": None,
        "xg": None,
        "xga": None,
        "npxg": None,
        "npxga": None,
        "ppda": None,
        "deep_completions": None,
        "source": "understat",
        "retrieved_at": fixture.get("retrieved_at"),
    }
    return pd.DataFrame([
        {
            **common,
            "team": fixture["home_team"],
            "opponent": fixture["away_team"],
            "home_away": "H",
        },
        {
            **common,
            "team": fixture["away_team"],
            "opponent": fixture["home_team"],
            "home_away": "A",
        },
    ])


def build_upcoming_predictions(
    history: pd.DataFrame,
    fixtures: pd.DataFrame,
    model_version: str,
    min_team_matches: int = 5,
    prior_goals_per_team_match: float = 1.35,
    lambda_beta: float = 1.0,
    home_lambda_scale: float = 1.0,
    away_lambda_scale: float = 1.0,
    process_span: int = 16,
    process_prior_weight: float = 0.50,
    venue_split_weight: float = 0.20,
) -> pd.DataFrame:
    if fixtures.empty:
        return pd.DataFrame()

    required_history = {
        "match_id", "match_date", "league", "season",
        "team", "opponent", "home_away",
        "goals", "goals_conceded", "xg", "xga",
    }
    missing = required_history - set(history.columns)
    if missing:
        raise ValueError(
            "History missing columns: " + ", ".join(sorted(missing))
        )

    historical = history.copy()
    historical["match_date"] = pd.to_datetime(
        historical["match_date"], errors="coerce", utc=True
    )
    historical = historical[
        historical["xg"].notna() & historical["xga"].notna()
    ].copy()

    rows: list[dict] = []

    for _, fixture in fixtures.sort_values("match_date").iterrows():
        dummy = _fixture_dummy_rows(fixture)
        combined = pd.concat(
            [historical, dummy],
            ignore_index=True,
            sort=False,
        )
        combined = add_rolling_process(
            combined,
            span=process_span,
            prior_weight=process_prior_weight,
        )
        combined = add_home_away_process(
            combined,
            span=process_span,
            split_weight=venue_split_weight,
        )
        combined = add_schedule_adjusted_process(
            combined,
            league_xg_prior=prior_goals_per_team_match,
            league_npxg_prior=max(
                prior_goals_per_team_match - 0.10,
                0.5,
            ),
            span=process_span,
            prior_weight=process_prior_weight,
            split_weight=venue_split_weight,
        )

        current = combined[
            combined["match_id"].astype(str) == str(fixture["match_id"])
        ]
        home_rows = current[current["home_away"] == "H"]
        away_rows = current[current["home_away"] == "A"]
        if len(home_rows) != 1 or len(away_rows) != 1:
            continue

        home = home_rows.iloc[0]
        away = away_rows.iloc[0]
        if (
            home["team_matches_before"] < min_team_matches
            or away["team_matches_before"] < min_team_matches
        ):
            continue

        home_attack = _process_value(home, "xg_sched")
        home_defence = _process_value(home, "xga_sched")
        away_attack = _process_value(away, "xg_sched")
        away_defence = _process_value(away, "xga_sched")
        values = [home_attack, home_defence, away_attack, away_defence]
        if any(pd.isna(v) for v in values):
            continue

        league_xg = _league_environment_before_match(
            combined,
            league=str(fixture["league"]),
            match_date=fixture["match_date"],
            prior_goals_per_team_match=prior_goals_per_team_match,
        )
        estimate = estimate_match_xg(
            TeamProcess(
                attack_xg=float(home_attack),
                defence_xga=float(home_defence),
                matches=int(home["team_matches_before"]),
            ),
            TeamProcess(
                attack_xg=float(away_attack),
                defence_xga=float(away_defence),
                matches=int(away["team_matches_before"]),
            ),
            LeagueEnvironment(
                goals_per_team_match=float(league_xg),
                home_advantage_ratio=1.10,
                strength_baseline=float(league_xg),
            ),
            use_elo=False,
        )
        xg = calibrate_expected_goals(
            estimate.expected_goals,
            beta=lambda_beta,
            home_scale=home_lambda_scale,
            away_scale=away_lambda_scale,
        )
        probs = market_probabilities(xg)

        rows.append({
            "match_id": str(fixture["match_id"]),
            "match_date": fixture["match_date"],
            "league": fixture["league"],
            "season": str(fixture["season"]),
            "home_team": fixture["home_team"],
            "away_team": fixture["away_team"],
            "model_version": model_version,
            "home_xg": xg.home,
            "away_xg": xg.away,
            "uncertainty_haircut": estimate.uncertainty_haircut,
            "home_win_probability": probs["home_win"],
            "draw_probability": probs["draw"],
            "away_win_probability": probs["away_win"],
        })

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows).sort_values("match_date").reset_index(drop=True)


def model_output_records(
    predictions: pd.DataFrame,
    target_ev: float = 0.02,
) -> list[dict]:
    records: list[dict] = []
    for row in predictions.itertuples(index=False):
        selections = (
            ("home", float(row.home_win_probability)),
            ("draw", float(row.draw_probability)),
            ("away", float(row.away_win_probability)),
        )
        for selection, probability in selections:
            records.append({
                "match_id": str(row.match_id),
                "model_version": str(row.model_version),
                "home_xg": float(row.home_xg),
                "away_xg": float(row.away_xg),
                "market": "1X2",
                "selection": selection,
                "model_probability": probability,
                "fair_odds": fair_odds(probability),
                "uncertainty_haircut": float(row.uncertainty_haircut),
                "minimum_take_price": minimum_take_price(
                    probability,
                    uncertainty_haircut=float(row.uncertainty_haircut),
                    target_ev=target_ev,
                ),
            })
    return records
