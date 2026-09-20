"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Player = {
  id: number;
  name: string;
  team: string;
  teamName?: string;
  position?: string;
  opponent: string | null;
  opponentName?: string | null;
  assistantScore: number;
  expectedNext?: number;
  fixtureDifficulty?: number;
  processBoost?: number;
  processFactor?: number;
  fixtureFactor?: number;
  trendFactor?: number;
  availability?: number;
  form?: number;
  xgiPer90?: number;
  xgPer90?: number;
  xaPer90?: number;
  xgcPer90?: number;
  minutes?: number;
  starts?: number;
  news?: string;
  setPieceRole?: string | null;
  teamAttackIndex?: number;
  teamDefenceIndex?: number;
  selectedBy?: number;
  transfersNet?: number;
};

type Strategy = {
  mode: "PROTECT" | "CHASE" | "RECOVER";
  pressure_focus?: "PROTECT" | "BOTH_SIDES" | "CHASE_AND_PROTECT" | "CHASE";
  gap_to_leader: number;
  gap_above?: number | null;
  gap_below?: number | null;
  rival_name: string | null;
  target_name?: string | null;
  chaser_name?: string | null;
  captain_moves: Array<{
    player: Player;
    league_score: number;
    rival_owns?: boolean;
    chaser_owns?: boolean;
    rationale: string;
  }>;
  transfer_moves: Array<{
    out: Player;
    in: Player;
    raw_gain: number;
    minimum_gain?: number;
    horizon_gain?: number;
    timing?: "NOW" | "WAIT" | "HOLD";
    league_score: number;
    rival_owns?: boolean;
    chaser_owns?: boolean;
    process_adjustment?: number;
    rationale: string;
  }>;
  caveat?: string;
};

type ResourceAdvice = {
  status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
  chip_edge: string[];
  chip_threats: string[];
  free_transfer_edge: number;
  recommendation: string;
};

type DecisionPath = {
  now: {
    event_id: number | null;
    event_name: string;
    transfer: { out: Player; in: Player; gain: number } | null;
    captain: Player | null;
    instruction: string;
  };
  next: {
    event_id: number | null;
    event_name: string;
    transfer_watch: { out: Player; in: Player; gain: number } | null;
    captain_watch: Player | null;
    projected_free_transfers: number | null;
    instruction: string;
  };
  later: {
    event_name: string | null;
    chip: {
      chip: string;
      status: "STRONG" | "WATCH" | "HOLD";
      eventName: string | null;
      reason: string;
    } | null;
    instruction: string;
  };
  resources: {
    estimated_free_transfers_now: number | null;
    projected_free_transfers_next: number | null;
    confidence: "HIGH" | "MEDIUM" | null;
    league_status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
    note: string;
  };
  caveat: string;
};

type Standing = {
  entry_id?: number;
  rank: number | null;
  total: number | null;
  entry_name: string;
  gap?: number | null;
};

type TeamProcess = {
  team: string;
  matches: number;
  attackIndex: number;
  defenceIndex: number;
  attackTrend: number;
  defenceTrend: number;
  sourceConfidence: number;
  metrics: {
    xg: number;
    npxg: number;
    xga: number;
    npxga: number;
    shots: number;
    shotsOnTarget: number;
    shotsConceded: number;
    sotConceded: number;
    bigChances: number;
    bigChancesConceded: number;
    boxTouches: number;
    keyPasses: number;
    xa: number;
    setPieceXg: number;
    setPieceXga: number;
    possession: number;
    ppda: number;
    fieldTilt: number;
    deepCompletions: number;
  };
};

type WeakLink = {
  player: Player;
  replacement: Player | null;
  reason: string;
  gain: number;
  minimumGain: number;
  horizonGain: number;
  timing: "NOW" | "WAIT" | "HOLD";
};

type Payload = {
  decision_path?: DecisionPath;
  manager_standing?: Standing;
  rival_standing?: Standing | null;
  target_standing?: Standing | null;
  chaser_standings?: Standing[];
  pressure_map?: {
    above: Standing[];
    below: Standing[];
    leader: Standing;
  };
  league_strategy?: Strategy;
  resource_advice?: ResourceAdvice | null;
  chaser_resource_advice?: ResourceAdvice | null;
  analysis?: {
    dataRetrievedAt?: string;
    nextEvent?: {
      id: number;
      name: string;
      deadline_time: string;
    } | null;
    freshness?: {
      source?: "LIVE_FPL" | "CACHED_FALLBACK";
    };
    manager?: {
      weakLinks?: WeakLink[];
    };
    teamProcesses?: TeamProcess[];
    dataCoverage?: {
      measured: string[];
      notMeasured: string[];
    };
  };
};

export function NextMoveCommand({
  teamId,
  leagueId,
  leagueName,
}: {
  teamId: number;
  leagueId?: number;
  leagueName?: string | null;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(Boolean(leagueId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/league/${leagueId}/manager/${teamId}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Footy could not build your next move.");
        }
        setPayload(body);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Footy could not build your next move.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [leagueId, teamId]);

  if (!leagueId) {
    return (
      <section className="shell next-move-command empty-command" id="next-move">
        <div className="next-move-kicker">
          <span>YOUR NEXT MOVE</span>
          <b>Pick a mini-league first</b>
        </div>
        <div className="next-move-empty-copy">
          <h2>Who are we trying to beat?</h2>
          <p>
            Choose one of your mini-leagues below. Footy will immediately identify
            the relevant rival, the points gap, their resources and the strongest
            move for your situation.
          </p>
        </div>
        <a className="next-move-primary" href="#leagues">
          Choose mini-league ↓
        </a>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="shell next-move-command loading-command" id="next-move">
        <div className="next-move-kicker">
          <span>YOUR NEXT MOVE</span>
          <b>{leagueName ?? "Selected mini-league"}</b>
        </div>
        <div className="next-move-loading">
          <strong>Reading your rivals, squad and resources…</strong>
          <span />
        </div>
      </section>
    );
  }

  const strategy = payload?.league_strategy;
  const resources = payload?.resource_advice;
  const transfer = strategy?.transfer_moves?.[0];
  const captain = strategy?.captain_moves?.[0];

  if (error || !strategy) {
    return (
      <section className="shell next-move-command error-command" id="next-move">
        <div className="next-move-kicker">
          <span>YOUR NEXT MOVE</span>
          <b>{leagueName ?? "Selected mini-league"}</b>
        </div>
        <div>
          <h2>League intelligence needs a refresh.</h2>
          <p>{error ?? "No recommendation is available yet."}</p>
        </div>
        <Link
          className="next-move-secondary"
          href={`/league/${leagueId}?team=${teamId}`}
        >
          Open league intelligence →
        </Link>
      </section>
    );
  }

  const pressure = payload?.pressure_map;
  const nearestAbove = pressure?.above?.[0] ?? payload?.target_standing ?? null;
  const nearestChaser =
    pressure?.below?.[0] ?? payload?.chaser_standings?.[0] ?? null;
  const target =
    strategy.target_name ??
    nearestAbove?.entry_name ??
    strategy.rival_name ??
    (strategy.mode === "PROTECT"
      ? "the manager behind you"
      : "the manager above you");

  const postureCopy =
    strategy.pressure_focus === "BOTH_SIDES"
      ? "move up without giving away your position"
      : strategy.pressure_focus === "CHASE_AND_PROTECT"
        ? "close the gap while protecting your place"
        : strategy.mode === "PROTECT"
          ? "protect your lead"
          : strategy.mode === "CHASE"
            ? "close the gap"
            : "make up ground";

  const modeLabel =
    strategy.pressure_focus === "BOTH_SIDES"
      ? "Pressure both sides"
      : strategy.pressure_focus === "CHASE_AND_PROTECT"
        ? "Chase + protect"
        : strategy.mode === "PROTECT"
          ? "Protect your lead"
          : strategy.mode === "CHASE"
            ? "Close the gap"
            : "Make up ground";

  const resourceLabel =
    resources?.status === "ADVANTAGE"
      ? "Your edge"
      : resources?.status === "THREAT"
        ? "Rival edge"
        : resources?.status === "UNKNOWN"
          ? "Unknown"
          : "Even";

  const resourceInstruction =
    resources?.status === "ADVANTAGE"
      ? "Keep the resource edge unless the football edge is strong."
      : resources?.status === "THREAT"
        ? "Avoid a speculative hit and keep flexibility."
        : "Let the football edge drive the move.";

  const gapAbove = strategy.gap_above;
  const gapBelow = strategy.gap_below;
  const pressureSentence =
    nearestAbove && nearestChaser
      ? `${gapAbove != null ? `${Math.abs(gapAbove)} pt${Math.abs(gapAbove) === 1 ? "" : "s"} to ${nearestAbove.entry_name}` : nearestAbove.entry_name}; ${gapBelow != null ? `${Math.abs(gapBelow)} pt${Math.abs(gapBelow) === 1 ? "" : "s"} clear of ${nearestChaser.entry_name}` : `${nearestChaser.entry_name} is chasing`}.`
      : nearestAbove && gapAbove != null
        ? `${Math.abs(gapAbove)} pt${Math.abs(gapAbove) === 1 ? "" : "s"} to ${nearestAbove.entry_name}.`
        : nearestChaser && gapBelow != null
          ? `${Math.abs(gapBelow)} pt${Math.abs(gapBelow) === 1 ? "" : "s"} clear of ${nearestChaser.entry_name}.`
          : "";

  const decisionSentence = transfer
    ? `To ${postureCopy}, sell ${transfer.out.name} for ${transfer.in.name}${captain ? `, captain ${captain.player.name}` : ""}. ${pressureSentence} ${resourceInstruction}`
    : `To ${postureCopy}, hold the transfer${captain ? ` and captain ${captain.player.name}` : ""}. ${pressureSentence} ${resourceInstruction}`;

  const transferProcess = transfer?.in.processBoost ?? 0;
  const transferAvailability = transfer?.in.availability ?? 100;
  const freshnessSource = payload?.analysis?.freshness?.source;
  const readiness =
    transfer && transferAvailability < 100
      ? "WAIT FOR NEWS"
      : freshnessSource === "CACHED_FALLBACK"
        ? "REFRESH BEFORE DEADLINE"
        : "READY";

  const nextEvent = payload?.analysis?.nextEvent;
  const deadline = nextEvent?.deadline_time ? new Date(nextEvent.deadline_time) : null;
  const deadlineLabel = deadline
    ? deadline.toLocaleString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const incomingXgi = transfer?.in.xgiPer90 ?? 0;
  const outgoingXgi = transfer?.out.xgiPer90 ?? 0;
  const incomingForm = transfer?.in.form ?? 0;
  const outgoingForm = transfer?.out.form ?? 0;
  const scoreDelta = transfer
    ? transfer.in.assistantScore - transfer.out.assistantScore
    : 0;
  const watchMove =
    payload?.analysis?.manager?.weakLinks?.find(
      (move) => move.timing === "WAIT" && move.replacement,
    ) ?? null;
  const alternatives = strategy.transfer_moves.slice(1);
  const incomingTeamProcess = transfer?.in.teamName
    ? payload?.analysis?.teamProcesses?.find(
        (process) => process.team === transfer.in.teamName,
      ) ?? null
    : null;
  const opponentProcess = transfer?.in.opponentName
    ? payload?.analysis?.teamProcesses?.find(
        (process) => process.team === transfer.in.opponentName,
      ) ?? null
    : null;

  const managerStanding = payload?.manager_standing;
  const rankLabel =
    managerStanding?.rank != null ? `#${managerStanding.rank}` : "—";

  return (
    <section className="shell next-move-command minimal-command" id="next-move">
      <div className="minimal-command-top">
        <div>
          <span className="minimal-label">
            ASSISTANT BRIEF · {nextEvent?.name ?? "TODAY"}
            {deadlineLabel ? ` · deadline ${deadlineLabel}` : ""}
          </span>
          <strong>{leagueName ?? "Selected mini-league"}</strong>
        </div>
        <div className="next-move-statuses">
          <div className={`decision-readiness readiness-${readiness
            .toLowerCase()
            .replaceAll(" ", "-")}`}>
            {readiness}
          </div>
          <div className={`next-move-mode mode-${strategy.mode.toLowerCase()}`}>
            {modeLabel}
          </div>
        </div>
      </div>

      <div className="pressure-band">
        <article>
          <span>AHEAD</span>
          <strong>{nearestAbove?.entry_name ?? "You lead this battle"}</strong>
          <small>
            {nearestAbove?.rank != null ? `#${nearestAbove.rank}` : ""}
            {gapAbove != null
              ? ` · ${Math.abs(gapAbove)} pt${Math.abs(gapAbove) === 1 ? "" : "s"} ahead`
              : ""}
          </small>
        </article>

        <article className="pressure-you">
          <span>YOU</span>
          <strong>{rankLabel}</strong>
          <small>{managerStanding?.entry_name ?? "Your team"}</small>
        </article>

        <article>
          <span>CHASING YOU</span>
          <strong>{nearestChaser?.entry_name ?? "No immediate chaser"}</strong>
          <small>
            {nearestChaser?.rank != null ? `#${nearestChaser.rank}` : ""}
            {gapBelow != null
              ? ` · ${Math.abs(gapBelow)} pt${Math.abs(gapBelow) === 1 ? "" : "s"} behind`
              : ""}
          </small>
        </article>
      </div>

      <div className="minimal-decision">
        <span>FOOTY SAYS</span>
        <h2>{decisionSentence}</h2>
      </div>

      <div className={`decision-watch watch-${readiness.toLowerCase().replaceAll(" ", "-")}`}>
        <span>{readiness === "READY" ? "Ready to act" : "Before you act"}</span>
        <strong>
          {readiness === "WAIT FOR NEWS"
            ? `${transfer?.in.name ?? "Recommended player"} is currently ${transferAvailability}% available. Recheck team news before the deadline.`
            : readiness === "REFRESH BEFORE DEADLINE"
              ? "The recommendation is using the latest saved FPL snapshot. Refresh close to the deadline before committing."
              : "No current availability or data-freshness blocker is changing the call."}
        </strong>
      </div>

      <div className="minimal-actions-grid">
        <article>
          <span>TRANSFER</span>
          <strong>
            {transfer ? `${transfer.out.name} → ${transfer.in.name}` : "HOLD"}
          </strong>
          <small>
            {transfer
              ? `+${transfer.raw_gain.toFixed(1)} now · threshold +${(transfer.minimum_gain ?? 0).toFixed(1)}`
              : watchMove?.replacement
                ? `Hold now · watch ${watchMove.replacement.name}`
                : "No move clears the threshold"}
          </small>
        </article>
        <article>
          <span>CAPTAIN</span>
          <strong>{captain?.player.name ?? "—"}</strong>
          <small>
            {captain?.player.opponent
              ? `vs ${captain.player.opponent}`
              : "Best current option"}
          </small>
        </article>
        <article>
          <span>RESOURCES</span>
          <strong>{resourceLabel}</strong>
          <small>
            {resources
              ? `FT edge ${resources.free_transfer_edge >= 0 ? "+" : ""}${resources.free_transfer_edge}`
              : "No meaningful edge detected"}
          </small>
        </article>
      </div>

      {payload?.decision_path ? (
        <section className="multi-gw-plan" aria-label="Multi-Gameweek plan">
          <div className="multi-gw-plan-head">
            <div>
              <span>PLAN AHEAD</span>
              <strong>Your assistant plan: act where the edge is real, keep flexibility where it isn’t.</strong>
            </div>
            {payload.decision_path.resources.estimated_free_transfers_now != null ? (
              <small>
                FT {payload.decision_path.resources.estimated_free_transfers_now}
                {" → "}
                {payload.decision_path.resources.projected_free_transfers_next ?? "—"}
                {" next GW"}
              </small>
            ) : null}
          </div>

          <div className="multi-gw-plan-rows">
            <article>
              <span>NOW · {payload.decision_path.now.event_name}</span>
              <strong>{payload.decision_path.now.instruction}</strong>
              <small>
                {payload.decision_path.now.transfer
                  ? `Model gain +${payload.decision_path.now.transfer.gain.toFixed(1)}`
                  : "Bank the transfer if nothing changes before deadline."}
              </small>
            </article>

            <article>
              <span>NEXT · {payload.decision_path.next.event_name}</span>
              <strong>{payload.decision_path.next.instruction}</strong>
              <small>
                {payload.decision_path.next.captain_watch
                  ? `Captain watch: ${payload.decision_path.next.captain_watch.name}`
                  : "Captaincy will be re-run with fresh data."}
                {payload.decision_path.next.projected_free_transfers != null
                  ? ` · projected ${payload.decision_path.next.projected_free_transfers} FT`
                  : ""}
              </small>
            </article>

            <article>
              <span>LATER{payload.decision_path.later.event_name ? ` · ${payload.decision_path.later.event_name}` : ""}</span>
              <strong>{payload.decision_path.later.instruction}</strong>
              <small>
                {payload.decision_path.later.chip?.reason ??
                  "No chip window currently clears Footy's deployment threshold."}
              </small>
            </article>
          </div>

          <p className="multi-gw-caveat">{payload.decision_path.caveat}</p>
        </section>
      ) : null}

      <details className="minimal-why">
        <summary>Why this decision?</summary>
        <div className="minimal-evidence-list">
          <div className="evidence-row">
            <span>Decision threshold</span>
            <strong>
              {transfer
                ? `+${transfer.raw_gain.toFixed(1)} now · +${(transfer.horizon_gain ?? 0).toFixed(1)} 4GW · +${(transfer.minimum_gain ?? 0).toFixed(1)} required`
                : watchMove?.replacement
                  ? `${watchMove.replacement.name}: +${watchMove.gain.toFixed(1)} now · +${watchMove.horizonGain.toFixed(1)} 4GW`
                  : "HOLD"}
            </strong>
            <small>
              {transfer
                ? "This move clears both the immediate edge and the value of keeping a free transfer."
                : watchMove?.replacement
                  ? `The longer-term idea is interesting, but it does not clear the +${watchMove.minimumGain.toFixed(1)} act-now threshold. Waiting preserves flexibility.`
                  : "No same-position alternative is strong enough after fixture, process, availability and transfer-value adjustments."}
            </small>
          </div>

          <div className="evidence-row">
            <span>Player process</span>
            <strong>
              {transfer
                ? `xG/90 ${(transfer.in.xgPer90 ?? 0).toFixed(2)} · xA/90 ${(transfer.in.xaPer90 ?? 0).toFixed(2)} · xGI/90 ${incomingXgi.toFixed(2)}`
                : watchMove?.replacement
                  ? `Watch: ${watchMove.replacement.name} · xGI/90 ${(watchMove.replacement.xgiPer90 ?? 0).toFixed(2)}`
                  : "No player edge strong enough"}
            </strong>
            <small>
              {transfer
                ? `${transfer.in.starts ?? "—"} starts · ${transfer.in.minutes ?? "—"} mins${transfer.in.setPieceRole ? ` · ${transfer.in.setPieceRole}` : ""} · form ${incomingForm.toFixed(1)} vs ${outgoingForm.toFixed(1)}`
                : "Footy regresses small-sample per-90 numbers before using them."}
            </small>
          </div>

          <div className="evidence-row">
            <span>Team process</span>
            <strong>
              {incomingTeamProcess
                ? `${incomingTeamProcess.team}: npxG ${incomingTeamProcess.metrics.npxg.toFixed(2)} · npxGA ${incomingTeamProcess.metrics.npxga.toFixed(2)} · SOT ${incomingTeamProcess.metrics.shotsOnTarget.toFixed(1)}`
                : transfer
                  ? `${transfer.in.teamName ?? transfer.in.team} attack index ${(transfer.in.teamAttackIndex ?? 1).toFixed(2)} · defence ${(transfer.in.teamDefenceIndex ?? 1).toFixed(2)}`
                  : "Current team process retained"}
            </strong>
            <small>
              {incomingTeamProcess
                ? `xG ${incomingTeamProcess.metrics.xg.toFixed(2)} · xGA ${incomingTeamProcess.metrics.xga.toFixed(2)} · set-piece xG ${incomingTeamProcess.metrics.setPieceXg.toFixed(2)} · recent attack trend ${incomingTeamProcess.attackTrend >= 0 ? "+" : ""}${(incomingTeamProcess.attackTrend * 100).toFixed(0)}% · source confidence ${(incomingTeamProcess.sourceConfidence * 100).toFixed(0)}%`
                : "Team-process detail appears when the source feed can be reconciled to the selected player."}
            </small>
          </div>

          <div className="evidence-row">
            <span>Matchup</span>
            <strong>
              {transfer
                ? `${transfer.in.team} vs ${transfer.in.opponent ?? "—"} · FDR ${transfer.in.fixtureDifficulty ?? "—"}`
                : "No transfer matchup needed"}
            </strong>
            <small>
              {transfer
                ? `Fixture factor ${(transfer.in.fixtureFactor ?? 1).toFixed(2)} · opponent/process factor ${(transfer.in.processFactor ?? 1).toFixed(2)} · team trend factor ${(transfer.in.trendFactor ?? 1).toFixed(2)}${opponentProcess ? ` · opponent xG ${opponentProcess.metrics.xg.toFixed(2)} / npxG ${opponentProcess.metrics.npxg.toFixed(2)}` : ""}`
                : watchMove?.replacement
                  ? `The watchlist move is being delayed because the immediate matchup/value is weaker than the later horizon.`
                  : "Footy is preserving the transfer rather than forcing a marginal matchup."}
            </small>
          </div>

          <div className="evidence-row">
            <span>League pressure</span>
            <strong>
              {nearestAbove && nearestChaser
                ? `Catch ${nearestAbove.entry_name} · protect from ${nearestChaser.entry_name}`
                : nearestAbove
                  ? `Catch ${nearestAbove.entry_name}`
                  : nearestChaser
                    ? `Protect from ${nearestChaser.entry_name}`
                    : "No immediate pressure"}
            </strong>
            <small>
              {transfer
                ? `${transfer.rival_owns ? "Target owns incoming player" : "Incoming player creates target separation"}${transfer.chaser_owns ? " · nearest chaser owns him, so the move also covers that threat" : ""}. ${resources?.recommendation ?? ""}`
                : resources?.recommendation ??
                  "League context only adjusts a move after the football edge clears the threshold."}
            </small>
          </div>

          <div className="evidence-row">
            <span>Captain</span>
            <strong>{captain?.player.name ?? "No change"}</strong>
            <small>
              {captain
                ? `Footy score ${captain.player.assistantScore.toFixed(1)} · xGI/90 ${(captain.player.xgiPer90 ?? 0).toFixed(2)}${captain.player.opponent ? ` · vs ${captain.player.opponent}` : ""}. ${captain.rationale}`
                : "No captain signal is currently strong enough to surface."}
            </small>
          </div>

          {alternatives.length ? (
            <div className="evidence-row">
              <span>Other options</span>
              <strong>
                {alternatives
                  .map((move) => `${move.out.name} → ${move.in.name}`)
                  .join(" · ")}
              </strong>
              <small>
                These also clear the football threshold but rank below the primary move after expected gain and league context.
              </small>
            </div>
          ) : null}

          <details className="analysis-scope">
            <summary>What data did Footy check?</summary>
            <div>
              <p>
                {(payload?.analysis?.dataCoverage?.measured ?? []).join(" · ") ||
                  "Official FPL player data, fixtures and Footy team-process data."}
              </p>
              <p>
                <b>Not measured:</b>{" "}
                {(payload?.analysis?.dataCoverage?.notMeasured ?? []).join(" · ") ||
                  "Unavailable tactical metrics are excluded rather than invented."}
              </p>
              {pressure?.below?.length && pressure.below.length > 1 ? (
                <p>
                  <b>Other chasers:</b>{" "}
                  {pressure.below
                    .slice(1)
                    .map(
                      (standing) =>
                        `${standing.entry_name} (#${standing.rank ?? "—"} · ${standing.gap ?? "—"} pts behind)`,
                    )
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </details>
        </div>
      </details>

      <div className="minimal-command-actions">
        <Link
          className="next-move-primary"
          href={`/team/${teamId}?league=${leagueId}#build-test`}
        >
          Test this move
        </Link>
        <Link
          className="minimal-detail-link"
          href={`/league/${leagueId}?team=${teamId}`}
        >
          Full league detail →
        </Link>
        <small>
          {payload?.analysis?.freshness?.source === "LIVE_FPL"
            ? "Live FPL data"
            : "Latest available FPL snapshot"}
          {payload?.analysis?.dataRetrievedAt
            ? ` · ${new Date(
                payload.analysis.dataRetrievedAt,
              ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </small>
      </div>
    </section>
  );
}
