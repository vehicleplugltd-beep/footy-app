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
    "man-united": "Manchester United",
    "manchester-utd": "Manchester United",
    "manchester-united": "Manchester United",
    "man-city": "Manchester City",
    "manchester-city": "Manchester City",
    "spurs": "Tottenham",
    "tottenham": "Tottenham",
    "tottenham-hotspur": "Tottenham",
    "wolves": "Wolverhampton Wanderers",
    "wolverhampton": "Wolverhampton Wanderers",
    "newcastle": "Newcastle United",
    "newcastle-utd": "Newcastle United",
    "west-ham": "West Ham United",
    "west-ham-utd": "West Ham United",
    "nott-m-forest": "Nottingham Forest",
    "nottm-forest": "Nottingham Forest",
    "nottingham-forest": "Nottingham Forest",
    "sheffield-utd": "Sheffield United",
    "sheffield-united": "Sheffield United",
    "leeds": "Leeds",
    "leeds-utd": "Leeds",
    "leeds-united": "Leeds",
    "leicester": "Leicester City",
    "leicester-city": "Leicester City",
    "ipswich": "Ipswich",
    "ipswich-town": "Ipswich",
    "luton": "Luton Town",
    "luton-town": "Luton Town",
    "afc-bournemouth": "Bournemouth",
    "bournemouth": "Bournemouth",
    "brighton-hove-albion": "Brighton",
    "brighton": "Brighton",
    "coventry-city": "Coventry",
    "coventry": "Coventry",
    "hull-city": "Hull",
    "hull": "Hull",
    "birmingham-city": "Birmingham",
    "birmingham": "Birmingham",
    "blackburn-rovers": "Blackburn",
    "blackburn": "Blackburn",
    "cardiff-city": "Cardiff",
    "cardiff": "Cardiff",
    "huddersfield-town": "Huddersfield",
    "huddersfield": "Huddersfield",
    "rotherham-united": "Rotherham",
    "rotherham": "Rotherham",
    "wigan-athletic": "Wigan",
    "wigan": "Wigan",
    "plymouth-argyle": "Plymouth",
    "plymouth": "Plymouth",
    "charlton-athletic": "Charlton",
    "charlton": "Charlton",
    "derby-county": "Derby",
    "derby": "Derby",
    "norwich-city": "Norwich",
    "norwich": "Norwich",
    "oxford-united": "Oxford",
    "oxford": "Oxford",
    "preston-north-end": "Preston",
    "preston": "Preston",
    "queens-park-rangers": "QPR",
    "qpr": "QPR",
    "sheffield-wednesday": "Sheffield Weds",
    "sheffield-weds": "Sheffield Weds",
    "stoke-city": "Stoke",
    "stoke": "Stoke",
    "swansea-city": "Swansea",
    "swansea": "Swansea",
    "west-bromwich-albion": "West Brom",
    "west-brom": "West Brom",
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
