"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Player = {
  id: number;
  name: string;
  team: string;
  opponent: string | null;
  assistantScore: number;
  processBoost?: number;
  availability?: number;
  form?: number;
  xgiPer90?: number;
};

type Strategy = {
  mode: "PROTECT" | "CHASE" | "RECOVER";
  gap_to_leader: number;
  rival_name: string | null;
  captain_moves: Array<{
    player: Player;
    league_score: number;
    rationale: string;
  }>;
  transfer_moves: Array<{
    out: Player;
    in: Player;
    raw_gain: number;
    league_score: number;
    rival_owns?: boolean;
    process_adjustment?: number;
    rationale: string;
  }>;
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

type Payload = {
  decision_path?: DecisionPath;
  manager_standing?: {
    rank: number | null;
    total: number | null;
    entry_name: string;
  };
  rival_standing?: {
    rank: number | null;
    total: number | null;
    entry_name: string;
  } | null;
  league_strategy?: Strategy;
  resource_advice?: ResourceAdvice | null;
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

  const target =
    strategy.rival_name ??
    (strategy.mode === "PROTECT" ? "the manager behind you" : "the manager above you");

  const postureCopy =
    strategy.mode === "PROTECT"
      ? "protect your lead"
      : strategy.mode === "CHASE"
        ? "close the gap"
        : "make up ground";

  const modeLabel =
    strategy.mode === "PROTECT"
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
      ? "Preserve your resource edge."
      : resources?.status === "THREAT"
        ? "Avoid a speculative hit and keep flexibility."
        : "Let the player edge drive the move.";

  const decisionSentence = transfer
    ? `To ${postureCopy} on ${target}, sell ${transfer.out.name} for ${transfer.in.name}${captain ? `, captain ${captain.player.name}` : ""}. ${resourceInstruction}`
    : `To ${postureCopy} on ${target}, hold the transfer${captain ? ` and captain ${captain.player.name}` : ""}. ${resourceInstruction}`;

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

  const managerStanding = payload?.manager_standing;
  const rivalStanding = payload?.rival_standing;
  const rankLabel =
    managerStanding?.rank != null ? `#${managerStanding.rank}` : "—";
  const rivalRankLabel =
    rivalStanding?.rank != null ? `#${rivalStanding.rank}` : "—";
  const directGap =
    managerStanding?.total != null && rivalStanding?.total != null
      ? rivalStanding.total - managerStanding.total
      : null;

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

      <div className="minimal-position">
        <div>
          <span>You</span>
          <strong>{rankLabel}</strong>
        </div>
        <div className="minimal-position-arrow">→</div>
        <div>
          <span>Target</span>
          <strong>{target}</strong>
          <small>
            {rivalRankLabel}
            {directGap != null
              ? directGap > 0
                ? ` · ${directGap} pts ahead`
                : directGap < 0
                  ? ` · ${Math.abs(directGap)} pts behind`
                  : " · level on points"
              : ""}
          </small>
        </div>
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
              ? "Strongest model-backed upgrade"
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
            <span>Model</span>
            <strong>
              {transfer
                ? `${transfer.in.name} +${scoreDelta.toFixed(1)} vs ${transfer.out.name}`
                : "Current squad still grades best"}
            </strong>
            <small>
              {transfer
                ? "The incoming player improves Footy's expected-output score."
                : "No available replacement improves the model enough to justify using a transfer."}
            </small>
          </div>

          <div className="evidence-row">
            <span>Underlying</span>
            <strong>
              {transfer
                ? `xGI/90 ${incomingXgi.toFixed(2)} vs ${outgoingXgi.toFixed(2)} · form ${incomingForm.toFixed(1)} vs ${outgoingForm.toFixed(1)}`
                : "No strong underlying upgrade"}
            </strong>
            <small>
              {transfer
                ? `${transfer.in.team} process ${transferProcess >= 0 ? "+" : ""}${(
                    transferProcess * 100
                  ).toFixed(0)}% · ${transfer.in.opponent ? `next vs ${transfer.in.opponent} · ` : ""}${transferAvailability}% availability`
                : "The current alternatives do not create a strong enough process, fixture or player-level edge."}
            </small>
          </div>

          <div className="evidence-row">
            <span>League</span>
            <strong>
              {transfer
                ? transfer.rival_owns
                  ? `Cover ${target}`
                  : `Create separation from ${target}`
                : resources?.status ?? "Even"}
            </strong>
            <small>
              {resources
                ? `Free-transfer edge ${resources.free_transfer_edge >= 0 ? "+" : ""}${resources.free_transfer_edge}. ${resources.recommendation}`
                : "Footy uses rival ownership and resources only after the underlying player case is strong enough."}
            </small>
          </div>

          <div className="evidence-row">
            <span>Captain</span>
            <strong>{captain?.player.name ?? "No change"}</strong>
            <small>
              {captain
                ? `Footy score ${captain.player.assistantScore.toFixed(1)} · xGI/90 ${(captain.player.xgiPer90 ?? 0).toFixed(2)}${captain.player.opponent ? ` · vs ${captain.player.opponent}` : ""}`
                : "No captain signal is currently strong enough to surface."}
            </small>
          </div>
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
