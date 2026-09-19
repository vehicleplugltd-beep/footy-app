from __future__ import annotations

import pandas as pd

from .features import add_rolling_process, add_home_away_process
from .model import market_probabilities
from .xg_engine import TeamProcess, LeagueEnvironment, estimate_match_xg


def _league_metric_before_match(
    frame: pd.DataFrame,
    league: str,
    match_date,
    metric: str,
    prior_value: float,
    prior_weight_matches: float = 30.0,
) -> float:
    prior = frame[
        (frame["league"] == league)
        & (frame["match_date"] < match_date)
    ]
    if prior.empty or metric not in prior.columns:
        return prior_value

    values = pd.to_numeric(prior[metric], errors="coerce").dropna()
    if values.empty:
        return prior_value

    observed_team_rows = len(values)
    observed = float(values.mean())
    weight = observed_team_rows / (
        observed_team_rows + 2 * prior_weight_matches
    )
    return weight * observed + (1 - weight) * prior_value


def _league_environment_before_match(
    frame: pd.DataFrame,
    league: str,
    match_date,
    prior_goals_per_team_match: float = 1.35,
    prior_weight_matches: float = 30.0,
) -> float:
    return _league_metric_before_match(
        frame=frame,
        league=league,
        match_date=match_date,
        metric="xg",
        prior_value=prior_goals_per_team_match,
        prior_weight_matches=prior_weight_matches,
    )


def _league_strength_baseline_before_match(
    frame: pd.DataFrame,
    league: str,
    match_date,
    npxg_weight: float,
    prior_goals_per_team_match: float = 1.35,
    prior_penalty_xg_per_team_match: float = 0.10,
    prior_weight_matches: float = 30.0,
) -> float:
    raw_xg = _league_metric_before_match(
        frame=frame,
        league=league,
        match_date=match_date,
        metric="xg",
        prior_value=prior_goals_per_team_match,
        prior_weight_matches=prior_weight_matches,
    )
    npxg_prior = max(
        prior_goals_per_team_match - prior_penalty_xg_per_team_match,
        0.5,
    )
    nonpen_xg = _league_metric_before_match(
        frame=frame,
        league=league,
        match_date=match_date,
        metric="npxg",
        prior_value=npxg_prior,
        prior_weight_matches=prior_weight_matches,
    )
    return (1 - npxg_weight) * raw_xg + npxg_weight * nonpen_xg


def _process_value(row: pd.Series, metric: str):
    venue = row.get(f"{metric}_venue_process")
    if pd.notna(venue):
        return venue
    return row.get(f"{metric}_process")


def build_walk_forward_predictions(
    match_team_metrics: pd.DataFrame,
    min_team_matches: int = 5,
    prior_goals_per_team_match: float = 1.35,
    use_elo: bool = False,
    process_mode: str = "xg",
    npxg_weight: float = 0.70,
) -> pd.DataFrame:
    """
    Produce historical pre-match predictions with strict temporal ordering.

    process_mode="xg" uses raw xG/xGA team strength.
    process_mode="npxg_blend" uses a weighted blend of npxG and raw xG for
    relative team strength while keeping final league scoring anchored to raw
    xG. This reduces penalty noise without erasing expected penalty scoring.
    """
    required = {
        "match_id", "match_date", "league", "season",
        "team", "opponent", "home_away",
        "goals", "goals_conceded", "xg", "xga",
    }
    missing = required - set(match_team_metrics.columns)
    if missing:
        raise ValueError(
            "Walk-forward input missing columns: " + ", ".join(sorted(missing))
        )

    if process_mode not in {"xg", "npxg_blend"}:
        raise ValueError("process_mode must be 'xg' or 'npxg_blend'.")
    if not 0 <= npxg_weight <= 1:
        raise ValueError("npxg_weight must be in [0, 1].")
    if process_mode == "npxg_blend":
        missing_nonpen = {"npxg", "npxga"} - set(match_team_metrics.columns)
        if missing_nonpen:
            raise ValueError(
                "npxg_blend requires columns: "
                + ", ".join(sorted(missing_nonpen))
            )

    frame = match_team_metrics.copy()
    frame["match_date"] = pd.to_datetime(frame["match_date"], utc=True)
    frame = add_rolling_process(frame)
    frame = add_home_away_process(frame)

    rows = []
    for match_id, match in frame.groupby("match_id", sort=False):
        home_rows = match[match["home_away"] == "H"]
        away_rows = match[match["home_away"] == "A"]
        if len(home_rows) != 1 or len(away_rows) != 1:
            continue

        home = home_rows.iloc[0]
        away = away_rows.iloc[0]

        if (
            home["team_matches_before"] < min_team_matches
            or away["team_matches_before"] < min_team_matches
        ):
            continue

        home_attack_xg = _process_value(home, "xg")
        home_defence_xg = _process_value(home, "xga")
        away_attack_xg = _process_value(away, "xg")
        away_defence_xg = _process_value(away, "xga")

        if process_mode == "npxg_blend":
            home_attack_np = _process_value(home, "npxg")
            home_defence_np = _process_value(home, "npxga")
            away_attack_np = _process_value(away, "npxg")
            away_defence_np = _process_value(away, "npxga")

            blend_values = [
                home_attack_xg, home_defence_xg,
                away_attack_xg, away_defence_xg,
                home_attack_np, home_defence_np,
                away_attack_np, away_defence_np,
            ]
            if any(pd.isna(v) for v in blend_values):
                continue

            home_attack = (
                (1 - npxg_weight) * home_attack_xg
                + npxg_weight * home_attack_np
            )
            home_defence = (
                (1 - npxg_weight) * home_defence_xg
                + npxg_weight * home_defence_np
            )
            away_attack = (
                (1 - npxg_weight) * away_attack_xg
                + npxg_weight * away_attack_np
            )
            away_defence = (
                (1 - npxg_weight) * away_defence_xg
                + npxg_weight * away_defence_np
            )
        else:
            home_attack = home_attack_xg
            home_defence = home_defence_xg
            away_attack = away_attack_xg
            away_defence = away_defence_xg

        values = [home_attack, home_defence, away_attack, away_defence]
        if any(pd.isna(v) for v in values):
            continue

        league_xg = _league_environment_before_match(
            frame,
            league=str(home["league"]),
            match_date=home["match_date"],
            prior_goals_per_team_match=prior_goals_per_team_match,
        )
        strength_baseline = league_xg
        if process_mode == "npxg_blend":
            strength_baseline = _league_strength_baseline_before_match(
                frame=frame,
                league=str(home["league"]),
                match_date=home["match_date"],
                npxg_weight=npxg_weight,
                prior_goals_per_team_match=prior_goals_per_team_match,
            )

        home_elo = home.get("team_elo") if use_elo else None
        away_elo = away.get("team_elo") if use_elo else None
        elo_available = (
            use_elo
            and pd.notna(home_elo)
            and pd.notna(away_elo)
        )

        estimate = estimate_match_xg(
            TeamProcess(
                attack_xg=float(home_attack),
                defence_xga=float(home_defence),
                matches=int(home["team_matches_before"]),
                elo=float(home_elo) if elo_available else None,
            ),
            TeamProcess(
                attack_xg=float(away_attack),
                defence_xga=float(away_defence),
                matches=int(away["team_matches_before"]),
                elo=float(away_elo) if elo_available else None,
            ),
            LeagueEnvironment(
                goals_per_team_match=float(league_xg),
                home_advantage_ratio=1.10,
                strength_baseline=float(strength_baseline),
            ),
            use_elo=bool(elo_available),
        )
        probs = market_probabilities(estimate.expected_goals)

        hg = int(home["goals"])
        ag = int(away["goals"])

        rows.append({
            "match_id": str(match_id),
            "match_date": home["match_date"],
            "league": home["league"],
            "season": str(home["season"]),
            "home_team": home["team"],
            "away_team": away["team"],
            "home_goals": hg,
            "away_goals": ag,
            "model_home_xg": estimate.expected_goals.home,
            "model_away_xg": estimate.expected_goals.away,
            "uncertainty_haircut": estimate.uncertainty_haircut,
            "home_elo": float(home_elo) if elo_available else None,
            "away_elo": float(away_elo) if elo_available else None,
            "home_win_probability": probs["home_win"],
            "draw_probability": probs["draw"],
            "away_win_probability": probs["away_win"],
            "over_2_5_probability": probs["over_2_5"],
            "btts_yes_probability": probs["btts_yes"],
            "home_win_actual": int(hg > ag),
            "draw_actual": int(hg == ag),
            "away_win_actual": int(hg < ag),
            "over_2_5_actual": int(hg + ag >= 3),
            "btts_yes_actual": int(hg > 0 and ag > 0),
        })

    return pd.DataFrame(rows).sort_values("match_date").reset_index(drop=True)
