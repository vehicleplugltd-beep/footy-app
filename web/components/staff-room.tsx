"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScoutIntelligencePayload } from "@/lib/fpl";

type LeaguePlayer = {
  id: number;
  name: string;
  team: string;
  availability: number;
  news?: string;
  transfersNet?: number;
};

type LeaguePayload = {
  generated_at?: string;
  league_strategy?: {
    mode?: "PROTECT" | "CHASE" | "RECOVER";
    pressure_focus?: string;
    target_name?: string | null;
    chaser_name?: string | null;
    gap_above?: number | null;
    gap_below?: number | null;
    captain_moves?: Array<{ player: LeaguePlayer }>;
    transfer_moves?: Array<{
      out: LeaguePlayer;
      in: LeaguePlayer;
      raw_gain: number;
      minimum_gain?: number;
      horizon_gain?: number;
    }>;
  };
  analysis?: {
    manager?: {
      squad?: LeaguePlayer[];
      weakLinks?: Array<{
        player: LeaguePlayer;
        replacement: LeaguePlayer | null;
        timing: "NOW" | "WAIT" | "HOLD";
        horizonGain: number;
      }>;
    };
  };
  resource_advice?: {
    status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
    recommendation: string;
  } | null;
  chaser_resource_advice?: {
    status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
    recommendation: string;
  } | null;
};

type Snapshot = {
  savedAt: string;
  recommendation: string;
  undervalued: Record<string, number>;
  futureWindows: Record<string, string>;
  squadNews: Record<string, string>;
  gapAbove: number | null;
  gapBelow: number | null;
  resourceStatus: string;
  chaserResourceStatus: string;
  marketLeader: string;
  processLeader: string;
};

type Signal = {
  id: string;
  desk: "ASSISTANT" | "RECRUITMENT" | "MEDICAL" | "ANALYST" | "OPPOSITION" | "MARKET";
  priority: number;
  tone: "ACTION" | "WATCH" | "INFO";
  title: string;
  body: string;
  meta?: string;
  isNew: boolean;
};

function localKey(teamId: number, leagueId?: number) {
  return `footy-staff-room-v1-${teamId}-${leagueId ?? "global"}`;
}

function safeRead(key: string): Snapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, snapshot: Snapshot) {
  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {}
}

function changedMap(
  current: Record<string, string | number>,
  previous: Record<string, string | number> | undefined,
) {
  return Object.entries(current).some(
    ([key, value]) => previous?.[key] !== value,
  );
}

function signalTone(priority: number): Signal["tone"] {
  return priority >= 90 ? "ACTION" : priority >= 70 ? "WATCH" : "INFO";
}

export function StaffRoom({
  teamId,
  leagueId,
}: {
  teamId: number;
  leagueId?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [scout, setScout] = useState<ScoutIntelligencePayload | null>(null);
  const [league, setLeague] = useState<LeaguePayload | null>(null);
  const [previous, setPrevious] = useState<Snapshot | null>(null);
  const [loadedPrevious, setLoadedPrevious] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || requested) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRequested(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [requested]);

  useEffect(() => {
    if (!requested || loadedPrevious) return;
    setPrevious(safeRead(localKey(teamId, leagueId)));
    setLoadedPrevious(true);
  }, [requested, loadedPrevious, teamId, leagueId]);

  useEffect(() => {
    if (!requested || scout || error) return;
    const controller = new AbortController();

    async function load() {
      try {
        const requests: Array<Promise<Response>> = [
          fetch("/api/scout", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ];

        if (leagueId) {
          requests.push(
            fetch(
              `/api/league/${leagueId}/manager/${teamId}?staff=1`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
          );
        }

        const responses = await Promise.all(requests);
        const scoutBody = await responses[0].json();
        if (!responses[0].ok) {
          throw new Error(
            scoutBody.error || "Staff Room intelligence is unavailable.",
          );
        }
        setScout(scoutBody as ScoutIntelligencePayload);

        if (responses[1]) {
          const leagueBody = await responses[1].json();
          if (responses[1].ok) setLeague(leagueBody as LeaguePayload);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Staff Room intelligence is unavailable.",
        );
      }
    }

    void load();
    return () => controller.abort();
  }, [requested, scout, error, leagueId, teamId]);

  const currentSnapshot = useMemo<Snapshot | null>(() => {
    if (!scout) return null;

    const transfer = league?.league_strategy?.transfer_moves?.[0];
    const captain = league?.league_strategy?.captain_moves?.[0]?.player;
    const recommendation = transfer
      ? `${transfer.out.id}->${transfer.in.id}|C:${captain?.id ?? "none"}`
      : `HOLD|C:${captain?.id ?? "none"}`;

    const undervalued = Object.fromEntries(
      scout.undervalued
        .slice(0, 6)
        .map((profile) => [
          String(profile.player.id),
          Number(profile.epa.epa.toFixed(2)),
        ]),
    );

    const futureWindows = Object.fromEntries(
      scout.picks
        .filter((profile) => profile.status === "FUTURE_TARGET")
        .slice(0, 8)
        .map((profile) => [
          String(profile.player.id),
          profile.bestWindow.startName,
        ]),
    );

    const squadNews = Object.fromEntries(
      (league?.analysis?.manager?.squad ?? [])
        .filter(
          (player) =>
            player.availability < 100 ||
            Boolean(player.news?.trim()),
        )
        .map((player) => [
          String(player.id),
          `${player.availability}|${player.news ?? ""}`,
        ]),
    );

    const marketLeader =
      [...scout.players]
        .sort(
          (a, b) =>
            Math.abs(b.player.transfersNet) -
            Math.abs(a.player.transfersNet),
        )[0]?.player.id.toString() ?? "";

    const processLeader =
      [...scout.teams]
        .filter((team) => team.process)
        .sort((a, b) => {
          const aTrend = Math.max(
            Math.abs(a.process?.attackTrend ?? 0),
            Math.abs(a.process?.defenceTrend ?? 0),
          );
          const bTrend = Math.max(
            Math.abs(b.process?.attackTrend ?? 0),
            Math.abs(b.process?.defenceTrend ?? 0),
          );
          return bTrend - aTrend;
        })[0]?.team ?? "";

    return {
      savedAt: new Date().toISOString(),
      recommendation,
      undervalued,
      futureWindows,
      squadNews,
      gapAbove: league?.league_strategy?.gap_above ?? null,
      gapBelow: league?.league_strategy?.gap_below ?? null,
      resourceStatus: league?.resource_advice?.status ?? "UNKNOWN",
      chaserResourceStatus:
        league?.chaser_resource_advice?.status ?? "UNKNOWN",
      marketLeader,
      processLeader,
    };
  }, [scout, league]);

  const signals = useMemo<Signal[]>(() => {
    if (!scout || !currentSnapshot) return [];

    const output: Signal[] = [];
    const transfer = league?.league_strategy?.transfer_moves?.[0] ?? null;
    const captain =
      league?.league_strategy?.captain_moves?.[0]?.player ?? null;
    const recommendationChanged =
      Boolean(previous) &&
      previous?.recommendation !== currentSnapshot.recommendation;

    output.push({
      id: "assistant-plan",
      desk: "ASSISTANT",
      priority: recommendationChanged ? 100 : 88,
      tone: recommendationChanged ? "ACTION" : "WATCH",
      title: recommendationChanged
        ? "Your plan has changed"
        : transfer
          ? `${transfer.out.name} → ${transfer.in.name}`
          : "Hold the transfer",
      body: transfer
        ? `The move clears Footy's act-now threshold by ${Math.max(
            0,
            transfer.raw_gain - (transfer.minimum_gain ?? 0),
          ).toFixed(1)} model points${captain ? `; captain ${captain.name}` : ""}.`
        : `No transfer currently clears the cost of using an FT${captain ? `; captain ${captain.name}` : ""}.`,
      meta: leagueId
        ? "League-adjusted after the football model clears its threshold."
        : "Select a mini-league for opponent-aware advice.",
      isNew: recommendationChanged || !previous,
    });

    const undervalued = scout.undervalued[0];
    if (undervalued) {
      const id = String(undervalued.player.id);
      const oldEpa = previous?.undervalued?.[id];
      const isNew =
        !previous ||
        oldEpa == null ||
        Math.abs(undervalued.epa.epa - oldEpa) >= 0.25;

      output.push({
        id: `recruitment-${id}`,
        desk: "RECRUITMENT",
        priority: undervalued.status === "BUY_NOW" ? 94 : 82,
        tone: undervalued.status === "BUY_NOW" ? "ACTION" : "WATCH",
        title: `${undervalued.player.name} is screening as undervalued`,
        body: `+${undervalued.epa.epa.toFixed(2)} EPA at £${undervalued.player.price.toFixed(
          1,
        )}m · ${undervalued.epa.epaPerMillion.toFixed(
          3,
        )} EPA/£m · best window ${undervalued.bestWindow.startName}–${undervalued.bestWindow.endName}.`,
        meta:
          undervalued.reasons[0] ??
          "Underlying output and replacement-level value are both positive.",
        isNew,
      });
    }

    const futureTarget = scout.picks.find(
      (profile) => profile.status === "FUTURE_TARGET",
    );
    if (futureTarget) {
      const id = String(futureTarget.player.id);
      const oldWindow = previous?.futureWindows?.[id];
      output.push({
        id: `future-${id}`,
        desk: "RECRUITMENT",
        priority: 74,
        tone: "WATCH",
        title: `Plan for ${futureTarget.player.name}, not necessarily now`,
        body: `His strongest three-Gameweek window starts ${futureTarget.bestWindow.startName}. Current 6GW score ${futureTarget.score6.toFixed(
          1,
        )}.`,
        meta:
          futureTarget.risks[0] ??
          "Footy is preserving timing flexibility before committing.",
        isNew:
          !previous ||
          oldWindow == null ||
          oldWindow !== futureTarget.bestWindow.startName,
      });
    }

    const squadNews = league?.analysis?.manager?.squad ?? [];
    const medical = squadNews
      .filter(
        (player) =>
          player.availability < 100 ||
          Boolean(player.news?.trim()),
      )
      .sort((a, b) => a.availability - b.availability)[0];

    if (medical) {
      const key = String(medical.id);
      output.push({
        id: `medical-${key}`,
        desk: "MEDICAL",
        priority: medical.availability < 75 ? 96 : 80,
        tone: medical.availability < 75 ? "ACTION" : "WATCH",
        title: `${medical.name}: ${medical.availability}% availability`,
        body:
          medical.news?.trim() ||
          "Availability is below 100%; recheck official FPL news before the deadline.",
        meta: "Footy will not treat an uncertain player as a fully reliable starter.",
        isNew:
          !previous ||
          previous.squadNews?.[key] !== currentSnapshot.squadNews[key],
      });
    }

    const processTeam = [...scout.teams]
      .filter((team) => team.process)
      .sort((a, b) => {
        const aTrend = Math.max(
          Math.abs(a.process?.attackTrend ?? 0),
          Math.abs(a.process?.defenceTrend ?? 0),
        );
        const bTrend = Math.max(
          Math.abs(b.process?.attackTrend ?? 0),
          Math.abs(b.process?.defenceTrend ?? 0),
        );
        return bTrend - aTrend;
      })[0];

    if (processTeam?.process) {
      const attack = processTeam.process.attackTrend;
      const defence = processTeam.process.defenceTrend;
      const strongest =
        Math.abs(attack) >= Math.abs(defence)
          ? { label: "attack", value: attack }
          : { label: "defence", value: defence };

      if (Math.abs(strongest.value) >= 0.04) {
        output.push({
          id: `analyst-${processTeam.teamId}`,
          desk: "ANALYST",
          priority: Math.abs(strongest.value) >= 0.10 ? 82 : 66,
          tone: Math.abs(strongest.value) >= 0.10 ? "WATCH" : "INFO",
          title: `${processTeam.team} ${strongest.label} is ${strongest.value >= 0 ? "improving" : "slipping"}`,
          body: `${strongest.value >= 0 ? "+" : ""}${(
            strongest.value * 100
          ).toFixed(0)}% recent process trend · ${processTeam.outlook.toLowerCase()} · 6GW FDR ${processTeam.averageDifficulty.toFixed(
            1,
          )}.`,
          meta: `Source confidence ${(
            processTeam.process.sourceConfidence * 100
          ).toFixed(0)}%.`,
          isNew:
            !previous ||
            previous.processLeader !== currentSnapshot.processLeader,
        });
      }
    }

    if (leagueId) {
      const target = league?.league_strategy?.target_name;
      const chaser = league?.league_strategy?.chaser_name;
      const gapAbove = league?.league_strategy?.gap_above;
      const gapBelow = league?.league_strategy?.gap_below;
      const resourceThreat =
        league?.resource_advice?.status === "THREAT" ||
        league?.chaser_resource_advice?.status === "THREAT";

      if (
        target ||
        chaser ||
        resourceThreat
      ) {
        const closePressure =
          (gapAbove != null && gapAbove <= 10) ||
          (gapBelow != null && gapBelow <= 10);

        output.push({
          id: "opposition-pressure",
          desk: "OPPOSITION",
          priority: resourceThreat || closePressure ? 90 : 68,
          tone: resourceThreat || closePressure ? "ACTION" : "INFO",
          title:
            target && chaser
              ? `Catch ${target}; protect from ${chaser}`
              : target
                ? `Target: ${target}`
                : `Protect from ${chaser ?? "the nearest chaser"}`,
          body: [
            gapAbove != null ? `${gapAbove} pts to the manager above` : null,
            gapBelow != null ? `${gapBelow} pts clear of the nearest chaser` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          meta:
            league?.resource_advice?.recommendation ??
            league?.chaser_resource_advice?.recommendation ??
            "Footy checks both sides of the league table before adjusting close calls.",
          isNew:
            !previous ||
            previous.gapAbove !== currentSnapshot.gapAbove ||
            previous.gapBelow !== currentSnapshot.gapBelow ||
            previous.resourceStatus !== currentSnapshot.resourceStatus ||
            previous.chaserResourceStatus !==
              currentSnapshot.chaserResourceStatus,
        });
      }
    }

    const market = [...scout.players]
      .filter((profile) => Math.abs(profile.player.transfersNet) >= 20000)
      .sort(
        (a, b) =>
          Math.abs(b.player.transfersNet) -
          Math.abs(a.player.transfersNet),
      )[0];

    if (market) {
      const net = market.player.transfersNet;
      output.push({
        id: `market-${market.player.id}`,
        desk: "MARKET",
        priority: Math.abs(net) >= 100000 ? 72 : 58,
        tone: Math.abs(net) >= 100000 ? "WATCH" : "INFO",
        title: `${market.player.name}: ${net >= 0 ? "buying" : "selling"} pressure`,
        body: `${net >= 0 ? "+" : ""}${net.toLocaleString()} net transfers this Gameweek · £${market.player.price.toFixed(
          1,
        )}m · ${market.player.selectedBy.toFixed(1)}% owned.`,
        meta:
          "Market momentum is context only; Footy will not promote a player unless the football case also holds.",
        isNew:
          !previous ||
          previous.marketLeader !== currentSnapshot.marketLeader,
      });
    }

    return output
      .filter((signal) => signal.priority >= 58)
      .sort(
        (a, b) =>
          Number(b.isNew) - Number(a.isNew) ||
          b.priority - a.priority,
      )
      .slice(0, 6)
      .map((signal) => ({
        ...signal,
        tone: signal.tone ?? signalTone(signal.priority),
      }));
  }, [scout, league, leagueId, previous, currentSnapshot]);

  useEffect(() => {
    if (!currentSnapshot || !loadedPrevious) return;
    safeWrite(localKey(teamId, leagueId), currentSnapshot);
  }, [currentSnapshot, loadedPrevious, teamId, leagueId]);

  const newCount = signals.filter((signal) => signal.isNew).length;

  return (
    <div ref={ref} className="staff-room">
      {!requested ? (
        <button
          type="button"
          className="staff-room-load"
          onClick={() => setRequested(true)}
        >
          Open staff briefing
        </button>
      ) : !scout && !error ? (
        <div className="staff-room-loading">
          <strong>Backroom staff are checking the latest signals…</strong>
          <span />
        </div>
      ) : error ? (
        <div className="staff-room-error">{error}</div>
      ) : (
        <>
          <header className="staff-room-head">
            <div>
              <span>STAFF ROOM</span>
              <h2>Your backroom briefing</h2>
              <p>
                Only signals strong enough to matter. Footy remembers the last
                briefing on this device and marks changed items as new.
              </p>
            </div>
            <div className="staff-room-count">
              <strong>{newCount}</strong>
              <span>{newCount === 1 ? "new update" : "new updates"}</span>
            </div>
          </header>

          <div className="staff-room-feed">
            {signals.map((signal) => (
              <article
                key={signal.id}
                className={`staff-signal signal-${signal.tone.toLowerCase()}`}
              >
                <div className="staff-signal-top">
                  <span>{signal.desk}</span>
                  <div>
                    {signal.isNew ? <b>NEW</b> : null}
                    <em>{signal.tone}</em>
                  </div>
                </div>
                <h3>{signal.title}</h3>
                <p>{signal.body}</p>
                {signal.meta ? <small>{signal.meta}</small> : null}
              </article>
            ))}
          </div>

          {!signals.length ? (
            <div className="staff-room-quiet">
              <strong>No meaningful changes.</strong>
              <p>
                Footy is deliberately quiet when the evidence has not changed
                enough to alter your plan.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
