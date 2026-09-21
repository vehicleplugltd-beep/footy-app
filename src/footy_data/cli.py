from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import pandas as pd

from .sources.soccerdata_source import SoccerDataSource
from .normalizers.understat import (
    normalise_understat,
    normalise_understat_matches,
)
from .normalizers.fpl_core_insights import (
    normalise_fpl_core_matches,
    normalise_fpl_core_player_match_stats,
    reconcile_fpl_core_to_footy,
    reconcile_fpl_core_player_matches_to_footy,
    supplement_fpl_core_team_rows_from_players,
    enrich_fpl_core_team_rows_from_players,
    normalise_fpl_core_player_priors,
)
from .sources.fpl_core_insights import FPLCoreInsightsSource
from .verification import verify_provider_rows
from .quality import assess_match_team_metrics
from .storage import (
    SupabaseRESTWriter,
    SupabaseRESTReader,
    frame_records,
    MATCH_FIELDS,
    MATCH_TEAM_METRIC_FIELDS,
    PLAYER_MATCH_METRIC_FIELDS,
    PLAYER_SEASON_PRIOR_FIELDS,
    HISTORICAL_PREDICTION_FIELDS,
    insert_backtest_run,
    insert_value_backtest_run,
)
from .walk_forward import build_walk_forward_predictions
from .backtest import binary_metrics, multiclass_log_loss, calibration_records
from .elo import ratings_for_match_dates
from .external_elo import ratings_from_match_dataset
from .odds_import import normalise_1x2_prices, normalise_total_2_5_prices
from .value_backtest import (
    assess_1x2_history,
    summarize_qualified_1x2,
    assess_total_2_5_history,
    summarize_qualified_total_2_5,
)
from .diagnostics import upcoming_process_diagnostics
from .process_ridge import build_process_feature_rows, holdout_match_predictions
from .upcoming import (
    normalise_upcoming_fixtures,
    build_upcoming_predictions,
    model_output_records,
)
from .results_ledger import refresh_results_ledger


def command_sources() -> None:
    payload = {
        "active_production": [
            {
                "source": "Official FPL",
                "use": "player availability, expected points, xG/xA/xGI, starts, minutes, set-piece roles",
            },
            {
                "source": "Understat via soccerdata",
                "use": "team xG/npxG, xGA/npxGA, PPDA, deep completions and shot aggregates",
            },
            {
                "source": "FPL-Core-Insights",
                "use": "verified team enrichment plus player-match xA/xGOT/chance creation, goalkeeper post-shot data and cup/Europe workload",
            },
            {
                "source": "Football-Data.co.uk",
                "use": "historical results and bookmaker prices for calibration/backtesting",
            },
            {
                "source": "Club Elo",
                "use": "mild opponent/schedule-strength adjustment",
            },
        ],
        "available_adapters_not_yet_active_in_consensus": [
            "soccerdata / Sofascore",
            "soccerdata / FBref",
            "OpenFootball fixture/result cross-check",
            "DataHub EPL stable Football-Data mirror / resilience layer",
            "Kaggle FPL daily dumps — archive/fallback once an exact dataset is pinned",
        ],
        "research_or_partial_coverage": [
            "StatsBomb Open Data",
            "socceraction xT/VAEP",
        ],
        "licensed_only": [
            "Opta / Stats Perform — only if a legitimate licensed feed is configured",
        ],
        "synthesis": {
            "rule": "Provider rows remain separate in storage; the modelling view creates one canonical match/team row with provenance, confidence and conflict flags.",
            "modelled_metrics": "Do not blindly average xG-family metrics with different provider definitions; choose a preferred compatible source and use the others as cross-checks.",
            "event_metrics": "Use robust consensus for definition-compatible counts such as shots and shots on target.",
        },
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

    # Understat has passed Footy's structural/invariant checks. New rows are
    # admitted as WARN until an independent Official-FPL score/identity
    # reconciliation upgrades the quality run to PASS.
    verified_at = datetime.now(timezone.utc).isoformat()
    metrics = metrics.copy()
    metrics["verified"] = True
    metrics["verification_status"] = "WARN"
    metrics["verified_at"] = verified_at
    writer.upsert_match_team_metrics(
        frame_records(metrics, MATCH_TEAM_METRIC_FIELDS)
    )
    writer.insert_data_quality_run(
        source="understat",
        league=args.league[0] if isinstance(args.league, list) else str(args.league),
        season=args.season[0] if isinstance(args.season, list) else str(args.season),
        status="WARN",
        report={
            "basis": "internal quality/invariant gate",
            "rows": report.rows,
            "duplicate_rows": report.duplicate_rows,
            "impossible_values": report.impossible_values,
            "note": "Independent Official-FPL score reconciliation upgrades this source to PASS.",
        },
    )

    print(json.dumps({
        "status": "ok",
        "matches_upserted": len(matches),
        "metric_rows_upserted": len(metrics),
        "quality_usable": report.usable,
    }, indent=2))


def command_fpl_core_ingest(args: argparse.Namespace) -> None:
    source = FPLCoreInsightsSource()
    matches = source.matches(args.gameweek)
    teams = source.teams(args.gameweek)
    players = source.players(args.gameweek)
    player_match_stats = source.player_match_stats(args.gameweek)

    normalized = normalise_fpl_core_matches(matches, teams)
    if normalized.empty:
        raise RuntimeError("FPL-Core-Insights returned no finished Premier League rows.")

    player_metrics = normalise_fpl_core_player_match_stats(
        player_match_stats,
        players,
        teams,
        matches,
        season=args.season,
        penalty_xg_value=args.penalty_xg_value,
    )

    reader = SupabaseRESTReader()
    matches_scope = reader.season_matches(args.league, args.season)
    if matches_scope.empty:
        raise RuntimeError("No Footy season match spine available for reconciliation.")

    side_rows: list[dict] = []
    for _, row in matches_scope.iterrows():
        side_rows.extend([
            {
                "match_id": row["match_id"],
                "match_date": row["match_date"],
                "team": row["home_team"],
                "opponent": row["away_team"],
                "home_away": "H",
            },
            {
                "match_id": row["match_id"],
                "match_date": row["match_date"],
                "team": row["away_team"],
                "opponent": row["home_team"],
                "home_away": "A",
            },
        ])
    side_scope = pd.DataFrame(side_rows)

    reconciled, match_rate = reconcile_fpl_core_to_footy(
        normalized,
        side_scope,
    )
    if match_rate < args.min_match_rate:
        raise RuntimeError(
            f"FPL-Core reconciliation {match_rate:.1%} below "
            f"{args.min_match_rate:.1%}"
        )

    player_metrics, player_match_rate = (
        reconcile_fpl_core_player_matches_to_footy(
            player_metrics,
            side_scope,
        )
    )
    if player_match_rate < args.min_match_rate:
        raise RuntimeError(
            f"FPL-Core player reconciliation {player_match_rate:.1%} below "
            f"{args.min_match_rate:.1%}"
        )
    reconciled = supplement_fpl_core_team_rows_from_players(
        reconciled,
        player_metrics,
        side_scope,
    )
    reconciled = enrich_fpl_core_team_rows_from_players(
        reconciled,
        player_metrics,
    )

    reference = reader.match_team_metrics_for_ids(
        reconciled["match_id"].dropna().astype(str).unique().tolist(),
        source="understat",
    )
    if reference.empty:
        raise RuntimeError("No Understat reference rows for reconciled matches.")
    reference = reference[
        reference["verified"].fillna(False).astype(bool)
    ].copy()
    if reference.empty:
        raise RuntimeError("No verified Understat reference rows for reconciled matches.")
    report = verify_provider_rows(
        reconciled,
        reference,
        source="fpl-core-insights",
        minimum_match_rate=args.min_match_rate,
    )

    writer = SupabaseRESTWriter()
    writer.insert_data_quality_run(
        source="fpl-core-insights",
        league=args.league,
        season=args.season,
        status=report.status,
        report={
            **report.as_dict(),
            "player_rows": int(len(player_metrics)),
            "player_rows_linked_to_pl": int(
                player_metrics["footy_match_id"].notna().sum()
                if not player_metrics.empty
                else 0
            ),
            "player_match_rate": player_match_rate,
            "competitions": (
                sorted(player_metrics["competition"].dropna().astype(str).unique().tolist())
                if not player_metrics.empty
                else []
            ),
        },
    )

    if report.status == "BLOCKED":
        raise RuntimeError(
            "FPL-Core-Insights failed verification: "
            + json.dumps(report.as_dict())
        )

    stamp = datetime.now(timezone.utc).isoformat()
    reconciled["verified"] = True
    reconciled["verification_status"] = report.status
    reconciled["verified_at"] = stamp
    writer.upsert_match_team_metrics(
        frame_records(reconciled, MATCH_TEAM_METRIC_FIELDS)
    )

    if not player_metrics.empty:
        player_metrics = player_metrics.copy()
        player_metrics["verified"] = True
        player_metrics["verification_status"] = player_metrics.apply(
            lambda row: (
                report.status
                if (
                    str(row.get("competition", "")).lower() == "prem"
                    and pd.notna(row.get("footy_match_id"))
                )
                else "WARN"
            ),
            axis=1,
        )
        player_metrics["verified_at"] = stamp
        writer.upsert_player_match_metrics(
            frame_records(player_metrics, PLAYER_MATCH_METRIC_FIELDS)
        )

    print(json.dumps({
        "status": report.status,
        "provider": "fpl-core-insights",
        "gameweek": args.gameweek,
        "rows_upserted": len(reconciled),
        "player_rows_upserted": len(player_metrics),
        "player_rows_linked_to_pl": int(
            player_metrics["footy_match_id"].notna().sum()
            if not player_metrics.empty
            else 0
        ),
        "player_match_rate": player_match_rate,
        "verification": report.as_dict(),
    }, indent=2, default=str))


def command_fpl_core_priors_ingest(args: argparse.Namespace) -> None:
    source = FPLCoreInsightsSource(
        season_folder=args.season_folder,
    )
    player_stats = source.season_player_stats(args.gameweek)
    players = source.season_players(args.gameweek)
    teams = source.season_teams(args.gameweek)

    priors = normalise_fpl_core_player_priors(
        player_stats,
        players,
        teams,
        season=args.season,
    )
    if priors.empty:
        raise RuntimeError("FPL-Core prior season produced no player rows.")

    duplicate_codes = int(priors.duplicated(["player_code"]).sum())
    negative_minutes = int(
        (pd.to_numeric(priors["minutes"], errors="coerce") < 0).sum()
    )
    usable = priors[
        pd.to_numeric(priors["minutes"], errors="coerce").fillna(0) >= 180
    ].copy()
    if duplicate_codes or negative_minutes:
        raise RuntimeError(
            "FPL-Core prior season failed identity/invariant checks: "
            + json.dumps({
                "duplicate_player_codes": duplicate_codes,
                "negative_minutes": negative_minutes,
            })
        )

    writer = SupabaseRESTWriter()
    writer.upsert_player_season_priors(
        frame_records(priors, PLAYER_SEASON_PRIOR_FIELDS)
    )
    writer.insert_data_quality_run(
        source="fpl-core-insights-player-priors",
        league="ENG-Premier League",
        season=args.season,
        status="PASS",
        report={
            "season_folder": args.season_folder,
            "final_gameweek": args.gameweek,
            "rows": int(len(priors)),
            "players_180_plus_minutes": int(len(usable)),
            "duplicate_player_codes": duplicate_codes,
            "negative_minutes": negative_minutes,
            "identity_key": "player_code",
            "rate_definition": "season totals divided by official FPL minutes",
        },
    )

    print(json.dumps({
        "status": "PASS",
        "season": args.season,
        "season_folder": args.season_folder,
        "final_gameweek": args.gameweek,
        "rows_upserted": len(priors),
        "players_180_plus_minutes": len(usable),
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


def command_odds_import(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    frame = reader.historical_match_team_metrics()
    if frame.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    frame = frame[frame["league"] == args.league].copy()
    if args.season:
        wanted = {str(s) for s in args.season}
        frame = frame[frame["season"].astype(str).isin(wanted)].copy()
    if frame.empty:
        raise RuntimeError("No Footy rows match the requested odds scope.")

    external = pd.read_csv(args.csv)
    prices, report = normalise_1x2_prices(
        external=external,
        footy_metrics=frame,
        bookmaker=args.bookmaker,
        source=args.source,
        price_kind=args.price_kind,
        date_col=args.date_col,
        home_team_col=args.home_team_col,
        away_team_col=args.away_team_col,
        home_odds_col=args.home_odds_col,
        draw_odds_col=args.draw_odds_col,
        away_odds_col=args.away_odds_col,
    )

    if report.match_rate < args.min_match_rate:
        raise RuntimeError(
            "Odds reconciliation below threshold: "
            + json.dumps(report.__dict__)
        )

    writer = SupabaseRESTWriter()
    writer.upsert_bookmaker_prices(frame_records(prices))

    print(json.dumps({
        "status": "ok",
        **report.__dict__,
        "bookmaker": args.bookmaker,
        "price_kind": args.price_kind,
        "source": args.source,
    }, indent=2))



def command_football_data_odds_ingest(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    footy = reader.historical_match_team_metrics()
    if footy.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    footy = footy[footy["league"] == args.league].copy()
    if args.season:
        wanted = {str(s) for s in args.season}
        footy = footy[footy["season"].astype(str).isin(wanted)].copy()
    if footy.empty:
        raise RuntimeError("No Footy rows match the requested odds scope.")

    source = SoccerDataSource(
        leagues=[args.league],
        seasons=args.season,
    )
    external = source.football_data_matches()

    specs = [
        ("Market Average", "snapshot", ("AvgH", "AvgD", "AvgA")),
        ("Market Average", "close", ("AvgCH", "AvgCD", "AvgCA")),
        ("Market Maximum", "snapshot", ("MaxH", "MaxD", "MaxA")),
        ("Market Maximum", "close", ("MaxCH", "MaxCD", "MaxCA")),
        ("Bet365", "snapshot", ("B365H", "B365D", "B365A")),
        ("Bet365", "close", ("B365CH", "B365CD", "B365CA")),
        ("William Hill", "snapshot", ("WHH", "WHD", "WHA")),
    ]

    writer = SupabaseRESTWriter()
    reports = []
    total_rows = 0

    for bookmaker, price_kind, columns in specs:
        if not set(columns).issubset(external.columns):
            continue

        prices, report = normalise_1x2_prices(
            external=external,
            footy_metrics=footy,
            bookmaker=bookmaker,
            source="football-data.co.uk",
            price_kind=price_kind,
            date_col="date",
            home_team_col="home_team",
            away_team_col="away_team",
            home_odds_col=columns[0],
            draw_odds_col=columns[1],
            away_odds_col=columns[2],
        )

        if report.match_rate < args.min_match_rate:
            reports.append({
                "bookmaker": bookmaker,
                "price_kind": price_kind,
                "status": "skipped_low_coverage",
                **report.__dict__,
            })
            continue

        writer.upsert_bookmaker_prices(frame_records(prices))
        total_rows += len(prices)
        reports.append({
            "bookmaker": bookmaker,
            "price_kind": price_kind,
            "status": "ingested",
            **report.__dict__,
        })

    total_specs = [
        ("Market Average", "snapshot", ("Avg>2.5", "Avg<2.5")),
        ("Market Average", "close", ("AvgC>2.5", "AvgC<2.5")),
        ("Market Maximum", "snapshot", ("Max>2.5", "Max<2.5")),
        ("Market Maximum", "close", ("MaxC>2.5", "MaxC<2.5")),
        ("Bet365", "snapshot", ("B365>2.5", "B365<2.5")),
        ("Bet365", "close", ("B365C>2.5", "B365C<2.5")),
    ]

    for bookmaker, price_kind, columns in total_specs:
        if not set(columns).issubset(external.columns):
            continue

        prices, report = normalise_total_2_5_prices(
            external=external,
            footy_metrics=footy,
            bookmaker=bookmaker,
            source="football-data.co.uk",
            price_kind=price_kind,
            date_col="date",
            home_team_col="home_team",
            away_team_col="away_team",
            over_odds_col=columns[0],
            under_odds_col=columns[1],
        )

        if report.match_rate < args.min_match_rate:
            reports.append({
                "bookmaker": bookmaker,
                "price_kind": price_kind,
                "market": "TOTAL_2.5",
                "status": "skipped_low_coverage",
                **report.__dict__,
            })
            continue

        writer.upsert_bookmaker_prices(frame_records(prices))
        total_rows += len(prices)
        reports.append({
            "bookmaker": bookmaker,
            "price_kind": price_kind,
            "market": "TOTAL_2.5",
            "status": "ingested",
            **report.__dict__,
        })

    if total_rows == 0:
        raise RuntimeError(
            "Football-Data supplied no supported 1X2 price set above "
            "the minimum reconciliation threshold."
        )

    print(json.dumps({
        "status": "ok",
        "price_rows_upserted": total_rows,
        "datasets": reports,
    }, indent=2))


def command_value_backtest(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    predictions = reader.historical_predictions(args.model_version)
    if predictions.empty:
        raise RuntimeError(
            f"No stored predictions for model version {args.model_version}."
        )

    prices = reader.bookmaker_prices(
        bookmaker=args.bookmaker,
        price_kind=args.price_kind,
        source=args.source,
        market=args.market,
    )
    if prices.empty:
        raise RuntimeError("No matching historical bookmaker prices found.")

    if args.market == "1X2":
        assessed = assess_1x2_history(
            predictions,
            prices,
            target_ev=args.target_ev,
        )
    elif args.market == "TOTAL_2.5":
        assessed = assess_total_2_5_history(
            predictions,
            prices,
            target_ev=args.target_ev,
        )
    else:
        raise ValueError(f"Unsupported value-backtest market: {args.market}")

    history = reader.historical_match_team_metrics()
    home = (
        history[history["home_away"] == "H"]
        [["match_id", "goals"]]
        .rename(columns={"goals": "home_goals"})
    )
    away = (
        history[history["home_away"] == "A"]
        [["match_id", "goals"]]
        .rename(columns={"goals": "away_goals"})
    )
    outcomes = home.merge(
        away,
        on="match_id",
        how="inner",
        validate="one_to_one",
    )

    if args.market == "1X2":
        summary, bets = summarize_qualified_1x2(
            assessed,
            outcomes,
        )
    else:
        summary, bets = summarize_qualified_total_2_5(
            assessed,
            outcomes,
        )

    result = {
        "model_version": args.model_version,
        "bookmaker": args.bookmaker,
        "price_kind": args.price_kind,
        "source": args.source,
        "market": args.market,
        "target_ev": args.target_ev,
        **summary,
    }
    writer = SupabaseRESTWriter()
    insert_value_backtest_run(writer, result)

    printable = dict(result)
    printable["settled_bets"] = int(len(bets))
    print(json.dumps(printable, indent=2))


def command_diagnose_upcoming(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    history = reader.historical_match_team_metrics()
    history = history[history["league"] == args.league].copy()
    if args.history_season:
        wanted_history = {str(s) for s in args.history_season}
        history = history[
            history["season"].astype(str).isin(wanted_history)
        ].copy()
    if history.empty:
        raise RuntimeError("No historical Footy data found for league/history scope.")

    source = SoccerDataSource(
        leagues=[args.league],
        seasons=[args.season],
    )
    schedule = source.understat_schedule()
    fixtures = normalise_upcoming_fixtures(
        schedule,
        horizon_days=args.horizon_days,
    )

    diagnostics = []
    for row in fixtures.to_dict(orient="records"):
        diagnostics.append({
            "match_id": row["match_id"],
            "match_date": str(row["match_date"]),
            "home_team": row["home_team"],
            "away_team": row["away_team"],
            "process": upcoming_process_diagnostics(history, row),
        })

    print(json.dumps({
        "status": "ok",
        "fixtures": len(diagnostics),
        "diagnostics": diagnostics,
    }, indent=2, default=str))


def command_predict_upcoming(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    history = reader.historical_match_team_metrics()
    if history.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    history = history[history["league"] == args.league].copy()
    if args.history_season:
        wanted_history = {str(s) for s in args.history_season}
        history = history[
            history["season"].astype(str).isin(wanted_history)
        ].copy()
    if history.empty:
        raise RuntimeError("No historical rows match the requested league/history scope.")

    source = SoccerDataSource(
        leagues=[args.league],
        seasons=[args.season],
    )
    schedule = source.understat_schedule()
    fixtures = normalise_upcoming_fixtures(
        schedule,
        horizon_days=args.horizon_days,
    )

    if fixtures.empty:
        print(json.dumps({
            "status": "ok",
            "fixtures": 0,
            "predictions": 0,
            "message": "No upcoming fixtures in requested horizon.",
        }, indent=2))
        return

    writer = SupabaseRESTWriter()
    writer.upsert_matches(frame_records(fixtures, MATCH_FIELDS))

    predictions = build_upcoming_predictions(
        history=history,
        fixtures=fixtures,
        model_version=args.model_version,
        min_team_matches=args.min_team_matches,
        lambda_beta=args.lambda_beta,
        home_lambda_scale=args.home_lambda_scale,
        away_lambda_scale=args.away_lambda_scale,
        process_span=args.process_span,
        process_prior_weight=args.process_prior_weight,
        venue_split_weight=args.venue_split_weight,
    )
    if predictions.empty:
        raise RuntimeError("Upcoming fixtures produced no model predictions.")

    outputs = model_output_records(
        predictions,
        target_ev=args.target_ev,
    )
    writer.insert_model_outputs(outputs)

    validation = reader.model_market_validation(args.model_version)
    status = "RESEARCH"
    if not validation.empty:
        row = validation[validation["market"] == "1X2"]
        if not row.empty:
            status = str(row.iloc[0]["status"])

    preview = predictions[
        [
            "match_id", "match_date", "home_team", "away_team",
            "home_xg", "away_xg",
            "home_win_probability", "draw_probability",
            "away_win_probability",
        ]
    ].to_dict(orient="records")

    print(json.dumps({
        "status": "ok",
        "model_version": args.model_version,
        "validation_status": status,
        "fixtures": int(len(fixtures)),
        "predictions": int(len(predictions)),
        "model_output_rows": int(len(outputs)),
        "preview": preview,
    }, indent=2, default=str))



def command_results_refresh(args: argparse.Namespace) -> None:
    result = refresh_results_ledger(model_version=args.model_version)
    print(json.dumps({
        "status": "ok",
        "model_version": args.model_version,
        "published": result.published,
        "settled": result.settled,
        "open_calls": result.open_calls,
    }, indent=2))



def command_research_process_ridge(args: argparse.Namespace) -> None:
    reader = SupabaseRESTReader()
    frame = reader.historical_match_team_metrics()
    if frame.empty:
        raise RuntimeError("No historical Footy data found in Supabase.")

    frame = frame[frame["league"] == args.league].copy()
    wanted = {
        *[str(s) for s in args.train_season],
        *[str(s) for s in args.holdout_season],
    }
    frame = frame[frame["season"].astype(str).isin(wanted)].copy()
    if frame.empty:
        raise RuntimeError("No rows match the process-ridge research scope.")

    feature_rows = build_process_feature_rows(
        frame,
        process_span=args.process_span,
        process_prior_weight=args.process_prior_weight,
        venue_split_weight=args.venue_split_weight,
        min_team_matches=args.min_team_matches,
    )
    fit, predictions = holdout_match_predictions(
        feature_rows,
        train_seasons={str(s) for s in args.train_season},
        holdout_seasons={str(s) for s in args.holdout_season},
        alpha=args.alpha,
    )
    if predictions.empty:
        raise RuntimeError("Process ridge produced no holdout predictions.")

    home = (
        frame[frame["home_away"] == "H"]
        [["match_id", "goals", "xg"]]
        .rename(columns={"goals": "home_goals", "xg": "actual_home_xg"})
    )
    away = (
        frame[frame["home_away"] == "A"]
        [["match_id", "goals", "xg"]]
        .rename(columns={"goals": "away_goals", "xg": "actual_away_xg"})
    )
    outcomes = home.merge(away, on="match_id", how="inner", validate="one_to_one")
    scored = predictions.merge(
        outcomes,
        on="match_id",
        how="inner",
        validate="one_to_one",
    )

    scored["home_win_actual"] = (
        scored["home_goals"] > scored["away_goals"]
    ).astype(int)
    scored["draw_actual"] = (
        scored["home_goals"] == scored["away_goals"]
    ).astype(int)
    scored["away_win_actual"] = (
        scored["home_goals"] < scored["away_goals"]
    ).astype(int)
    scored["over_2_5_actual"] = (
        scored["home_goals"] + scored["away_goals"] >= 3
    ).astype(int)
    scored["btts_yes_actual"] = (
        (scored["home_goals"] > 0) & (scored["away_goals"] > 0)
    ).astype(int)

    home_brier, home_log = binary_metrics(
        scored["home_win_probability"],
        scored["home_win_actual"],
    )
    over_brier, over_log = binary_metrics(
        scored["over_2_5_probability"],
        scored["over_2_5_actual"],
    )
    btts_brier, btts_log = binary_metrics(
        scored["btts_yes_probability"],
        scored["btts_yes_actual"],
    )
    actual_1x2 = pd.Series(
        [
            "home" if hg > ag else "away" if hg < ag else "draw"
            for hg, ag in zip(scored["home_goals"], scored["away_goals"])
        ],
        index=scored.index,
    )
    one_x_two_log = multiclass_log_loss(
        pd.DataFrame({
            "home": scored["home_win_probability"],
            "draw": scored["draw_probability"],
            "away": scored["away_win_probability"],
        }),
        actual_1x2,
    )

    coefficient_map = {
        "intercept": float(fit.coefficients[0]),
        **{
            name: float(value)
            for name, value in zip(
                fit.feature_columns,
                fit.coefficients[1:],
            )
        },
    }
    research = {
        "train_seasons": sorted({str(s) for s in args.train_season}),
        "holdout_seasons": sorted({str(s) for s in args.holdout_season}),
        "alpha": float(args.alpha),
        "training_team_rows": int(
            feature_rows["season"].astype(str).isin(args.train_season).sum()
        ),
        "holdout_team_rows": int(
            feature_rows["season"].astype(str).isin(args.holdout_season).sum()
        ),
        "home_xg_mae": float(
            (scored["model_home_xg"] - scored["actual_home_xg"]).abs().mean()
        ),
        "away_xg_mae": float(
            (scored["model_away_xg"] - scored["actual_away_xg"]).abs().mean()
        ),
        "coefficients": coefficient_map,
    }

    result = {
        "model_version": args.model_version,
        "league": args.league,
        "seasons": sorted({str(s) for s in args.holdout_season}),
        "prediction_rows": int(len(scored)),
        "home_win_brier": home_brier,
        "home_win_log_loss": home_log,
        "over_2_5_brier": over_brier,
        "over_2_5_log_loss": over_log,
        "btts_brier": btts_brier,
        "btts_log_loss": btts_log,
        "result_1x2_log_loss": one_x_two_log,
        "calibration": {"process_ridge_research": research},
    }

    store = scored[
        [
            "match_id",
            "model_home_xg",
            "model_away_xg",
            "uncertainty_haircut",
            "home_win_probability",
            "draw_probability",
            "away_win_probability",
            "over_2_5_probability",
            "btts_yes_probability",
        ]
    ].copy()
    store["home_elo"] = None
    store["away_elo"] = None
    store["model_version"] = args.model_version

    writer = SupabaseRESTWriter()
    writer.upsert_historical_predictions(
        frame_records(store, HISTORICAL_PREDICTION_FIELDS)
    )
    insert_backtest_run(writer, result)

    print(json.dumps({
        "status": "ok",
        **result,
    }, indent=2, default=str))


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
        process_mode=args.process_mode,
        npxg_weight=args.npxg_weight,
        lambda_beta=args.lambda_beta,
        home_lambda_scale=args.home_lambda_scale,
        away_lambda_scale=args.away_lambda_scale,
        process_span=args.process_span,
        process_prior_weight=args.process_prior_weight,
        venue_split_weight=args.venue_split_weight,
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

    prediction_store = predictions[
        [
            "match_id",
            "model_home_xg",
            "model_away_xg",
            "uncertainty_haircut",
            "home_win_probability",
            "draw_probability",
            "away_win_probability",
            "over_2_5_probability",
            "btts_yes_probability",
            "home_elo",
            "away_elo",
        ]
    ].copy()
    prediction_store["model_version"] = args.model_version
    writer.upsert_historical_predictions(
        frame_records(
            prediction_store,
            HISTORICAL_PREDICTION_FIELDS,
        )
    )
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

    fpl_core = sub.add_parser(
        "fpl-core-ingest",
        help="Verify and ingest FPL-Core-Insights enrichment rows",
    )
    fpl_core.add_argument("--gameweek", type=int, required=True)
    fpl_core.add_argument("--league", default="ENG-Premier League")
    fpl_core.add_argument("--season", default="2627")
    fpl_core.add_argument("--min-match-rate", type=float, default=0.92)
    fpl_core.add_argument(
        "--penalty-xg-value",
        type=float,
        help=(
            "Season-validated FPL-Core penalty xG convention. "
            "If omitted the current batch must validate it independently."
        ),
    )

    fpl_core_priors = sub.add_parser(
        "fpl-core-priors-ingest",
        help="Ingest completed-season Official-FPL player priors from FPL-Core",
    )
    fpl_core_priors.add_argument("--season-folder", required=True)
    fpl_core_priors.add_argument("--season", required=True)
    fpl_core_priors.add_argument("--gameweek", type=int, default=38)

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

    odds_import = sub.add_parser(
        "odds-import",
        help="Import a licensed local historical 1X2 odds CSV",
    )
    odds_import.add_argument("--csv", required=True)
    odds_import.add_argument("--league", default="ENG-Premier League")
    odds_import.add_argument("--season", action="append")
    odds_import.add_argument("--bookmaker", required=True)
    odds_import.add_argument("--source", required=True)
    odds_import.add_argument(
        "--price-kind",
        choices=["open", "close", "snapshot"],
        required=True,
    )
    odds_import.add_argument("--date-col", default="Date")
    odds_import.add_argument("--home-team-col", default="HomeTeam")
    odds_import.add_argument("--away-team-col", default="AwayTeam")
    odds_import.add_argument("--home-odds-col")
    odds_import.add_argument("--draw-odds-col")
    odds_import.add_argument("--away-odds-col")
    odds_import.add_argument(
        "--min-match-rate",
        type=float,
        default=0.95,
    )


    football_data_odds = sub.add_parser(
        "football-data-odds-ingest",
        help="Fetch and ingest Football-Data.co.uk historical 1X2 prices",
    )
    football_data_odds.add_argument(
        "--league",
        default="ENG-Premier League",
    )
    football_data_odds.add_argument(
        "--season",
        action="append",
        required=True,
        help="Football-Data season identifier, e.g. 2223.",
    )
    football_data_odds.add_argument(
        "--min-match-rate",
        type=float,
        default=0.95,
    )

    value_backtest = sub.add_parser(
        "value-backtest",
        help="Backtest stored Footy probabilities against imported 1X2 prices",
    )
    value_backtest.add_argument("--model-version", required=True)
    value_backtest.add_argument("--bookmaker", required=True)
    value_backtest.add_argument(
        "--price-kind",
        choices=["open", "close", "snapshot"],
        required=True,
    )
    value_backtest.add_argument("--source")
    value_backtest.add_argument(
        "--market",
        choices=["1X2", "TOTAL_2.5"],
        default="1X2",
    )
    value_backtest.add_argument("--target-ev", type=float, default=0.02)

    diagnose_upcoming = sub.add_parser(
        "diagnose-upcoming",
        help="Print pre-match process diagnostics for upcoming fixtures",
    )
    diagnose_upcoming.add_argument(
        "--league",
        default="ENG-Premier League",
    )
    diagnose_upcoming.add_argument("--season", required=True)
    diagnose_upcoming.add_argument(
        "--history-season",
        action="append",
        help="Stored Footy season used as diagnostic history.",
    )
    diagnose_upcoming.add_argument(
        "--horizon-days",
        type=int,
        default=10,
    )

    predict_upcoming = sub.add_parser(
        "predict-upcoming",
        help="Price upcoming Understat fixtures from stored Footy history",
    )
    predict_upcoming.add_argument(
        "--league",
        default="ENG-Premier League",
    )
    predict_upcoming.add_argument(
        "--season",
        required=True,
        help="soccerdata/Understat season identifier, e.g. 2026.",
    )
    predict_upcoming.add_argument(
        "--history-season",
        action="append",
        help="Stored Footy season used as model history. Repeat as needed.",
    )
    predict_upcoming.add_argument(
        "--model-version",
        default="v7-r16-p50-v20",
    )
    predict_upcoming.add_argument(
        "--horizon-days",
        type=int,
        default=10,
    )
    predict_upcoming.add_argument(
        "--min-team-matches",
        type=int,
        default=5,
    )
    predict_upcoming.add_argument(
        "--target-ev",
        type=float,
        default=0.02,
    )
    predict_upcoming.add_argument(
        "--lambda-beta",
        type=float,
        default=1.0,
    )
    predict_upcoming.add_argument(
        "--home-lambda-scale",
        type=float,
        default=1.0,
    )
    predict_upcoming.add_argument(
        "--away-lambda-scale",
        type=float,
        default=1.0,
    )
    predict_upcoming.add_argument(
        "--process-span",
        type=int,
        default=16,
    )
    predict_upcoming.add_argument(
        "--process-prior-weight",
        type=float,
        default=0.50,
    )
    predict_upcoming.add_argument(
        "--venue-split-weight",
        type=float,
        default=0.20,
    )


    results_refresh = sub.add_parser(
        "results-refresh",
        help="Freeze upcoming public model calls and settle completed results",
    )
    results_refresh.add_argument(
        "--model-version",
        default="v7-r16-p50-v20",
    )

    process_ridge = sub.add_parser(
        "research-process-ridge",
        help="Fit process-only ridge xG on training seasons and score holdout seasons",
    )
    process_ridge.add_argument("--league", default="ENG-Premier League")
    process_ridge.add_argument("--train-season", action="append", required=True)
    process_ridge.add_argument("--holdout-season", action="append", required=True)
    process_ridge.add_argument(
        "--model-version",
        default="v8-process-ridge-a10-holdout",
    )
    process_ridge.add_argument("--alpha", type=float, default=10.0)
    process_ridge.add_argument("--min-team-matches", type=int, default=5)
    process_ridge.add_argument("--process-span", type=int, default=16)
    process_ridge.add_argument("--process-prior-weight", type=float, default=0.50)
    process_ridge.add_argument("--venue-split-weight", type=float, default=0.20)

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
    calibrate.add_argument(
        "--process-mode",
        choices=["xg", "npxg_blend", "schedule_adjusted"],
        default="xg",
        help="Team-strength process used before pricing.",
    )
    calibrate.add_argument(
        "--npxg-weight",
        type=float,
        default=0.70,
        help="npxG weight when process-mode is npxg_blend.",
    )
    calibrate.add_argument(
        "--lambda-beta",
        type=float,
        default=1.0,
        help="Power calibration applied to expected-goal intensities.",
    )
    calibrate.add_argument(
        "--home-lambda-scale",
        type=float,
        default=1.0,
        help="Multiplicative home expected-goal calibration.",
    )
    calibrate.add_argument(
        "--away-lambda-scale",
        type=float,
        default=1.0,
        help="Multiplicative away expected-goal calibration.",
    )
    calibrate.add_argument(
        "--process-span",
        type=int,
        default=8,
        help="EWM span for recent process form.",
    )
    calibrate.add_argument(
        "--process-prior-weight",
        type=float,
        default=0.35,
        help="Weight on expanding team prior versus recent process.",
    )
    calibrate.add_argument(
        "--venue-split-weight",
        type=float,
        default=0.35,
        help="Weight on home/away split process versus overall process.",
    )

    args = parser.parse_args()
    if args.command == "sources":
        command_sources()
    elif args.command == "understat-smoke":
        command_understat(args)
    elif args.command == "understat-ingest":
        command_understat_ingest(args)
    elif args.command == "fpl-core-ingest":
        command_fpl_core_ingest(args)
    elif args.command == "fpl-core-priors-ingest":
        command_fpl_core_priors_ingest(args)
    elif args.command == "clubelo-ingest":
        command_clubelo_ingest(args)
    elif args.command == "external-elo-import":
        command_external_elo_import(args)
    elif args.command == "odds-import":
        command_odds_import(args)
    elif args.command == "football-data-odds-ingest":
        command_football_data_odds_ingest(args)
    elif args.command == "value-backtest":
        command_value_backtest(args)
    elif args.command == "diagnose-upcoming":
        command_diagnose_upcoming(args)
    elif args.command == "predict-upcoming":
        command_predict_upcoming(args)
    elif args.command == "results-refresh":
        command_results_refresh(args)
    elif args.command == "research-process-ridge":
        command_research_process_ridge(args)
    elif args.command == "calibrate":
        command_calibrate(args)


if __name__ == "__main__":
    main()
