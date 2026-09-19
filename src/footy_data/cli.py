from __future__ import annotations

import argparse
import json

from .sources.soccerdata_source import SoccerDataSource
from .normalizers.understat import (
    normalise_understat,
    normalise_understat_matches,
)
from .quality import assess_match_team_metrics
from .storage import SupabaseRESTWriter, frame_records, MATCH_FIELDS, MATCH_TEAM_METRIC_FIELDS


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


def _understat_frames(args: argparse.Namespace):
    src = SoccerDataSource(leagues=args.league, seasons=args.season)
    team_stats = src.understat_team_match_stats()
    shots = src.understat_shots() if args.with_shots else None
    matches = normalise_understat_matches(team_stats)
    metrics = normalise_understat(team_stats, shots=shots)
    return matches, metrics


def command_understat(args: argparse.Namespace) -> None:
    matches, normalized = _understat_frames(args)
    report = assess_match_team_metrics(normalized)
    print(json.dumps({
        "matches": len(matches),
        "metric_rows": len(normalized),
        "quality": {
            "rows": report.rows,
            "missing_fraction": report.missing_fraction,
            "duplicate_rows": report.duplicate_rows,
            "impossible_values": report.impossible_values,
            "usable": report.usable,
        },
        "columns": list(normalized.columns),
    }, indent=2))


def command_understat_ingest(args: argparse.Namespace) -> None:
    matches, metrics = _understat_frames(args)
    report = assess_match_team_metrics(metrics)
    if not report.usable:
        raise RuntimeError(f"Understat payload failed quality checks: {report}")

    writer = SupabaseRESTWriter()
    writer.upsert_matches(frame_records(matches, MATCH_FIELDS))
    writer.upsert_match_team_metrics(
        frame_records(metrics, MATCH_TEAM_METRIC_FIELDS)
    )

    print(json.dumps({
        "status": "ok",
        "matches_upserted": len(matches),
        "metric_rows_upserted": len(metrics),
        "quality_usable": report.usable,
    }, indent=2))


def _add_understat_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--league", action="append", required=True)
    parser.add_argument("--season", action="append", required=True)
    parser.add_argument("--with-shots", action="store_true")


def main() -> None:
    parser = argparse.ArgumentParser(prog="footy-data")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("sources", help="List configured free/open data sources")

    understat = sub.add_parser(
        "understat-smoke",
        help="Fetch and normalize Understat team-match data",
    )
    _add_understat_args(understat)

    ingest = sub.add_parser(
        "understat-ingest",
        help="Fetch, normalize, validate and upsert Understat data to Supabase",
    )
    _add_understat_args(ingest)

    args = parser.parse_args()
    if args.command == "sources":
        command_sources()
    elif args.command == "understat-smoke":
        command_understat(args)
    elif args.command == "understat-ingest":
        command_understat_ingest(args)


if __name__ == "__main__":
    main()
