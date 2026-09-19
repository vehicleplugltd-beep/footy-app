from __future__ import annotations

from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Iterable

from .normalise import canonical_text


@dataclass
class TeamIdentityResolver:
    aliases: dict[str, str] = field(default_factory=dict)

    def add_alias(self, alias: str, canonical_name: str) -> None:
        self.aliases[canonical_text(alias)] = canonical_name

    def resolve(self, raw_name: str) -> str:
        key = canonical_text(raw_name)
        return self.aliases.get(key, raw_name.strip())

    def suggest(
        self,
        raw_name: str,
        candidates: Iterable[str],
        minimum_score: float = 0.78,
    ) -> list[tuple[str, float]]:
        raw_key = canonical_text(raw_name)
        scored = []
        for candidate in candidates:
            score = SequenceMatcher(None, raw_key, canonical_text(candidate)).ratio()
            if score >= minimum_score:
                scored.append((candidate, score))
        return sorted(scored, key=lambda x: x[1], reverse=True)


DEFAULT_ALIASES = {
    "man-utd": "Manchester United",
    "manchester-utd": "Manchester United",
    "man-city": "Manchester City",
    "spurs": "Tottenham Hotspur",
    "tottenham": "Tottenham Hotspur",
    "wolves": "Wolverhampton Wanderers",
    "newcastle": "Newcastle United",
    "west-ham": "West Ham United",
    "psg": "Paris Saint-Germain",
    "paris-sg": "Paris Saint-Germain",
    "inter": "Internazionale",
    "inter-milan": "Internazionale",
    "ac-milan": "Milan",
    "bayern": "Bayern Munich",
}


def default_resolver() -> TeamIdentityResolver:
    resolver = TeamIdentityResolver()
    for alias, canonical in DEFAULT_ALIASES.items():
        resolver.add_alias(alias, canonical)
    return resolver
