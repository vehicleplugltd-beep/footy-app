
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FplPitchPlayer } from "@/lib/fpl-team";
import type {
  ScoutIntelligencePayload,
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
    : transfer
      ? transferInProfile?.decisionConfidence ?? "PENDING"
      : "THRESHOLD HOLD";
  const transferWhy =
    transfer?.rationale ??
    "No replacement currently clears Footy’s value, minutes and timing threshold.";
  const transferFailure =
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
    ? "Comparing squad quality, player process and league pressure."
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
                  : transfer
                    ? transfer.out.name +
                      " → " +
                      transfer.in.name
                    : "Hold the transfer"}
              </h2>
            </div>
          </div>

          <blockquote className="footy-quip compact">{actionQuip}</blockquote>
          <div className="team-room-suggestion">
            <div>
              <span>TRANSFER</span>
              <strong>
                {intelligenceLoading
                  ? "CHECKING"
                  : transfer
                    ? transfer.out.name +
                      " → " +
                      transfer.in.name
                    : "HOLD"}
              </strong>
              <small>
                {intelligenceLoading
                  ? "Comparing replacements against value, minutes and timing thresholds."
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
            {intelligenceLoading ? "CHECKING" : transfer ? "MOVE" : "HOLD"}
          </strong>
          <small>
            {intelligenceLoading
              ? "Building recommendation"
              : transfer
                ? transfer.out.name +
                  " → " +
                  transfer.in.name
                : "No move clears threshold"}
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
