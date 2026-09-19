from __future__ import annotations

import argparse
import json

import pandas as pd

from .sources.soccerdata_source import SoccerDataSource
from .normalizers.understat import (
    normalise_understat,
    normalise_understat_matches,
)
from .quality import assess_match_team_metrics
from .storage import (
    SupabaseRESTWriter,
    SupabaseRESTReader,
    frame_records,
    MATCH_FIELDS,
    MATCH_TEAM_METRIC_FIELDS,
    insert_backtest_run,
)
from .walk_forward import build_walk_forward_predictions
from .backtest import binary_metrics, multiclass_log_loss, calibration_records
from .elo import ratings_for_match_dates
from .external_elo import ratings_from_match_dataset


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


def command_clubelo_ingest(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    frame = reader.historical_match_team_metrics()
    if frame.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    frame = frame[frame["league"] == args.league].copy()
    if args.season:
        wanted = {str(s) for s in args.season}
        frame = frame[frame["season"].astype(str).isin(wanted)].copy()

    if frame.empty:
        raise RuntimeError("No rows match the requested Club Elo scope.")

    source = SoccerDataSource(leagues=[], seasons=[])
    ratings = ratings_for_match_dates(
        frame[["team", "match_date"]],
        source.clubelo(),
    )
    if ratings.empty:
        raise RuntimeError("Club Elo produced no ratings.")

    writer = SupabaseRESTWriter()
    writer.upsert_team_ratings(frame_records(ratings))

    print(json.dumps({
        "status": "ok",
        "ratings_upserted": len(ratings),
        "teams": int(ratings["team"].nunique()),
        "first_rating_date": str(ratings["rating_date"].min()),
        "last_rating_date": str(ratings["rating_date"].max()),
    }, indent=2))


def command_external_elo_import(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    frame = reader.historical_match_team_metrics()
    if frame.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    frame = frame[frame["league"] == args.league].copy()
    if args.season:
        wanted = {str(s) for s in args.season}
        frame = frame[frame["season"].astype(str).isin(wanted)].copy()
    if frame.empty:
        raise RuntimeError("No Footy rows match the requested external Elo scope.")

    external = pd.read_csv(args.csv)
    ratings, report = ratings_from_match_dataset(
        external,
        frame,
        division=args.division,
        source=args.source,
    )
    if report["match_rate"] < args.min_match_rate:
        raise RuntimeError(
            "External Elo reconciliation below threshold: "
            + json.dumps(report)
        )

    writer = SupabaseRESTWriter()
    writer.upsert_team_ratings(frame_records(ratings))

    print(json.dumps({
        "status": "ok",
        **report,
        "source": args.source,
    }, indent=2))


def command_calibrate(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    frame = reader.historical_match_team_metrics(
        include_ratings=args.use_elo,
    )
    if frame.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    frame = frame[frame["league"] == args.league].copy()
    if args.season:
        wanted = {str(s) for s in args.season}
        frame = frame[frame["season"].astype(str).isin(wanted)].copy()

    if frame.empty:
        raise RuntimeError("No historical rows match the requested calibration scope.")

    predictions = build_walk_forward_predictions(
        frame,
        min_team_matches=args.min_team_matches,
        use_elo=args.use_elo,
    )
    if predictions.empty:
        raise RuntimeError("Walk-forward calibration produced no predictions.")

    home_brier, home_log = binary_metrics(
        predictions["home_win_probability"],
        predictions["home_win_actual"],
    )
    over_brier, over_log = binary_metrics(
        predictions["over_2_5_probability"],
        predictions["over_2_5_actual"],
    )
    btts_brier, btts_log = binary_metrics(
        predictions["btts_yes_probability"],
        predictions["btts_yes_actual"],
    )

    actual_1x2 = pd.Series(
        [
            "home" if hg > ag else "away" if hg < ag else "draw"
            for hg, ag in zip(
                predictions["home_goals"],
                predictions["away_goals"],
            )
        ],
        index=predictions.index,
    )

    one_x_two_log = multiclass_log_loss(
        pd.DataFrame({
            "home": predictions["home_win_probability"],
            "draw": predictions["draw_probability"],
            "away": predictions["away_win_probability"],
        }),
        actual_1x2,
    )

    seasons = sorted(predictions["season"].astype(str).unique().tolist())
    calibration = {
        "home_win": calibration_records(
            predictions["home_win_probability"],
            predictions["home_win_actual"],
        ),
        "over_2_5": calibration_records(
            predictions["over_2_5_probability"],
            predictions["over_2_5_actual"],
        ),
        "btts_yes": calibration_records(
            predictions["btts_yes_probability"],
            predictions["btts_yes_actual"],
        ),
    }

    result = {
        "model_version": args.model_version,
        "league": args.league,
        "seasons": seasons,
        "prediction_rows": int(len(predictions)),
        "home_win_brier": home_brier,
        "home_win_log_loss": home_log,
        "over_2_5_brier": over_brier,
        "over_2_5_log_loss": over_log,
        "btts_brier": btts_brier,
        "btts_log_loss": btts_log,
        "result_1x2_log_loss": one_x_two_log,
        "calibration": calibration,
    }

    writer = SupabaseRESTWriter()
    insert_backtest_run(writer, result)

    printable = dict(result)
    printable["calibration"] = {
        key: [
            row for row in rows if row.get("bets", 0) > 0
        ]
        for key, rows in calibration.items()
    }
    print(json.dumps(printable, indent=2))


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

    clubelo = sub.add_parser(
        "clubelo-ingest",
        help="Fetch historical Club Elo ratings for stored Footy fixtures",
    )
    clubelo.add_argument(
        "--league",
        default="ENG-Premier League",
    )
    clubelo.add_argument(
        "--season",
        action="append",
        help="Stored season identifier, e.g. 2223. Repeat for multiple seasons.",
    )

    external_elo = sub.add_parser(
        "external-elo-import",
        help="Import licensed pre-match Elo values from a local CSV",
    )
    external_elo.add_argument("--csv", required=True)
    external_elo.add_argument("--league", default="ENG-Premier League")
    external_elo.add_argument("--division", default="E0")
    external_elo.add_argument("--season", action="append")
    external_elo.add_argument(
        "--source",
        default="xgabora-club-football-match-data",
    )
    external_elo.add_argument(
        "--min-match-rate",
        type=float,
        default=0.95,
    )

    calibrate = sub.add_parser(
        "calibrate",
        help="Run walk-forward probability calibration from stored history",
    )
    calibrate.add_argument(
        "--league",
        default="ENG-Premier League",
    )
    calibrate.add_argument(
        "--season",
        action="append",
        help="Stored season identifier, e.g. 2223. Repeat for multiple seasons.",
    )
    calibrate.add_argument(
        "--model-version",
        default="baseline-v1",
    )
    calibrate.add_argument(
        "--min-team-matches",
        type=int,
        default=5,
    )
    calibrate.add_argument(
        "--use-elo",
        action="store_true",
        help="Use stored Club Elo ratings as a mild matchup modifier.",
    )

    args = parser.parse_args()
    if args.command == "sources":
        command_sources()
    elif args.command == "understat-smoke":
        command_understat(args)
    elif args.command == "understat-ingest":
        command_understat_ingest(args)
    elif args.command == "clubelo-ingest":
        command_clubelo_ingest(args)
    elif args.command == "external-elo-import":
        command_external_elo_import(args)
    elif args.command == "calibrate":
        command_calibrate(args)


if __name__ == "__main__":
    main()
