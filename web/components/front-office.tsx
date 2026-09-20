
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FplTeamDiscovery } from "@/lib/fpl-team";
import type {
  ScoutIntelligencePayload,
  ScoutPlayerProfile,
  ScoutTeamProfile,
} from "@/lib/fpl";
import {
  PlayerIntelDrawer,
  TeamIntelDrawer,
} from "@/components/intelligence-drawers";
import { footyQuip } from "@/lib/footy-voice";

function statusLabel(profile: ScoutPlayerProfile) {
  if (profile.epa.undervalued) return "UNDERVALUED";
  if (profile.status === "BUY_NOW") return "BUY NOW";
  if (profile.status === "FUTURE_TARGET") return "FUTURE";
  return "WATCH";
}

function PlayerRow({
  profile,
  onOpen,
}: {
  profile: ScoutPlayerProfile;
  onOpen: (profile: ScoutPlayerProfile) => void;
}) {
  return (
    <button
      type="button"
      className="hq-player-row"
      onClick={() => onOpen(profile)}
      aria-label={"Open " + profile.player.name + " profile"}
    >
      <div className="hq-player-name">
        <span>{statusLabel(profile)}</span>
        <strong>{profile.player.name}</strong>
        <small>
          {profile.player.team} · {profile.player.position} · £
          {profile.player.price.toFixed(1)}m
        </small>
      </div>
      <div>
        <b>{profile.player.totalPoints} pts</b>
        <small>{profile.player.selectedBy.toFixed(1)}% owned</small>
      </div>
      <div>
        <b>{profile.score6.toFixed(1)}</b>
        <small>6GW</small>
      </div>
      <div>
        <b>
          {profile.epa.epa >= 0 ? "+" : ""}
          {profile.epa.epa.toFixed(2)}
        </b>
        <small>EPA</small>
      </div>
    </button>
  );
}

export function FrontOffice({
  team,
}: {
  team?: FplTeamDiscovery | null;
}) {
  const [data, setData] = useState<ScoutIntelligencePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] =
    useState<ScoutPlayerProfile | null>(null);
  const [selectedTeam, setSelectedTeam] =
    useState<ScoutTeamProfile | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch("/api/scout", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || "Scout data unavailable.");
        }
        setData(body as ScoutIntelligencePayload);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Scout data unavailable.",
        );
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  const essentials = useMemo(() => {
    if (!data) return [];
    return [...data.players]
      .filter(
        (profile) =>
          profile.player.availability >= 75 &&
          profile.player.startReliability >= 0.9,
      )
      .sort(
        (a, b) =>
          b.score6 - a.score6 ||
          b.player.assistantScore - a.player.assistantScore,
      )
      .slice(0, 4);
  }, [data]);

  const watchlist = useMemo(() => {
    if (!data) return [];
    return data.picks
      .filter(
        (profile) =>
          profile.status === "WATCH" ||
          profile.status === "FUTURE_TARGET",
      )
      .slice(0, 4);
  }, [data]);

  const transfers = useMemo(() => {
    if (!data) return [];
    const ids = new Set<number>();
    const output: ScoutPlayerProfile[] = [];

    for (const profile of [
      ...data.undervalued,
      ...data.picks.filter((item) => item.status === "BUY_NOW"),
    ]) {
      if (ids.has(profile.player.id)) continue;
      ids.add(profile.player.id);
      output.push(profile);
      if (output.length === 4) break;
    }
    return output;
  }, [data]);

  const topDecision = useMemo(() => {
    if (!data) return null;
    return (
      data.undervalued.find((item) => item.decisionConfidence !== "LOW") ??
      data.picks.find(
        (item) =>
          item.status === "BUY_NOW" && item.decisionConfidence !== "LOW",
      ) ??
      data.picks[0] ??
      null
    );
  }, [data]);

  return (
    <div className="hq-intelligence">
      {team ? (
        <section className="hq-team-loaded">
          <div className="hq-team-summary">
            <div>
              <span>YOUR TEAM</span>
              <h2>{team.teamName}</h2>
              <p>
                {team.managerName}
                {team.region ? " · " + team.region : ""}
              </p>
            </div>
            <div className="hq-team-metrics">
              <div>
                <span>Points</span>
                <strong>{team.overallPoints.toLocaleString()}</strong>
              </div>
              <div>
                <span>Overall</span>
                <strong>
                  {team.overallRank?.toLocaleString() ?? "—"}
                </strong>
              </div>
              <div>
                <span>{"GW" + team.currentEvent}</span>
                <strong>{team.eventPoints ?? "—"}</strong>
              </div>
              <div>
                <span>Value</span>
                <strong>£{team.squadValue.toFixed(1)}m</strong>
              </div>
            </div>
          </div>

          <div className="hq-leagues">
            <div className="hq-section-title">
              <div>
                <span>YOUR MINI-LEAGUES</span>
                <h3>Choose the league you want Footy to help you win.</h3>
              </div>
              <small>
                {(team.miniLeagues.length
                  ? team.miniLeagues
                  : team.otherClassicLeagues
                ).length}{" "}
                available
              </small>
            </div>

            <blockquote className="footy-quip compact">
              {footyQuip("league")}
            </blockquote>
            <div className="hq-league-list">
              {(team.miniLeagues.length
                ? team.miniLeagues
                : team.otherClassicLeagues.slice(0, 8)
              ).map((league) => {
                const delta =
                  league.entry_rank && league.entry_last_rank
                    ? league.entry_last_rank - league.entry_rank
                    : 0;

                return (
                  <a
                    key={league.id}
                    href={
                      "/team/" +
                      team.id +
                      "?league=" +
                      league.id
                    }
                  >
                    <div>
                      <strong>{league.name}</strong>
                      <small>
                        Rank #{league.entry_rank ?? "—"}
                        {delta > 0
                          ? " · ↑" + delta
                          : delta < 0
                            ? " · ↓" + Math.abs(delta)
                            : ""}
                      </small>
                    </div>
                    <b>Enter Team Room →</b>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="hq-market">
        <div className="hq-section-title">
          <div>
            <span>LIVE FPL MARKET</span>
            <h3>Players Footy thinks matter right now — and next.</h3>
          </div>
          <small>
            {data
              ? data.horizonGameweeks +
                "GW horizon · " +
                (data.freshness === "LIVE_FPL"
                  ? "live FPL"
                  : "latest snapshot")
              : error
                ? "Data unavailable"
                : "Loading live data…"}
          </small>
        </div>

        {data ? (
          <>
            <div className="hq-market-pulse">
              <span>
                <b>{data.undervalued.length}</b>
                value flags
              </span>
              <span>
                <b>{data.picks.filter((item) => item.decisionConfidence === "HIGH").length}</b>
                high-confidence calls
              </span>
              <span>
                <b>{data.freshness === "LIVE_FPL" ? "LIVE" : "CACHED"}</b>
                FPL state
              </span>
            </div>

            {topDecision ? (
              <article className="hq-now-card">
                <div className="hq-now-copy">
                  <div className="hq-now-badges">
                    <span>WHAT MATTERS NOW</span>
                    <b className={`confidence-${topDecision.decisionConfidence.toLowerCase()}`}>
                      {topDecision.decisionConfidence} CONFIDENCE
                    </b>
                  </div>
                  <h3>
                    {statusLabel(topDecision)} · {topDecision.player.name}
                  </h3>
                  <p>{topDecision.reasons[0] ?? "The combined model keeps this player at the front of the queue."}</p>
                  <small>
                    <b>Failure mode:</b>{" "}
                    {topDecision.risks[0] ?? "Role, minutes or late team news can still move the call."}
                  </small>
                </div>
                <div className="hq-now-signals">
                  <div><span>EPA</span><strong>{topDecision.epa.epa >= 0 ? "+" : ""}{topDecision.epa.epa.toFixed(2)}</strong></div>
                  <div>
                    <span>{topDecision.player.position === "GKP" ? "Goals prevented/90" : "Reg xGI/90"}</span>
                    <strong>
                      {topDecision.player.position === "GKP"
                        ? topDecision.evidence
                          ? (topDecision.evidence.goalsPreventedPer90 >= 0 ? "+" : "") +
                            topDecision.evidence.goalsPreventedPer90.toFixed(2)
                          : "—"
                        : (topDecision.evidence?.regressedXgiPer90 ?? topDecision.player.xgiPer90).toFixed(2)}
                    </strong>
                  </div>
                  <div><span>6GW</span><strong>{topDecision.score6.toFixed(1)}</strong></div>
                  <div><span>Window</span><strong>{topDecision.bestWindow.startName}</strong></div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTeam(null);
                    setSelectedPlayer(topDecision);
                  }}
                >
                  Inspect decision →
                </button>
              </article>
            ) : null}
          </>
        ) : null}

        {!data && !error ? (
          <div className="hq-loading">
            Scanning player value, form and future windows…
          </div>
        ) : error ? (
          <div className="hq-loading error">{error}</div>
        ) : data ? (
          <div className="hq-market-grid">
            <section>
              <header>
                <span>ESSENTIAL</span>
                <strong>High-confidence core</strong>
                <small>Strong now + strong six-Gameweek outlook.</small>
              </header>
              <div>
                {essentials.map((profile) => (
                  <PlayerRow
                    key={profile.player.id}
                    profile={profile}
                    onOpen={(item) => {
                      setSelectedTeam(null);
                      setSelectedPlayer(item);
                    }}
                  />
                ))}
              </div>
            </section>

            <section>
              <header>
                <span>WATCHLIST</span>
                <strong>Not necessarily now</strong>
                <small>Players whose better window may open later.</small>
                <em className="hq-inline-quip">{footyQuip("watchlist")}</em>
              </header>
              <div>
                {watchlist.map((profile) => (
                  <PlayerRow
                    key={profile.player.id}
                    profile={profile}
                    onOpen={(item) => {
                      setSelectedTeam(null);
                      setSelectedPlayer(item);
                    }}
                  />
                ))}
              </div>
            </section>

            <section>
              <header>
                <span>TRANSFER TARGETS</span>
                <strong>Value worth investigating</strong>
                <small>
                  Undervalued or buy-now players that clear model filters.
                </small>
              </header>
              <div>
                {transfers.map((profile) => (
                  <PlayerRow
                    key={profile.player.id}
                    profile={profile}
                    onOpen={(item) => {
                      setSelectedTeam(null);
                      setSelectedPlayer(item);
                    }}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </section>

      <PlayerIntelDrawer
        profile={selectedPlayer}
        teams={data?.teams ?? []}
        onClose={() => setSelectedPlayer(null)}
        onOpenTeam={(club) => {
          setSelectedPlayer(null);
          setSelectedTeam(club);
        }}
      />
      <TeamIntelDrawer
        team={selectedTeam}
        players={data?.players ?? []}
        onClose={() => setSelectedTeam(null)}
        onOpenPlayer={(profile) => {
          setSelectedTeam(null);
          setSelectedPlayer(profile);
        }}
      />
    </div>
  );
}
