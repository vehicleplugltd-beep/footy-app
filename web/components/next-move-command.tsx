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

type Payload = {
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
          <span className="minimal-label">TODAY</span>
          <strong>{leagueName ?? "Selected mini-league"}</strong>
        </div>
        <div className="next-move-statuses">
          <div className={`decision-readiness readiness-${readiness
            .toLowerCase()
            .replaceAll(" ", "-")}`}>
            {readiness}
          </div>
          <div className={`next-move-mode mode-${strategy.mode.toLowerCase()}`}>
            {strategy.mode}
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

      <div className="minimal-actions-grid">
        <article>
          <span>TRANSFER</span>
          <strong>
            {transfer ? `${transfer.out.name} → ${transfer.in.name}` : "HOLD"}
          </strong>
          <small>
            {transfer
              ? `+${transfer.raw_gain.toFixed(1)} model gain`
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
          <strong>{resources?.status ?? "EVEN"}</strong>
          <small>
            {resources
              ? `FT edge ${resources.free_transfer_edge >= 0 ? "+" : ""}${resources.free_transfer_edge}`
              : "No meaningful edge detected"}
          </small>
        </article>
      </div>

      <details className="minimal-why">
        <summary>Why this decision?</summary>
        <div className="minimal-proof">
          <article>
            <span>MODEL</span>
            <strong>
              {transfer ? `+${transfer.raw_gain.toFixed(1)}` : "HOLD"}
            </strong>
            <p>
              {transfer
                ? "Footy rates the incoming player as the stronger expected-output option."
                : "The current squad grades better than the available transfer alternatives."}
            </p>
          </article>
          <article>
            <span>UNDERLYING DATA</span>
            <strong>
              {transfer
                ? `${transferProcess >= 0 ? "+" : ""}${(
                    transferProcess * 100
                  ).toFixed(0)}% process`
                : "No forced move"}
            </strong>
            <p>
              {transfer
                ? `${transfer.in.team} process, fixture and ${transferAvailability}% availability support the call.`
                : "No underlying-process signal is strong enough to justify a transfer."}
            </p>
          </article>
          <article>
            <span>MINI-LEAGUE</span>
            <strong>
              {transfer
                ? transfer.rival_owns
                  ? "Cover"
                  : "Separation"
                : resources?.status ?? "Even"}
            </strong>
            <p>
              {resources?.recommendation ??
                "Footy adjusts strong player calls using rival ownership, chips and free-transfer flexibility."}
            </p>
          </article>
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
          className="next-move-secondary"
          href={`/league/${leagueId}?team=${teamId}`}
        >
          Full league detail
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
