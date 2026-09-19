from __future__ import annotations

from dataclasses import dataclass
from math import floor
from typing import Callable

from .model import ExpectedGoals, score_matrix


@dataclass(frozen=True)
class SettlementWeights:
    win_weight: float
    loss_weight: float
    push_weight: float

    @property
    def fair_odds(self) -> float:
        if self.win_weight <= 0:
            return float("inf")
        return 1.0 + self.loss_weight / self.win_weight

    def expected_value(self, decimal_odds: float) -> float:
        return self.win_weight * (decimal_odds - 1.0) - self.loss_weight

    def minimum_take_price(
        self,
        uncertainty_haircut: float = 0.04,
        target_ev: float = 0.02,
    ) -> float:
        if not 0 <= uncertainty_haircut < 1:
            raise ValueError("uncertainty_haircut must be in [0, 1).")
        conservative_win = self.win_weight * (1 - uncertainty_haircut)
        conservative_loss = self.loss_weight + self.win_weight * uncertainty_haircut
        if conservative_win <= 0:
            return float("inf")
        return 1.0 + (conservative_loss + target_ev) / conservative_win


def _split_quarter_line(line: float) -> list[tuple[float, float]]:
    q = round(line * 4)
    if abs(line * 4 - q) > 1e-8:
        raise ValueError("Asian line must be in 0.25 increments.")
    if q % 2 == 0:
        return [(line, 1.0)]
    low = floor(line * 2) / 2
    high = low + 0.5
    return [(low, 0.5), (high, 0.5)]


def _component_result(margin: float) -> int:
    if margin > 1e-9:
        return 1
    if margin < -1e-9:
        return -1
    return 0


def _weights_from_score_matrix(
    xg: ExpectedGoals,
    settlement: Callable[[int, int], tuple[float, float, float]],
    max_goals: int = 12,
) -> SettlementWeights:
    matrix = score_matrix(xg, max_goals=max_goals)
    total_prob = sum(matrix.values())
    w = l = p = 0.0
    for (home, away), prob in matrix.items():
        prob /= total_prob
        sw, sl, sp = settlement(home, away)
        w += prob * sw
        l += prob * sl
        p += prob * sp
    return SettlementWeights(w, l, p)


def asian_handicap(
    xg: ExpectedGoals,
    side: str,
    line: float,
    max_goals: int = 12,
) -> SettlementWeights:
    if side not in {"home", "away"}:
        raise ValueError("side must be 'home' or 'away'.")
    components = _split_quarter_line(line)

    def settle(home: int, away: int):
        raw_diff = home - away if side == "home" else away - home
        win = loss = push = 0.0
        for component, stake in components:
            result = _component_result(raw_diff + component)
            if result > 0:
                win += stake
            elif result < 0:
                loss += stake
            else:
                push += stake
        return win, loss, push

    return _weights_from_score_matrix(xg, settle, max_goals)


def asian_total(
    xg: ExpectedGoals,
    selection: str,
    line: float,
    max_goals: int = 12,
) -> SettlementWeights:
    if selection not in {"over", "under"}:
        raise ValueError("selection must be 'over' or 'under'.")
    components = _split_quarter_line(line)

    def settle(home: int, away: int):
        total = home + away
        win = loss = push = 0.0
        for component, stake in components:
            raw = total - component
            if selection == "under":
                raw = -raw
            result = _component_result(raw)
            if result > 0:
                win += stake
            elif result < 0:
                loss += stake
            else:
                push += stake
        return win, loss, push

    return _weights_from_score_matrix(xg, settle, max_goals)


def team_total(
    xg: ExpectedGoals,
    team: str,
    selection: str,
    line: float,
    max_goals: int = 12,
) -> SettlementWeights:
    if team not in {"home", "away"}:
        raise ValueError("team must be 'home' or 'away'.")
    if selection not in {"over", "under"}:
        raise ValueError("selection must be 'over' or 'under'.")
    components = _split_quarter_line(line)

    def settle(home: int, away: int):
        goals = home if team == "home" else away
        win = loss = push = 0.0
        for component, stake in components:
            raw = goals - component
            if selection == "under":
                raw = -raw
            result = _component_result(raw)
            if result > 0:
                win += stake
            elif result < 0:
                loss += stake
            else:
                push += stake
        return win, loss, push

    return _weights_from_score_matrix(xg, settle, max_goals)


def both_teams_to_score(
    xg: ExpectedGoals,
    selection: str,
    max_goals: int = 12,
) -> SettlementWeights:
    if selection not in {"yes", "no"}:
        raise ValueError("selection must be 'yes' or 'no'.")

    def settle(home: int, away: int):
        yes = home > 0 and away > 0
        won = yes if selection == "yes" else not yes
        return (1.0, 0.0, 0.0) if won else (0.0, 1.0, 0.0)

    return _weights_from_score_matrix(xg, settle, max_goals)


def double_chance(
    xg: ExpectedGoals,
    selection: str,
    max_goals: int = 12,
) -> SettlementWeights:
    if selection not in {"1X", "X2", "12"}:
        raise ValueError("selection must be one of 1X, X2, 12.")

    def settle(home: int, away: int):
        if selection == "1X":
            won = home >= away
        elif selection == "X2":
            won = away >= home
        else:
            won = home != away
        return (1.0, 0.0, 0.0) if won else (0.0, 1.0, 0.0)

    return _weights_from_score_matrix(xg, settle, max_goals)
