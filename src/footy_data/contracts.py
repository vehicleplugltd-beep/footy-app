from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any


@dataclass
class Provenance:
    source: str
    retrieved_at: str
    source_url: str | None = None
    source_version: str | None = None

    @classmethod
    def now(
        cls,
        source: str,
        source_url: str | None = None,
        source_version: str | None = None,
    ) -> "Provenance":
        return cls(
            source=source,
            retrieved_at=datetime.now(timezone.utc).isoformat(),
            source_url=source_url,
            source_version=source_version,
        )

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


REQUIRED_MATCH_TEAM_COLUMNS = [
    "match_id",
    "match_date",
    "league",
    "season",
    "team",
    "opponent",
    "home_away",
    "goals",
    "goals_conceded",
    "xg",
    "xga",
    "source",
    "retrieved_at",
]
