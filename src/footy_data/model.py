from __future__ import annotations

from dataclasses import dataclass
from math import exp, factorial
from typing import Dict, Tuple


@dataclass(frozen=True)
class ExpectedGoals:
    home: float
    away: float


def poisson_pmf(k: int, lam: float) -> float:
    return exp(-lam) * (lam ** k) / factorial(k)


def score_matrix(xg: ExpectedGoals, max_goals: int = 10) -> Dict[Tuple[int, int], float]:
    matrix: Dict[Tuple[int, int], float] = {}
    for h in range(max_goals + 1):
        ph = poisson_pmf(h, xg.home)
        for a in range(max_goals + 1):
            matrix[(h, a)] = ph * poisson_pmf(a, xg.away)
    return matrix


def market_probabilities(xg: ExpectedGoals, max_goals: int = 10) -> dict[str, float]:
    matrix = score_matrix(xg, max_goals=max_goals)
    total = sum(matrix.values())
    home = sum(p for (h, a), p in matrix.items() if h > a) / total
    draw = sum(p for (h, a), p in matrix.items() if h == a) / total
    away = sum(p for (h, a), p in matrix.items() if h < a) / total
    over_25 = sum(p for (h, a), p in matrix.items() if h + a >= 3) / total
    btts = sum(p for (h, a), p in matrix.items() if h >= 1 and a >= 1) / total
    return {
        "home_win": home,
        "draw": draw,
        "away_win": away,
        "over_2_5": over_25,
        "under_2_5": 1 - over_25,
        "btts_yes": btts,
        "btts_no": 1 - btts,
    }


def fair_odds(probability: float) -> float:
    if not 0 < probability <= 1:
        raise ValueError("Probability must be in (0, 1].")
    return 1.0 / probability


def expected_value(probability: float, decimal_odds: float) -> float:
    return probability * decimal_odds - 1.0


def minimum_take_price(
    probability: float,
    uncertainty_haircut: float = 0.04,
    target_ev: float = 0.02,
) -> float:
    if not 0 <= uncertainty_haircut < 1:
        raise ValueError("uncertainty_haircut must be in [0, 1).")
    conservative_p = probability * (1 - uncertainty_haircut)
    return (1 + target_ev) / conservative_p


def calibrate_expected_goals(
    xg: ExpectedGoals,
    beta: float = 1.0,
    home_scale: float = 1.0,
    away_scale: float = 1.0,
) -> ExpectedGoals:
    """
    Apply a transparent power calibration to model scoring intensities.

    Parameters should be fitted on historical outcomes without bookmaker
    prices, then frozen before out-of-sample evaluation.
    """
    if beta <= 0:
        raise ValueError("beta must be positive.")
    if home_scale <= 0 or away_scale <= 0:
        raise ValueError("lambda scales must be positive.")

    return ExpectedGoals(
        home=float(home_scale * (xg.home ** beta)),
        away=float(away_scale * (xg.away ** beta)),
    )
