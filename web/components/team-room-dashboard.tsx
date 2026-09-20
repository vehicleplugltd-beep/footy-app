
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FplPitchPlayer } from "@/lib/fpl-team";
import type {
  ScoutIntelligencePayload,
  PortfolioHealth,
  ScoutPlayerProfile,
  ScoutTeamProfile,
} from "@/lib/fpl";
import {
  ManagerIntelDrawer,
  PlayerIntelDrawer,
  TeamIntelDrawer,
} from "@/components/intelligence-drawers";
import { footyQuip } from "@/lib/footy-voice";

type Standing = {
  entry_id: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  event_total: number;
  total: number;
};

type CounterPathResource = {
  starting_free_transfers: number;
  ending_free_transfers: number;
  starting_bank: number;
  ending_bank: number;
  hit_cost: number;
  chips_used: Array<{
    event_id: number;
    event_name: string;
    chip: string;
  }>;
  weeks: Array<{
    event_id: number;
    event_name: string;
    transfers: Array<{
      out: { id: number; name: string; team: string };
      in: { id: number; name: string; team: string };
      weighted_gain: number;
    }>;
    captain: { id: number; name: string; team: string } | null;
    chip: string | null;
    hit_cost: number;
    free_transfers_before: number;
    free_transfers_after: number;
    bank_after: number;
    projected_mean: number;
  }>;
};

type LeagueResponse = {
  standings?: { results: Standing[] };
};

type ManagerResponse = {
  league_strategy?: {
    pressure_focus?: string;
    gap_above?: number | null;
    gap_below?: number | null;
    target_name?: string | null;
    chaser_name?: string | null;
    captain_moves?: Array<{
      player: {
        id: number;
        name: string;
        team: string;
        assistantScore: number;
      };
      rationale: string;
    }>;
    transfer_moves?: Array<{
      out: { id: number; name: string; team: string };
      in: { id: number; name: string; team: string };
      raw_gain: number;
      minimum_gain?: number;
      horizon_gain?: number;
      rationale: string;
    }>;
  };
  resource_map?: Array<{
    standing: Standing;
    history: {
      estimatedFreeTransfers: number;
      totalHitCost: number;
      recentHitCost: number;
      activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT";
      currentHalfRemaining: string[];
      chips: Array<{ label: string; event: number }>;
    };
  }>;
  resource_advice?: {
    status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
    free_transfer_edge: number;
    chip_edge: string[];
    chip_threats: string[];
    recommendation: string;
  } | null;
  decision_quality?: {
    status: "ACTIVE" | "ACCUMULATING" | "UNAVAILABLE";
    tracked_from_event: number;
    completed: Array<{
      event: number;
      generated_at: string;
      model_version: string | null;
      battle_mode: string | null;
      captain: {
        process: string;
        actual_player_id: number | null;
        model_player_id: number | null;
        model_player_name: string | null;
        model_expected: number | null;
        actual_choice_expected: number | null;
        expected_ev_gap: number | null;
        actual_choice_points: number | null;
        model_choice_points: number | null;
        actual_vs_model_expectation: number | null;
      };
      transfers: {
        process: string;
        actual_in_ids: number[];
        actual_out_ids: number[];
        model_top: {
          out: { id: number; name: string; team: string; score: number };
          in: { id: number; name: string; team: string; score: number } | null;
          reason: string;
        } | null;
        model_expected_delta: number | null;
        model_actual_delta: number | null;
        hit_cost: number;
      };
      bench_points: number;
    }>;
    summary: {
      deadlines: number;
      captain_process_alignment: number;
      total_hit_cost: number;
      average_bench_points: number;
      negative_variance_deadlines: number;
      observations: string[];
    } | null;
    caveat: string;
  };
  counterplay?: {
    snapshot_event: number | null;
    managers_in_local_matrix: number;
    iterations: number;
    strategy_mode: "PROTECT" | "CHASE" | "RECOVER";
    objective: string;
    baseline: {
      objective_probability: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
    } | null;
    game_theory_impact: {
      band: "NEUTRAL" | "MATERIAL" | "DECISIVE";
      probability_delta: number;
      threshold_neutral: number;
      threshold_decisive: number;
      explanation: string;
    };
    horizon_results?: Partial<Record<"1" | "3" | "5", {
      horizon: number;
      event_names: string[];
      iterations: number;
      baseline: {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      } | null;
      recommended_scenario: {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      } | null;
      scenarios: Array<{
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      }>;
      game_theory_impact: {
        band: "NEUTRAL" | "MATERIAL" | "DECISIVE";
        probability_delta: number;
      };
    }>>;
    recommended_scenario: {
      id: string;
      label: string;
      style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
      objective_probability: number;
      probability_delta: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
      reason: string;
      transfer: {
        out: { id: number; name: string; team: string };
        in: { id: number; name: string; team: string };
      } | null;
      captain: { id: number; name: string; team: string } | null;
    } | null;
    scenarios: Array<{
      id: string;
      label: string;
      style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
      objective_probability: number;
      probability_delta: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
      reason: string;
    }>;
    local_exposure: Array<{
      player_id: number;
      squad_ownership: number;
      starter_ownership: number;
      captain_share: number;
      effective_exposure: number;
      player: {
        id: number;
        name: string;
        team: string;
        assistantScore: number;
      } | null;
    }>;
    primary_threats: Array<{
      rival_entry_id: number;
      rival_name: string;
      player: {
        id: number;
        name: string;
        team: string;
        assistantScore: number;
      };
      threat_score: number;
      local_exposure: {
        squad_ownership: number;
        starter_ownership: number;
        captain_share: number;
        effective_exposure: number;
      } | null;
      ceiling_proxy: number;
    }>;
    rival_vectors: Array<{
      entry_id: number;
      name: string;
      gap: number;
      bank: number;
      estimated_free_transfers: number | null;
      remaining_chips: string[];
      activity: string | null;
      transfer_vectors: Array<{
        out: { id: number; name: string; team: string } | null;
        in: { id: number; name: string; team: string } | null;
        label: string;
        model_share: number;
        caveat: string;
      }>;
    }>;
    caveats: string[];
  };
  portfolio_plan?: {
    action: "BANK" | "HOLD" | "TRANSFER" | "STRUCTURAL_REPAIR" | "CHIP_PREP";
    headline: string;
    portfolio: PortfolioHealth;
    decision_driver: "GAME_THEORY_TIEBREAK" | "FOOTBALL_PORTFOLIO" | "PORTFOLIO_STRUCTURE";
    game_theory: {
      band: "NEUTRAL" | "MATERIAL" | "DECISIVE";
      probability_delta: number;
      threshold_neutral: number;
      threshold_decisive: number;
      explanation: string;
      used_as_tiebreak: boolean;
      football_primary_transfer: {
        out: string;
        in: string;
        raw_gain: number;
        horizon_gain: number;
      } | null;
      selected_transfer: {
        out: string;
        in: string;
        raw_gain: number;
        horizon_gain: number;
      } | null;
    };
    free_transfers: number | null;
    hit_cost_for_one_extra_move: number | null;
    chip_signal: {
      chip: string;
      status: string;
      eventName: string | null;
      reason: string;
    } | null;
    league_mode: "PROTECT" | "CHASE" | "RECOVER";
    field_ownership_proxy: {
      average_squad_ownership: number;
      high_ownership_assets: number;
      differentials_under_10: number;
      caveat: string;
    };
    differential_guidance: string;
    why: string[];
    failure_modes: string[];
    underlying: string[];
    missing: string[];
    resource_status: string;
    caveat: string;
  };
};

function percentileRating(
  profile: ScoutPlayerProfile,
  all: ScoutPlayerProfile[],
  field: "now" | "future",
) {
  const peers = all.filter(
    (item) => item.player.position === profile.player.position,
  );
  if (!peers.length) return 50;

  const score =
    field === "now" ? profile.player.assistantScore : profile.score6;
  const below = peers.filter((item) => {
    const value =
      field === "now" ? item.player.assistantScore : item.score6;
    return value <= score;
  }).length;

  return Math.max(
    1,
    Math.min(99, Math.round((below / peers.length) * 100)),
  );
}

function ratingBand(value: number) {
  if (value >= 80) return "Elite";
  if (value >= 65) return "Strong";
  if (value >= 50) return "Okay";
  if (value >= 35) return "Concern";
  return "Weak";
}

export function TeamRoomDashboard({
  teamId,
  leagueId,
  leagueName,
  leagueRank,
  squad,
}: {
  teamId: number;
  leagueId: number;
  leagueName: string;
  leagueRank: number | null;
  squad: FplPitchPlayer[];
}) {
  const [scout, setScout] =
    useState<ScoutIntelligencePayload | null>(null);
  const [league, setLeague] =
    useState<LeagueResponse | null>(null);
  const [manager, setManager] =
    useState<ManagerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] =
    useState<ScoutPlayerProfile | null>(null);
  const [selectedTeam, setSelectedTeam] =
    useState<ScoutTeamProfile | null>(null);
  const [selectedManager, setSelectedManager] =
    useState<Standing | null>(null);
  const [counterHorizon, setCounterHorizon] = useState<1 | 3 | 5>(3);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const leagueUrl =
          "/api/league/" +
          leagueId +
          "?team=" +
          teamId +
          (leagueRank ? "&rank=" + leagueRank : "");

        const [scoutRes, leagueRes, managerRes] =
          await Promise.all([
            fetch("/api/scout", {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch(leagueUrl, {
              cache: "no-store",
              signal: controller.signal,
            }),
            fetch(
              "/api/league/" +
                leagueId +
                "/manager/" +
                teamId +
                "?staff=1",
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
          ]);

        const [scoutBody, leagueBody, managerBody] =
          await Promise.all([
            scoutRes.json(),
            leagueRes.json(),
            managerRes.json(),
          ]);

        if (!scoutRes.ok || !managerRes.ok) {
          throw new Error(
            scoutBody.error ||
              managerBody.error ||
              "Team Room intelligence is temporarily unavailable.",
          );
        }

        setScout(scoutBody);
        if (leagueRes.ok) setLeague(leagueBody);
        setManager(managerBody);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Team Room intelligence is temporarily unavailable.",
        );
      }
    }

    void load();
    return () => controller.abort();
  }, [teamId, leagueId, leagueRank]);

  const squadRatings = useMemo(() => {
    if (!scout) return [];

    const byId = new Map(
      scout.players.map((profile) => [
        profile.player.id,
        profile,
      ]),
    );

    return squad
      .map((pick) => {
        const profile = byId.get(pick.id);
        if (!profile) return null;

        return {
          pick,
          profile,
          now: percentileRating(profile, scout.players, "now"),
          future: percentileRating(
            profile,
            scout.players,
            "future",
          ),
        };
      })
      .filter(
        (
          item,
        ): item is {
          pick: FplPitchPlayer;
          profile: ScoutPlayerProfile;
          now: number;
          future: number;
        } => Boolean(item),
      )
      .sort((a, b) => a.pick.slot - b.pick.slot);
  }, [scout, squad]);

  const squadNow = squadRatings.length
    ? Math.round(
        squadRatings.reduce(
          (sum, item) => sum + item.now,
          0,
        ) / squadRatings.length,
      )
    : null;

  const squadFuture = squadRatings.length
    ? Math.round(
        squadRatings.reduce(
          (sum, item) => sum + item.future,
          0,
        ) / squadRatings.length,
      )
    : null;

  const weakPlayers = [...squadRatings]
    .sort((a, b) => a.future - b.future)
    .slice(0, 3);

  const intelligenceLoading = !error && (!scout || !manager);
  const portfolioPlan = manager?.portfolio_plan ?? null;
  const counterPlay = manager?.counterplay ?? null;
  const counterHorizonKey = String(counterHorizon) as "1" | "3" | "5";
  const activeCounterHorizon =
    counterPlay?.horizon_results?.[counterHorizonKey] ??
    counterPlay?.horizon_results?.["3"] ??
    counterPlay?.horizon_results?.["1"] ??
    counterPlay?.horizon_results?.["5"] ??
    null;
  const decisionQuality = manager?.decision_quality ?? null;
  const transfer =
    manager?.league_strategy?.transfer_moves?.[0] ?? null;
  const captain =
    manager?.league_strategy?.captain_moves?.[0] ?? null;

  const transferInProfile =
    transfer && scout
      ? scout.players.find((profile) => profile.player.id === transfer.in.id) ?? null
      : null;
  const transferEvidence = intelligenceLoading
    ? "CHECKING"
    : portfolioPlan?.portfolio.status ??
      (transfer ? transferInProfile?.decisionConfidence ?? "PENDING" : "THRESHOLD HOLD");
  const transferWhy =
    portfolioPlan?.why.at(-1) ??
    transfer?.rationale ??
    "No replacement currently clears Footy’s value, minutes and timing threshold.";
  const transferFailure =
    portfolioPlan?.failure_modes[0] ??
    transferInProfile?.risks[0] ??
    (transfer
      ? "Late team news, role changes or a price move can reduce the projected gain."
      : "Late team news, a price move or a role change can create a new edge before the deadline.");

  const standings = league?.standings?.results ?? [];
  const ownIndex = standings.findIndex(
    (row) => row.entry_id === teamId,
  );
  const standingsWindow =
    ownIndex >= 0
      ? standings.slice(
          Math.max(0, ownIndex - 3),
          ownIndex + 4,
        )
      : standings.slice(0, 8);

  const resourceRows = manager?.resource_map ?? [];
  const squadQuip = intelligenceLoading
    ? "Checking your squad against the live market and your mini-league."
    : squadFuture != null && squadFuture >= 65
      ? footyQuip("strongSquad")
      : footyQuip("weakSquad");
  const actionQuip = intelligenceLoading
    ? "Comparing squad quality, player process, structure and league pressure."
    : portfolioPlan?.action === "BANK"
      ? "The free transfer is an asset too. No need to spend it for the sake of activity."
      : portfolioPlan?.action === "STRUCTURAL_REPAIR"
        ? "This is bigger than one player. Fix the squad shape before chasing marginal points."
        : portfolioPlan?.action === "CHIP_PREP"
          ? "The calendar is becoming the decision. Preserve the squad shape for the chip window."
          : transfer
            ? footyQuip("move", { player: transfer.in.name })
            : footyQuip("hold");

  return (
    <div className="team-room-dashboard">
      {error ? (
        <div className="team-room-error">{error}</div>
      ) : null}

      <blockquote className="footy-quip team-room-quip">{squadQuip}</blockquote>

      <div className="team-room-status-row" aria-label="Live data status">
        <span className="team-room-live-pill">
          <i />
          {scout?.freshness === "LIVE_FPL" ? "LIVE FPL" : "FPL DATA"}
        </span>
        <span>
          {scout?.dataRetrievedAt
            ? "Updated " +
              new Date(scout.dataRetrievedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Loading live intelligence"}
        </span>
        <span>
          {scout
            ? scout.undervalued.length + " value flags in Scout"
            : "Scanning player value"}
        </span>
      </div>

      <section className="team-room-command-grid">
        <article className="team-room-block team-room-command-card">
          <div className="team-room-block-head">
            <div>
              <span>FOOTY SUGGESTS</span>
              <h2>
                {intelligenceLoading
                  ? "Building your plan…"
                  : portfolioPlan?.headline ??
                    (transfer
                      ? transfer.out.name + " → " + transfer.in.name
                      : "Hold the transfer")}
              </h2>
            </div>
          </div>

          <blockquote className="footy-quip compact">{actionQuip}</blockquote>
          <div className="team-room-suggestion">
            <div>
              <span>PORTFOLIO ACTION</span>
              <strong>
                {intelligenceLoading
                  ? "CHECKING"
                  : portfolioPlan?.action.replaceAll("_", " ") ??
                    (transfer ? transfer.out.name + " → " + transfer.in.name : "HOLD")}
              </strong>
              <small>
                {intelligenceLoading
                  ? "Comparing football edge, FT option value, squad structure and timing."
                  : portfolioPlan
                    ? (portfolioPlan.free_transfers == null
                        ? "FT bank uncertain"
                        : portfolioPlan.free_transfers + "/5 FT") +
                      " · portfolio " +
                      portfolioPlan.portfolio.score +
                      "/100 · " +
                      portfolioPlan.portfolio.status +
                      " · game theory " +
                      portfolioPlan.game_theory.band.toLowerCase()
                    : transfer
                      ? "+" +
                        transfer.raw_gain.toFixed(1) +
                        " now · min +" +
                        (transfer.minimum_gain ?? 0).toFixed(1) +
                        " · +" +
                        (transfer.horizon_gain ?? 0).toFixed(1) +
                        " horizon"
                      : "No replacement clears the value and timing threshold."}
              </small>
            </div>

            <div>
              <span>CAPTAIN</span>
              <strong>
                {intelligenceLoading
                  ? "CHECKING"
                  : captain?.player.name ?? "No change"}
              </strong>
              <small>
                {intelligenceLoading
                  ? "Comparing captain output, ownership and league pressure."
                  : captain?.rationale ??
                    "Expected output remains the priority."}
              </small>
              {captain?.player.name ? (
                <em className="team-room-inline-quip">
                  {footyQuip("captain", { player: captain.player.name })}
                </em>
              ) : null}
            </div>

            <div>
              <span>RESOURCE</span>
              <strong>
                {intelligenceLoading
                  ? "CHECKING"
                  : manager?.resource_advice?.status ?? "—"}
              </strong>
              <small>
                {intelligenceLoading
                  ? "Reading free-transfer, chip and rival flexibility."
                  : manager?.resource_advice?.recommendation ??
                    "No resource warning."}
              </small>
            </div>
          </div>

          {intelligenceLoading ? (
            <div className="team-room-model-loading" role="status">
              <span>MODEL CHECK</span>
              <strong>Building the decision from live player, process and league evidence…</strong>
            </div>
          ) : (
            <div className="team-room-decision-proof">
              <div>
                <span>WHY</span>
                <strong>{transferWhy}</strong>
              </div>
              <div>
                <span>EVIDENCE</span>
                <strong className={
                  transferInProfile
                    ? "confidence-" + transferInProfile.decisionConfidence.toLowerCase()
                    : ""
                }>
                  {transferEvidence}
                </strong>
              </div>
              <div>
                <span>FAILURE MODE</span>
                <strong>{transferFailure}</strong>
              </div>
            </div>
          )}

          {weakPlayers.length ? (
            <div className="team-room-watch">
              <span>SQUAD PRESSURE POINTS</span>
              {weakPlayers.map((item) => (
                <p key={item.pick.id}>
                  <b>{item.pick.name}</b> — future rating{" "}
                  {item.future}; best window{" "}
                  {item.profile.bestWindow.startName}–
                  {item.profile.bestWindow.endName}.
                </p>
              ))}
            </div>
          ) : null}

          <Link
            className="team-room-primary"
            href={
              "/team/" +
              teamId +
              "/preview?league=" +
              leagueId
            }
          >
            Preview Footy’s plan →
          </Link>
        </article>

        <article className="team-room-block team-room-pressure-card">
          <div className="team-room-block-head">
            <div>
              <span>LEAGUE BATTLE</span>
              <h2>Where the pressure is</h2>
            </div>
          </div>

          <div className="team-room-pressure">
            <div>
              <span>ABOVE</span>
              <strong>
                {manager?.league_strategy?.target_name ??
                  "Leader"}
              </strong>
              <small>
                {manager?.league_strategy?.gap_above ?? "—"} pts
                away
              </small>
            </div>
            <div>
              <span>YOU</span>
              <strong>#{leagueRank ?? "—"}</strong>
              <small>{leagueName}</small>
            </div>
            <div>
              <span>BELOW</span>
              <strong>
                {manager?.league_strategy?.chaser_name ?? "—"}
              </strong>
              <small>
                {manager?.league_strategy?.gap_below ?? "—"} pts
                behind
              </small>
            </div>
          </div>

          <div className="team-room-standings">
            {standingsWindow.map((row) => (
              <button
                type="button"
                key={row.entry_id}
                className={
                  row.entry_id === teamId ? "you" : ""
                }
                onClick={() => setSelectedManager(row)}
                aria-label={"Open " + row.entry_name + " opposition profile"}
              >
                <span>#{row.rank}</span>
                <strong>{row.entry_name}</strong>
                <small>
                  {row.total} pts · GW {row.event_total}
                </small>
              </button>
            ))}
          </div>
          <Link
            className="team-room-deep-link"
            href={"/league/" + leagueId + "?team=" + teamId}
          >
            View full league table & manager analysis →
          </Link>
        </article>
      </section>

      {portfolioPlan ? (
        <section className="team-room-block portfolio-health">
          <div className="team-room-block-head">
            <div>
              <span>PORTFOLIO HEALTH</span>
              <h2>
                {portfolioPlan.portfolio.score}/100 · {portfolioPlan.portfolio.status}
              </h2>
            </div>
            <small>
              Long-term squad structure, not last week’s points ·{" "}
              <Link href="/research#long-term">open long-term research →</Link>
            </small>
          </div>

          <div className={"portfolio-driver portfolio-driver-" + portfolioPlan.game_theory.band.toLowerCase()}>
            <div>
              <span>DECISION DRIVER</span>
              <strong>
                {portfolioPlan.decision_driver === "GAME_THEORY_TIEBREAK"
                  ? "GAME THEORY TIE-BREAK"
                  : portfolioPlan.decision_driver === "FOOTBALL_PORTFOLIO"
                    ? "FOOTBALL + PORTFOLIO"
                    : "PORTFOLIO STRUCTURE"}
              </strong>
            </div>
            <div>
              <span>GAME THEORY IMPACT</span>
              <strong>{portfolioPlan.game_theory.band}</strong>
              <small>
                {(portfolioPlan.game_theory.probability_delta >= 0 ? "+" : "") +
                  (portfolioPlan.game_theory.probability_delta * 100).toFixed(1)}
                pp vs hold baseline
              </small>
            </div>
            <p>{portfolioPlan.game_theory.explanation}</p>
          </div>

          <div className="portfolio-health-grid">
            <div>
              <span>FREE TRANSFERS</span>
              <strong>{portfolioPlan.free_transfers ?? "—"}/5</strong>
              <small>
                {portfolioPlan.hit_cost_for_one_extra_move == null
                  ? "Hit cost uncertain"
                  : portfolioPlan.hit_cost_for_one_extra_move === 0
                    ? "Next extra move currently covered"
                    : "One move beyond bank = -4"}
              </small>
            </div>
            <div>
              <span>BANK</span>
              <strong>£{portfolioPlan.portfolio.bank.toFixed(1)}m</strong>
              <small>{portfolioPlan.portfolio.bankStatus}</small>
            </div>
            <div>
              <span>BENCH COVER</span>
              <strong>{portfolioPlan.portfolio.reliableBench}/4</strong>
              <small>reliable current substitutes</small>
            </div>
            <div>
              <span>BENCH VALUE</span>
              <strong>£{portfolioPlan.portfolio.bench.spend.toFixed(1)}m</strong>
              <small>
                {Math.round(portfolioPlan.portfolio.bench.spendShare * 100)}% of squad value ·{" "}
                {portfolioPlan.portfolio.bench.currentModelScore.toFixed(1)} model points
              </small>
            </div>
            <div>
              <span>6GW XI</span>
              <strong>{portfolioPlan.portfolio.horizon.sixGwAverageBestXi.toFixed(1)}</strong>
              <small>formation-constrained model average</small>
            </div>
            <div>
              <span>8GW XI</span>
              <strong>{portfolioPlan.portfolio.horizon.eightGwAverageBestXi.toFixed(1)}</strong>
              <small>structural horizon</small>
            </div>
            <div>
              <span>DIFFERENTIALS</span>
              <strong>{portfolioPlan.portfolio.differentialCount}</strong>
              <small>&lt;10% official ownership</small>
            </div>
            <div>
              <span>MIDFIELD ROUTE</span>
              <strong>{portfolioPlan.portfolio.priceStructure.midfieldRoute ? "OPEN" : "BLOCKED"}</strong>
              <small>
                {portfolioPlan.portfolio.priceStructure.midfieldTarget ?? "No urgent target"}
              </small>
            </div>
            <div>
              <span>FORWARD ROUTE</span>
              <strong>{portfolioPlan.portfolio.priceStructure.forwardRoute ? "OPEN" : "BLOCKED"}</strong>
              <small>
                {portfolioPlan.portfolio.priceStructure.forwardTarget ?? "No urgent target"}
              </small>
            </div>
            <div>
              <span>FIELD OWNERSHIP</span>
              <strong>{portfolioPlan.field_ownership_proxy.average_squad_ownership.toFixed(1)}%</strong>
              <small>official ownership average · not EO</small>
            </div>
            <div>
              <span>PREMIUMS</span>
              <strong>{portfolioPlan.portfolio.premiumCount}</strong>
              <small>£8.5m+ squad assets</small>
            </div>
          </div>

          <div className="portfolio-price-bands">
            <div>
              <span>GOALKEEPERS</span>
              <strong>£{portfolioPlan.portfolio.priceStructure.bands.goalkeeperSpend.toFixed(1)}m</strong>
              <small>
                {portfolioPlan.portfolio.priceStructure.bands.budgetGoalkeepers}/2 at £4.5m or below
              </small>
            </div>
            <div>
              <span>DEFENDERS</span>
              <strong>
                {portfolioPlan.portfolio.priceStructure.bands.premiumDefenders} /{" "}
                {portfolioPlan.portfolio.priceStructure.bands.midDefenders} /{" "}
                {portfolioPlan.portfolio.priceStructure.bands.budgetDefenders}
              </strong>
              <small>premium / mid / budget</small>
            </div>
            <div>
              <span>MIDFIELDERS</span>
              <strong>
                {portfolioPlan.portfolio.priceStructure.bands.premiumMidfielders} /{" "}
                {portfolioPlan.portfolio.priceStructure.bands.midMidfielders} /{" "}
                {portfolioPlan.portfolio.priceStructure.bands.enablerMidfielders}
              </strong>
              <small>£8.5m+ / £6.5–8.0m / ≤£5.5m</small>
            </div>
            <div>
              <span>FORWARDS</span>
              <strong>
                {portfolioPlan.portfolio.priceStructure.bands.premiumMidForwards} /{" "}
                {portfolioPlan.portfolio.priceStructure.bands.valueForwards} /{" "}
                {portfolioPlan.portfolio.priceStructure.bands.budgetForwards}
              </strong>
              <small>£7.5m+ / £5.5–7.4m / &lt;£5.5m</small>
            </div>
          </div>

          <div className="portfolio-evidence-grid">
            <section>
              <span>WHY</span>
              {portfolioPlan.why.map((reason, index) => (
                <p key={"why-" + index}>{reason}</p>
              ))}
            </section>
            <section>
              <span>FAILURE MODES</span>
              {portfolioPlan.failure_modes.map((risk, index) => (
                <p key={"risk-" + index}>{risk}</p>
              ))}
            </section>
            <section>
              <span>UNDERLYING DATA</span>
              {portfolioPlan.underlying.map((item, index) => (
                <p key={"data-" + index}>{item}</p>
              ))}
            </section>
            <section>
              <span>GAME THEORY</span>
              <p>{portfolioPlan.differential_guidance}</p>
              <p>{portfolioPlan.field_ownership_proxy.caveat}</p>
              <p>
                League mode: <b>{portfolioPlan.league_mode}</b> · resource state:{" "}
                <b>{portfolioPlan.resource_status}</b>
              </p>
            </section>
          </div>

          {portfolioPlan.missing.length ? (
            <div className="portfolio-missing">
              <span>NOT YET MEASURED — NOT INVENTED</span>
              {portfolioPlan.missing.map((item, index) => (
                <p key={"missing-" + index}>{item}</p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {counterPlay ? (
        <section className="team-room-block counterplay-panel">
          <div className="team-room-block-head">
            <div>
              <span>COUNTERPLAY</span>
              <h2>
                {counterPlay.strategy_mode} ·{" "}
                {counterPlay.recommended_scenario?.label ?? "Hold structure"}
              </h2>
            </div>
            <small>
              {counterPlay.iterations.toLocaleString()} correlated simulations ·{" "}
              {counterPlay.managers_in_local_matrix} league squads in local exposure matrix
            </small>
          </div>

          <p className="counterplay-objective">{counterPlay.objective}</p>
          <div className={"counterplay-impact counterplay-impact-" + counterPlay.game_theory_impact.band.toLowerCase()}>
            <span>GAME THEORY IMPACT</span>
            <strong>{counterPlay.game_theory_impact.band}</strong>
            <p>{counterPlay.game_theory_impact.explanation}</p>
          </div>

          {counterPlay.horizon_results && activeCounterHorizon ? (
            <div className="counterplay-horizon-shell">
              <div className="counterplay-horizon-toggle" aria-label="CounterPlay horizon">
                {([1, 3, 5] as const).map((horizon) => {
                  const key = String(horizon) as "1" | "3" | "5";
                  if (!counterPlay.horizon_results?.[key]) return null;
                  return (
                    <button
                      key={horizon}
                      type="button"
                      className={activeCounterHorizon.horizon === horizon ? "active" : ""}
                      onClick={() => setCounterHorizon(horizon)}
                    >
                      {horizon}GW
                    </button>
                  );
                })}
              </div>

              <div className="counterplay-horizon-summary">
                <div>
                  <span>PATH OBJECTIVE</span>
                  <strong>
                    {activeCounterHorizon.recommended_scenario
                      ? (activeCounterHorizon.recommended_scenario.objective_probability * 100).toFixed(1) + "%"
                      : "—"}
                  </strong>
                  <small>
                    {activeCounterHorizon.recommended_scenario
                      ? (activeCounterHorizon.recommended_scenario.probability_delta >= 0 ? "+" : "") +
                        (activeCounterHorizon.recommended_scenario.probability_delta * 100).toFixed(1) +
                        "pp vs hold"
                      : "No path edge"}
                  </small>
                </div>
                <div>
                  <span>BEST PATH</span>
                  <strong>
                    {activeCounterHorizon.recommended_scenario?.label ?? "Hold structure"}
                  </strong>
                  <small>{activeCounterHorizon.event_names.join(" → ")}</small>
                </div>
                <div>
                  <span>FT / BANK AT END</span>
                  <strong>
                    {activeCounterHorizon.recommended_scenario
                      ? activeCounterHorizon.recommended_scenario.resource_path.ending_free_transfers +
                        " FT · £" +
                        activeCounterHorizon.recommended_scenario.resource_path.ending_bank.toFixed(1)
                      : "—"}
                  </strong>
                  <small>
                    {activeCounterHorizon.recommended_scenario
                      ? activeCounterHorizon.recommended_scenario.resource_path.hit_cost +
                        " pts in projected hits"
                      : "No resource path"}
                  </small>
                </div>
                <div>
                  <span>PATH 5TH–95TH</span>
                  <strong>
                    {activeCounterHorizon.recommended_scenario
                      ? activeCounterHorizon.recommended_scenario.floor_5.toFixed(1) +
                        "–" +
                        activeCounterHorizon.recommended_scenario.ceiling_95.toFixed(1)
                      : "—"}
                  </strong>
                  <small>cumulative model score band</small>
                </div>
              </div>

              {activeCounterHorizon.recommended_scenario ? (
                <div className="counterplay-path-weeks">
                  {activeCounterHorizon.recommended_scenario.resource_path.weeks.map((week) => (
                    <article key={week.event_id}>
                      <div>
                        <b>{week.event_name}</b>
                        <small>
                          {week.transfers.length
                            ? week.transfers
                                .map((move) => move.out.name + " → " + move.in.name)
                                .join(" · ")
                            : "Bank / hold"}
                        </small>
                      </div>
                      <div>
                        <span>C {week.captain?.name ?? "—"}</span>
                        <span>
                          {week.free_transfers_after} FT · £{week.bank_after.toFixed(1)}
                          {week.hit_cost ? " · -" + week.hit_cost : ""}
                        </span>
                        {week.chip ? <span>{week.chip}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="counterplay-hero-grid">
            <div>
              <span>NEXT-GW BASELINE</span>
              <strong>
                {counterPlay.baseline
                  ? Math.round(counterPlay.baseline.objective_probability * 1000) / 10 + "%"
                  : "—"}
              </strong>
              <small>Hold / current structure</small>
            </div>
            <div>
              <span>NEXT-GW BEST</span>
              <strong>
                {counterPlay.recommended_scenario
                  ? Math.round(counterPlay.recommended_scenario.objective_probability * 1000) / 10 + "%"
                  : "—"}
              </strong>
              <small>
                {counterPlay.recommended_scenario
                  ? (counterPlay.recommended_scenario.probability_delta >= 0 ? "+" : "") +
                    (counterPlay.recommended_scenario.probability_delta * 100).toFixed(1) +
                    "pp vs baseline"
                  : "No scenario edge"}
              </small>
            </div>
            <div>
              <span>5TH–95TH</span>
              <strong>
                {counterPlay.recommended_scenario
                  ? counterPlay.recommended_scenario.floor_5.toFixed(1) +
                    "–" +
                    counterPlay.recommended_scenario.ceiling_95.toFixed(1)
                  : "—"}
              </strong>
              <small>model Gameweek score band</small>
            </div>
            <div>
              <span>VOLATILITY</span>
              <strong>
                {counterPlay.recommended_scenario?.volatility.toFixed(1) ?? "—"}
              </strong>
              <small>lower = tighter outcome distribution</small>
            </div>
          </div>

          {counterPlay.recommended_scenario ? (
            <div className="counterplay-primary-reason">
              <span>WHY THIS MOVES WIN/CONTROL PROBABILITY</span>
              <p>{counterPlay.recommended_scenario.reason}</p>
            </div>
          ) : null}

          <div className="counterplay-layout">
            <section>
              <span>SCENARIOS</span>
              <div className="counterplay-scenarios">
                {counterPlay.scenarios.map((scenario) => (
                  <article key={scenario.id}>
                    <div>
                      <b>{scenario.label}</b>
                      <small>{scenario.style}</small>
                    </div>
                    <strong>
                      {(scenario.objective_probability * 100).toFixed(1)}%
                    </strong>
                    <small>
                      {(scenario.probability_delta >= 0 ? "+" : "") +
                        (scenario.probability_delta * 100).toFixed(1)}
                      pp · mean {scenario.mean_score.toFixed(1)}
                    </small>
                    <p>{scenario.reason}</p>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <span>PRIMARY RIVAL THREATS</span>
              <div className="counterplay-threats">
                {counterPlay.primary_threats.slice(0, 8).map((threat) => (
                  <Link
                    key={threat.rival_entry_id + "-" + threat.player.id}
                    href={"/research?player=" + threat.player.id}
                  >
                    <div>
                      <b>{threat.player.name}</b>
                      <small>{threat.rival_name} · {threat.player.team}</small>
                    </div>
                    <strong>{threat.threat_score}/100</strong>
                    <small>
                      ceiling {threat.ceiling_proxy.toFixed(1)} · local starter{" "}
                      {threat.local_exposure
                        ? threat.local_exposure.starter_ownership.toFixed(0) + "%"
                        : "—"}
                    </small>
                  </Link>
                ))}
              </div>
              {counterPlay.primary_threats.length > 8 ? (
                <details className="counterplay-full-list">
                  <summary>View all {counterPlay.primary_threats.length} rival threat assets</summary>
                  <div className="counterplay-threats">
                    {counterPlay.primary_threats.map((threat) => (
                      <Link
                        key={"all-" + threat.rival_entry_id + "-" + threat.player.id}
                        href={"/research?player=" + threat.player.id}
                      >
                        <div>
                          <b>{threat.player.name}</b>
                          <small>{threat.rival_name} · {threat.player.team}</small>
                        </div>
                        <strong>{threat.threat_score}/100</strong>
                        <small>
                          ceiling {threat.ceiling_proxy.toFixed(1)} · local starter{" "}
                          {threat.local_exposure
                            ? threat.local_exposure.starter_ownership.toFixed(0) + "%"
                            : "—"}
                        </small>
                      </Link>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>
          </div>

          <div className="counterplay-layout secondary">
            <section>
              <span>LOCAL LEAGUE EXPOSURE</span>
              <div className="counterplay-exposure">
                {counterPlay.local_exposure.slice(0, 12).map((item) => (
                  <Link key={item.player_id} href={"/research?player=" + item.player_id}>
                    <b>{item.player?.name ?? "Player " + item.player_id}</b>
                    <small>
                      squad {item.squad_ownership.toFixed(0)}% · starters{" "}
                      {item.starter_ownership.toFixed(0)}% · captains{" "}
                      {item.captain_share.toFixed(0)}%
                    </small>
                    <strong>{item.effective_exposure.toFixed(0)}% local exposure</strong>
                  </Link>
                ))}
              </div>
              {counterPlay.local_exposure.length > 12 ? (
                <details className="counterplay-full-list">
                  <summary>View all {counterPlay.local_exposure.length} league-owned players</summary>
                  <div className="counterplay-exposure">
                    {counterPlay.local_exposure.map((item) => (
                      <Link
                        key={"all-exposure-" + item.player_id}
                        href={"/research?player=" + item.player_id}
                      >
                        <b>{item.player?.name ?? "Player " + item.player_id}</b>
                        <small>
                          squad {item.squad_ownership.toFixed(0)}% · starters{" "}
                          {item.starter_ownership.toFixed(0)}% · captains{" "}
                          {item.captain_share.toFixed(0)}%
                        </small>
                        <strong>{item.effective_exposure.toFixed(0)}% local exposure</strong>
                      </Link>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>

            <section>
              <span>RIVAL TRANSFER VECTORS</span>
              <div className="counterplay-vectors">
                {counterPlay.rival_vectors.map((rival) => (
                  <article key={rival.entry_id}>
                    <header>
                      <b>{rival.name}</b>
                      <small>
                        gap {rival.gap >= 0 ? "+" : ""}{rival.gap} · £{rival.bank.toFixed(1)}m bank ·{" "}
                        {rival.estimated_free_transfers == null
                          ? "FT unknown"
                          : rival.estimated_free_transfers + "/5 FT"}
                      </small>
                    </header>
                    <small className="counterplay-rival-meta">
                      {rival.activity ?? "resource style unknown"} ·{" "}
                      {rival.remaining_chips.length
                        ? rival.remaining_chips.join(", ") + " available"
                        : "no tracked chips remaining in current half"}
                    </small>
                    {rival.transfer_vectors.length ? (
                      rival.transfer_vectors.map((vector, vectorIndex) => (
                        <p key={rival.entry_id + "-" + vectorIndex}>
                          {vector.label} ·{" "}
                          <b>{(vector.model_share * 100).toFixed(0)}% relative response weight</b>
                        </p>
                      ))
                    ) : (
                      <p>No current response vector is available.</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>

          <details className="counterplay-caveats" open>
            <summary>Simulation assumptions & limitations</summary>
            {counterPlay.caveats.map((item, index) => (
              <p key={"counter-caveat-" + index}>{item}</p>
            ))}
          </details>
        </section>
      ) : null}

      {decisionQuality ? (
        <section className="team-room-block decision-quality-panel">
          <div className="team-room-block-head">
            <div>
              <span>DECISION QUALITY</span>
              <h2>
                {decisionQuality.status === "ACTIVE"
                  ? decisionQuality.summary?.deadlines + " tracked deadline" +
                    (decisionQuality.summary?.deadlines === 1 ? "" : "s")
                  : decisionQuality.status === "ACCUMULATING"
                    ? "Building the clean history"
                    : "Audit temporarily unavailable"}
              </h2>
            </div>
            <small>Process EV and outcome variance are scored separately</small>
          </div>

          {decisionQuality.status === "ACTIVE" && decisionQuality.summary ? (
            <>
              <div className="decision-quality-grid">
                <div>
                  <span>CAPTAIN PROCESS</span>
                  <strong>
                    {(decisionQuality.summary.captain_process_alignment * 100).toFixed(0)}%
                  </strong>
                  <small>model-aligned / close-call deadlines</small>
                </div>
                <div>
                  <span>HIT COST</span>
                  <strong>-{decisionQuality.summary.total_hit_cost}</strong>
                  <small>tracked transfer points spent</small>
                </div>
                <div>
                  <span>BENCH LEAKAGE</span>
                  <strong>{decisionQuality.summary.average_bench_points.toFixed(1)}</strong>
                  <small>average actual bench points</small>
                </div>
                <div>
                  <span>BAD VARIANCE</span>
                  <strong>{decisionQuality.summary.negative_variance_deadlines}</strong>
                  <small>captain outcomes ≥2 below deadline expectation</small>
                </div>
              </div>

              <div className="decision-quality-observations">
                <span>WHAT THE SAMPLE ACTUALLY SAYS</span>
                {decisionQuality.summary.observations.map((item, index) => (
                  <p key={"decision-observation-" + index}>{item}</p>
                ))}
              </div>

              <div className="decision-quality-history">
                {decisionQuality.completed.map((item) => (
                  <article key={item.event}>
                    <header>
                      <b>GW{item.event}</b>
                      <small>{item.battle_mode ?? "—"} · {item.model_version ?? "model receipt"}</small>
                    </header>
                    <div>
                      <span>Captain process</span>
                      <strong>{item.captain.process.replaceAll("_", " ")}</strong>
                      <small>
                        {item.captain.model_player_name
                          ? "Model: " + item.captain.model_player_name
                          : "No comparable captain receipt"}
                      </small>
                    </div>
                    <div>
                      <span>Captain variance</span>
                      <strong>
                        {item.captain.actual_vs_model_expectation == null
                          ? "—"
                          : (item.captain.actual_vs_model_expectation >= 0 ? "+" : "") +
                            item.captain.actual_vs_model_expectation.toFixed(1)}
                      </strong>
                      <small>actual raw points vs deadline expectation</small>
                    </div>
                    <div>
                      <span>Transfer process</span>
                      <strong>{item.transfers.process.replaceAll("_", " ")}</strong>
                      <small>
                        {item.transfers.hit_cost
                          ? "-" + item.transfers.hit_cost + " hit"
                          : "no hit cost"}
                      </small>
                    </div>
                    <div>
                      <span>Bench</span>
                      <strong>{item.bench_points}</strong>
                      <small>actual points left on bench</small>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="decision-quality-empty">
              <strong>
                Footy started storing genuine pre-deadline decision receipts in GW
                {decisionQuality.tracked_from_event}.
              </strong>
              <p>
                Earlier Gameweeks are deliberately not reconstructed with hindsight. Once the
                first tracked deadline is complete, this section will compare what the model knew
                then with the manager’s actual choice and eventual outcome.
              </p>
            </div>
          )}

          <p className="decision-quality-caveat">{decisionQuality.caveat}</p>
        </section>
      ) : null}

      <section className="team-room-scoreboard">
        <div>
          <span>SQUAD RATING</span>
          <strong>{squadNow ?? "—"}</strong>
          <small>
            {squadNow != null ? ratingBand(squadNow) + " · squad percentile model" : "Loading"}
          </small>
        </div>
        <div>
          <span>6GW RATING</span>
          <strong>{squadFuture ?? "—"}</strong>
          <small>
            {squadFuture != null
              ? ratingBand(squadFuture) + " · six-Gameweek process + fixtures"
              : "Loading"}
          </small>
        </div>
        <div>
          <span>LEAGUE RANK</span>
          <strong>#{leagueRank ?? "—"}</strong>
          <small>{leagueName}</small>
        </div>
        <div>
          <span>NEXT ACTION</span>
          <strong>
            {intelligenceLoading
              ? "CHECKING"
              : portfolioPlan?.action.replaceAll("_", " ") ??
                (transfer ? "MOVE" : "HOLD")}
          </strong>
          <small>
            {intelligenceLoading
              ? "Building recommendation"
              : portfolioPlan?.headline ??
                (transfer
                  ? transfer.out.name + " → " + transfer.in.name
                  : "No move clears threshold")}
          </small>
        </div>
      </section>

      <section className="team-room-block">
        <div className="team-room-block-head">
          <div>
            <span>SQUAD</span>
            <h2>Current team + player ratings</h2>
          </div>
          <small>
            Tap any player for EPA, fixtures, risks and source detail ·{" "}
            <Link href="/research#players">research every player →</Link>
          </small>
        </div>

        <div className="team-room-player-table">
          {squadRatings.map(
            ({ pick, profile, now, future }) => (
              <button
                type="button"
                key={pick.id}
                className="team-room-player-row"
                onClick={() => {
                  setSelectedTeam(null);
                  setSelectedPlayer(profile);
                }}
                aria-label={"Open " + pick.name + " player profile"}
              >
                <div className="team-room-player-name">
                  <strong>{pick.name}</strong>
                  <small>
                    {pick.team} · {pick.position} · £
                    {pick.price.toFixed(1)}m
                  </small>
                  <em>{profile.reasons[0] ?? "Role, process and fixtures drive the rating."}</em>
                </div>
                <div>
                  <span>Now</span>
                  <b>{now}</b>
                  <small>{ratingBand(now)}</small>
                </div>
                <div>
                  <span>6GW</span>
                  <b>{future}</b>
                  <small>
                    {profile.bestWindow.startName}–
                    {profile.bestWindow.endName}
                  </small>
                </div>
                <div>
                  <span>EPA</span>
                  <b>
                    {profile.epa.epa >= 0 ? "+" : ""}
                    {profile.epa.epa.toFixed(2)}
                  </b>
                  <small>
                    {profile.epa.undervalued
                      ? "Undervalued"
                      : profile.player.selectedBy.toFixed(1) +
                        "% owned"}
                  </small>
                </div>
                <div>
                  <span>Available</span>
                  <b>{profile.player.availability}%</b>
                  <small>
                    {profile.player.news ||
                      "No current blocker"}
                  </small>
                </div>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="team-room-block">
        <div className="team-room-block-head">
          <div>
            <span>OPPONENT RESOURCES</span>
            <h2>Chips, transfers and behaviour</h2>
          </div>
          <small>Public FPL history only · tap any manager for the full dossier</small>
        </div>

        <div className="team-room-rivals">
          {resourceRows.slice(0, 6).map(
            ({ standing, history }) => (
              <button
                type="button"
                key={standing.entry_id}
                className={
                  standing.entry_id === teamId ? "you" : ""
                }
                onClick={() => setSelectedManager(standing)}
                aria-label={"Open " + standing.entry_name + " opposition profile"}
              >
                <div>
                  <strong>{standing.entry_name}</strong>
                  <small>
                    #{standing.rank} · {history.activity}
                  </small>
                </div>
                <div>
                  <span>FT est.</span>
                  <b>{history.estimatedFreeTransfers}</b>
                </div>
                <div>
                  <span>Hits</span>
                  <b>-{history.totalHitCost}</b>
                </div>
                <div>
                  <span>Chips left</span>
                  <b>{history.currentHalfRemaining.length}</b>
                </div>
              </button>
            ),
          )}
        </div>
        <Link
          className="team-room-deep-link"
          href={"/league/" + leagueId + "?team=" + teamId}
        >
          View every league manager & full standings →
        </Link>
      </section>

      <section className="team-room-next">
        <div>
          <span>NEXT</span>
          <h2>
            Use Footy’s suggestion or build your own.
          </h2>
          <p>
            Preview starts with your current squad. You can
            follow Footy’s route, ignore it, or make your own
            transfers while keeping the same player, fixture and
            mini-league intelligence visible.
          </p>
        </div>
        <Link
          href={
            "/team/" +
            teamId +
            "/preview?league=" +
            leagueId
          }
        >
          Open Preview →
        </Link>
      </section>

      <PlayerIntelDrawer
        profile={selectedPlayer}
        teams={scout?.teams ?? []}
        onClose={() => setSelectedPlayer(null)}
        onOpenTeam={(club) => {
          setSelectedPlayer(null);
          setSelectedTeam(club);
        }}
      />
      <TeamIntelDrawer
        team={selectedTeam}
        players={scout?.players ?? []}
        onClose={() => setSelectedTeam(null)}
        onOpenPlayer={(profile) => {
          setSelectedTeam(null);
          setSelectedPlayer(profile);
        }}
      />
      <ManagerIntelDrawer
        leagueId={leagueId}
        standing={selectedManager}
        onClose={() => setSelectedManager(null)}
      />
    </div>
  );
}
