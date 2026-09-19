from __future__ import annotations

from dataclasses import dataclass
from math import exp
import numpy as np

from .model import ExpectedGoals


@dataclass(frozen=True)
class TeamProcess:
    attack_xg: float
    defence_xga: float
    matches: int
    elo: float | None = None


@dataclass(frozen=True)
class LeagueEnvironment:
    goals_per_team_match: float = 1.35
    home_advantage_ratio: float = 1.10
    mean_elo: float = 1500.0
    strength_baseline: float | None = None


@dataclass(frozen=True)
class XGEstimate:
    expected_goals: ExpectedGoals
    uncertainty_haircut: float
    components: dict[str, float]


def _safe(value: float, floor: float = 0.15, ceiling: float = 3.5) -> float:
    return float(np.clip(value, floor, ceiling))


def estimate_match_xg(
    home: TeamProcess,
    away: TeamProcess,
    env: LeagueEnvironment = LeagueEnvironment(),
    use_elo: bool = True,
) -> XGEstimate:
    league = env.goals_per_team_match
    strength_baseline = (
        env.strength_baseline
        if env.strength_baseline is not None
        else league
    )
    strength_baseline = _safe(strength_baseline)

    home_attack_strength = _safe(home.attack_xg) / strength_baseline
    away_defence_weakness = _safe(away.defence_xga) / strength_baseline
    away_attack_strength = _safe(away.attack_xg) / strength_baseline
    home_defence_weakness = _safe(home.defence_xga) / strength_baseline

    home_lambda = league * home_attack_strength * away_defence_weakness
    away_lambda = league * away_attack_strength * home_defence_weakness
    home_lambda *= env.home_advantage_ratio
    away_lambda /= env.home_advantage_ratio

    elo_home_factor = 1.0
    if use_elo and home.elo is not None and away.elo is not None:
        elo_delta = home.elo - away.elo
        elo_home_factor = exp((elo_delta / 400.0) * 0.115)
        home_lambda *= elo_home_factor
        away_lambda /= elo_home_factor

    n = max(min(home.matches, away.matches), 1)
    uncertainty = min(0.18, 0.06 * np.sqrt(16 / n))

    return XGEstimate(
        expected_goals=ExpectedGoals(
            float(np.clip(home_lambda, 0.20, 3.80)),
            float(np.clip(away_lambda, 0.20, 3.80)),
        ),
        uncertainty_haircut=float(uncertainty),
        components={
            "home_attack_strength": home_attack_strength,
            "away_defence_weakness": away_defence_weakness,
            "away_attack_strength": away_attack_strength,
            "home_defence_weakness": home_defence_weakness,
            "home_advantage_ratio": env.home_advantage_ratio,
            "strength_baseline": strength_baseline,
            "elo_home_factor": elo_home_factor,
            "sample_size_used": float(n),
        },
    )
