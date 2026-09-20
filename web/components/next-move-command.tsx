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

  return (
    <section className="shell next-move-command" id="next-move">
      <div className="next-move-head">
        <div className="next-move-kicker">
          <span>YOUR NEXT MOVE</span>
          <b>{leagueName ?? "Selected mini-league"}</b>
        </div>
        <div className={`next-move-mode mode-${strategy.mode.toLowerCase()}`}>
          {strategy.mode}
        </div>
      </div>

      <div className="decision-sentence">
        <span>FOOTY SAYS</span>
        <strong>{decisionSentence}</strong>
      </div>

      <div className="decision-proof-row">
        <article>
          <span>MODEL EDGE</span>
          <strong>
            {transfer ? `+${transfer.raw_gain.toFixed(1)}` : "HOLD"}
          </strong>
          <small>
            {transfer
              ? "Projected squad improvement"
              : "No transfer clears the threshold"}
          </small>
        </article>
        <article>
          <span>UNDERLYING PROCESS</span>
          <strong>
            {transfer
              ? `${transferProcess >= 0 ? "+" : ""}${(
                  transferProcess * 100
                ).toFixed(0)}%`
              : "—"}
          </strong>
          <small>
            {transfer
              ? `${transfer.in.team} process adjustment · ${transferAvailability}% availability`
              : "No move required"}
          </small>
        </article>
        <article>
          <span>RIVAL CONTEXT</span>
          <strong>
            {transfer
              ? transfer.rival_owns
                ? "COVER"
                : "SEPARATE"
              : resources?.status ?? "EVEN"}
          </strong>
          <small>
            {transfer
              ? transfer.rival_owns
                ? `${target} already owns ${transfer.in.name}`
                : `${transfer.in.name} creates separation from ${target}`
              : "League resources decide the posture"}
          </small>
        </article>
      </div>

      <div className="next-move-main">
        <div className="beat-target">
          <span>WHO YOU NEED TO BEAT</span>
          <strong>{target}</strong>
          <small>
            {strategy.gap_to_leader > 0
              ? `${strategy.gap_to_leader} pts to the league leader`
              : "You are currently setting the target"}
          </small>
        </div>

        <article className="next-move-action primary-action">
          <span>BEST TRANSFER</span>
          {transfer ? (
            <>
              <strong>
                {transfer.out.name} <i>→</i> {transfer.in.name}
              </strong>
              <p>{transfer.rationale}</p>
              <small>
                Model gain +{transfer.raw_gain.toFixed(1)}
                {transfer.in.opponent ? ` · next vs ${transfer.in.opponent}` : ""}
              </small>
            </>
          ) : (
            <>
              <strong>HOLD</strong>
              <p>No transfer currently clears Footy&apos;s model threshold.</p>
            </>
          )}
        </article>

        <article className="next-move-action">
          <span>CAPTAIN</span>
          {captain ? (
            <>
              <strong>{captain.player.name}</strong>
              <p>{captain.rationale}</p>
              <small>
                Footy score {captain.player.assistantScore.toFixed(1)}
                {captain.player.opponent
                  ? ` · vs ${captain.player.opponent}`
                  : ""}
              </small>
            </>
          ) : (
            <strong>—</strong>
          )}
        </article>

        <article className="next-move-action resource-action">
          <span>RIVAL RESOURCES</span>
          <strong>{resources?.status ?? "CHECKING"}</strong>
          <p>
            {resources?.recommendation ??
              "Footy is comparing chips, hits and likely free-transfer banks."}
          </p>
          {resources ? (
            <small>
              FT edge {resources.free_transfer_edge >= 0 ? "+" : ""}
              {resources.free_transfer_edge}
              {resources.chip_edge.length
                ? ` · your chip edge: ${resources.chip_edge.join(", ")}`
                : ""}
              {resources.chip_threats.length
                ? ` · rival edge: ${resources.chip_threats.join(", ")}`
                : ""}
            </small>
          ) : null}
        </article>
      </div>

      <div className="next-move-actions">
        <Link
          className="next-move-primary"
          href={`/team/${teamId}?league=${leagueId}#build-test`}
        >
          Build &amp; test this move
        </Link>
        <Link
          className="next-move-secondary"
          href={`/league/${leagueId}?team=${teamId}`}
        >
          Why Footy thinks this
        </Link>
        <small>
          {payload?.analysis?.freshness?.source === "LIVE_FPL"
            ? "Live FPL data"
            : "Latest available FPL snapshot"}
          {payload?.analysis?.dataRetrievedAt
            ? ` · updated ${new Date(
                payload.analysis.dataRetrievedAt,
              ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </small>
      </div>
    </section>
  );
}
