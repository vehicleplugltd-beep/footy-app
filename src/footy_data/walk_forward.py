from __future__ import annotations

import pandas as pd

from .features import add_rolling_process, add_home_away_process
from .model import market_probabilities
from .xg_engine import TeamProcess, LeagueEnvironment, estimate_match_xg


def _league_environment_before_match(
    frame: pd.DataFrame,
    league: str,
    match_date,
    prior_goals_per_team_match: float = 1.35,
    prior_weight_matches: float = 30.0,
) -> float:
    """
    Estimate the league scoring environment using only earlier matches.

    A 30-match prior prevents the first few fixtures of a season from creating
    extreme league baselines.
    """
    prior = frame[
        (frame["league"] == league)
        & (frame["match_date"] < match_date)
    ]
    if prior.empty:
        return prior_goals_per_team_match

    observed_team_rows = len(prior)
    observed_xg = float(prior["xg"].mean())
    weight = observed_team_rows / (observed_team_rows + 2 * prior_weight_matches)
    return (
        weight * observed_xg
        + (1 - weight) * prior_goals_per_team_match
    )


def build_walk_forward_predictions(
    match_team_metrics: pd.DataFrame,
    min_team_matches: int = 5,
    prior_goals_per_team_match: float = 1.35,
) -> pd.DataFrame:
    """
    Produce historical pre-match predictions with strict temporal ordering.

    Input must contain one home and one away row per match. Rolling team
    features are shifted, so the current match never contributes to its own
    estimate.
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

        home_attack = home.get("xg_venue_process")
        home_defence = home.get("xga_venue_process")
        away_attack = away.get("xg_venue_process")
        away_defence = away.get("xga_venue_process")

        if pd.isna(home_attack):
            home_attack = home.get("xg_process")
        if pd.isna(home_defence):
            home_defence = home.get("xga_process")
        if pd.isna(away_attack):
            away_attack = away.get("xg_process")
        if pd.isna(away_defence):
            away_defence = away.get("xga_process")

        values = [home_attack, home_defence, away_attack, away_defence]
        if any(pd.isna(v) for v in values):
            continue

        league_xg = _league_environment_before_match(
            frame,
            league=str(home["league"]),
            match_date=home["match_date"],
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
            ),
            use_elo=False,
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
