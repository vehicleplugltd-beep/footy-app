from __future__ import annotations

import argparse
import json

from .sources.soccerdata_source import SoccerDataSource
from .normalizers.understat import normalise_understat
from .quality import assess_match_team_metrics


def command_sources() -> None:
    payload = {
        "production_candidates": [
            "soccerdata / Understat",
            "soccerdata / Sofascore",
            "soccerdata / FBref",
            "soccerdata / Football-Data.co.uk MatchHistory",
            "Club Elo",
            "OpenFootball fallback",
        ],
        "research": [
            "StatsBomb Open Data",
            "socceraction xT/VAEP",
        ],
    }
    print(json.dumps(payload, indent=2))


def command_understat(args: argparse.Namespace) -> None:
    src = SoccerDataSource(leagues=args.league, seasons=args.season)
    team_stats = src.understat_team_match_stats()
    shots = src.understat_shots() if args.with_shots else None
    normalized = normalise_understat(team_stats, shots=shots)
    report = assess_match_team_metrics(normalized)
    print(json.dumps({
        "rows": len(normalized),
        "quality": {
            "rows": report.rows,
            "missing_fraction": report.missing_fraction,
            "duplicate_rows": report.duplicate_rows,
            "impossible_values": report.impossible_values,
            "usable": report.usable,
        },
        "columns": list(normalized.columns),
    }, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="footy-data")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("sources", help="List configured free/open data sources")

    understat = sub.add_parser(
        "understat-smoke",
        help="Fetch and normalize Understat team-match data",
    )
    understat.add_argument("--league", action="append", required=True)
    understat.add_argument("--season", action="append", required=True)
    understat.add_argument("--with-shots", action="store_true")

    args = parser.parse_args()
    if args.command == "sources":
        command_sources()
    elif args.command == "understat-smoke":
        command_understat(args)


if __name__ == "__main__":
    main()
