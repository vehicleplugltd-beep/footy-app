
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
import {
  TeamRoomMobileDock,
  TeamRoomWorkflowRail,
  type WorkflowPhase,
} from "@/components/team-room/workflow-nav";
import {
  TeamRoomPhaseHeading,
  TeamRoomReferenceDrawer,
  TeamRoomSummary,
} from "@/components/team-room/structure";
import { TeamRoomStatusStrip } from "@/components/team-room/status-strip";
import { WhatIfPanel } from "@/components/team-room/what-if-panel";
import { DecisionQualityPanel } from "@/components/team-room/decision-quality-panel";
import { DecisionPanel } from "@/components/team-room/decision-panel";
import { PortfolioPanel } from "@/components/team-room/portfolio-panel";
import { CounterPlayPanel } from "@/components/team-room/counterplay-panel";
import type {
  CounterPosture,
  LeagueResponse,
  ManagerResponse,
  Standing,
} from "@/components/team-room/types";

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
  const [counterPosture, setCounterPosture] = useState<CounterPosture | null>(null);
  const [counterPostureLoading, setCounterPostureLoading] = useState(false);
  const [counterPostureError, setCounterPostureError] = useState<string | null>(null);
  const [whatIfOutId, setWhatIfOutId] = useState<number | null>(null);
  const [whatIfInId, setWhatIfInId] = useState<number | null>(null);
  const [whatIfCaptainId, setWhatIfCaptainId] = useState<number | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfError, setWhatIfError] = useState<string | null>(null);
  const [activeWorkflowPhase, setActiveWorkflowPhase] =
    useState<WorkflowPhase>("decision");

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

  async function rerunCounterPosture(posture: CounterPosture) {
    if (counterPostureLoading) return;
    const previousPosture = counterPosture;
    setCounterPosture(posture);
    setCounterPostureLoading(true);
    setCounterPostureError(null);
    try {
      const query = new URLSearchParams({
        staff: "1",
        posture: posture.toLowerCase(),
      });
      if (counterPlay?.what_if.status === "VALID") {
        if (whatIfOutId) query.set("whatif_out", String(whatIfOutId));
        if (whatIfInId) query.set("whatif_in", String(whatIfInId));
        if (whatIfCaptainId) {
          query.set("whatif_captain", String(whatIfCaptainId));
        }
      }
      const response = await fetch(
        "/api/league/" +
          leagueId +
          "/manager/" +
          teamId +
          "?" +
          query.toString(),
        { cache: "no-store" },
      );
      const body = (await response.json()) as ManagerResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "CounterPlay could not re-run this posture.");
      }
      setManager(body);
    } catch (err) {
      setCounterPosture(previousPosture);
      setCounterPostureError(
        err instanceof Error
          ? err.message
          : "CounterPlay could not re-run this posture.",
      );
    } finally {
      setCounterPostureLoading(false);
    }
  }

  async function runWhatIf() {
    if (whatIfLoading) return;
    setWhatIfLoading(true);
    setWhatIfError(null);
    try {
      const query = new URLSearchParams({
        staff: "1",
        posture: activeCounterPosture.toLowerCase(),
      });
      if (whatIfOutId) query.set("whatif_out", String(whatIfOutId));
      if (whatIfInId) query.set("whatif_in", String(whatIfInId));
      if (whatIfCaptainId) {
        query.set("whatif_captain", String(whatIfCaptainId));
      }
      const response = await fetch(
        "/api/league/" +
          leagueId +
          "/manager/" +
          teamId +
          "?" +
          query.toString(),
        { cache: "no-store" },
      );
      const body = (await response.json()) as ManagerResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "What-If simulation could not run.");
      }
      setManager(body);
      if (body.counterplay?.what_if.status === "INVALID") {
        setWhatIfError(
          body.counterplay.what_if.error ||
            "That What-If combination is not legal.",
        );
      }
    } catch (err) {
      setWhatIfError(
        err instanceof Error ? err.message : "What-If simulation could not run.",
      );
    } finally {
      setWhatIfLoading(false);
    }
  }

  async function clearWhatIf() {
    setWhatIfOutId(null);
    setWhatIfInId(null);
    setWhatIfCaptainId(null);
    setWhatIfError(null);
    setWhatIfLoading(true);
    try {
      const query = new URLSearchParams({
        staff: "1",
        posture: activeCounterPosture.toLowerCase(),
      });
      const response = await fetch(
        "/api/league/" +
          leagueId +
          "/manager/" +
          teamId +
          "?" +
          query.toString(),
        { cache: "no-store" },
      );
      const body = (await response.json()) as ManagerResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "CounterPlay could not reset What-If.");
      }
      setManager(body);
    } catch (err) {
      setWhatIfError(
        err instanceof Error ? err.message : "CounterPlay could not reset What-If.",
      );
    } finally {
      setWhatIfLoading(false);
    }
  }

  useEffect(() => {
    const phaseMap = new Map<string, WorkflowPhase>([
      ["decision", "decision"],
      ["portfolio", "plan"],
      ["counterplay", "plan"],
      ["what-if", "test"],
      ["audit", "review"],
    ]);
    const elements = [...phaseMap.keys()]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!elements.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => {
            const aDistance = Math.abs(a.boundingClientRect.top - 132);
            const bDistance = Math.abs(b.boundingClientRect.top - 132);
            return aDistance - bDistance;
          });
        const closest = visible[0]?.target as HTMLElement | undefined;
        const phase = closest?.id ? phaseMap.get(closest.id) : null;
        if (phase) setActiveWorkflowPhase(phase);
      },
      {
        rootMargin: "-112px 0px -62% 0px",
        threshold: [0, 0.08, 0.25],
      },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [manager]);

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
  const activeCounterPosture =
    counterPosture ?? counterPlay?.posture ?? "HYBRID";
  const counterHorizonKey = String(counterHorizon) as "1" | "3" | "5";
  const activeCounterHorizon =
    counterPlay?.horizon_results?.[counterHorizonKey] ??
    counterPlay?.horizon_results?.["3"] ??
    counterPlay?.horizon_results?.["1"] ??
    counterPlay?.horizon_results?.["5"] ??
    null;
  const whatIfOptions = counterPlay?.what_if.options ?? null;
  const selectedWhatIfOut =
    whatIfOptions?.squad.find((player) => player.id === whatIfOutId) ?? null;
  const selectedWhatIfIn =
    whatIfOptions?.replacement_pool.find((player) => player.id === whatIfInId) ??
    null;
  const whatIfReplacementOptions = selectedWhatIfOut && whatIfOptions
    ? whatIfOptions.replacement_pool.filter((candidate) => {
        if (candidate.position !== selectedWhatIfOut.position) return false;
        if (
          candidate.price >
          selectedWhatIfOut.price + whatIfOptions.bank + 0.001
        ) return false;
        const sameClubAfterRemoval = whatIfOptions.squad.filter(
          (player) =>
            player.id !== selectedWhatIfOut.id &&
            player.team === candidate.team,
        ).length;
        return sameClubAfterRemoval < 3;
      })
    : [];
  const whatIfCaptainOptions = whatIfOptions
    ? whatIfOptions.squad
        .filter((player) => player.id !== whatIfOutId)
        .concat(
          selectedWhatIfIn
            ? [{
                id: selectedWhatIfIn.id,
                name: selectedWhatIfIn.name,
                team: selectedWhatIfIn.team,
                position: selectedWhatIfIn.position,
                price: selectedWhatIfIn.price,
                score: selectedWhatIfIn.score,
              }]
            : [],
        )
        .sort((a, b) => b.score - a.score)
    : [];
  const whatIfHorizonScenario =
    counterPlay?.what_if.horizons?.[counterHorizonKey] ??
    counterPlay?.what_if.next_gameweek ??
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

  const researchHref =
    "/research?team=" + teamId + "&league=" + leagueId;

  return (
    <div className="team-room-dashboard">
      {error ? (
        <div className="team-room-error">{error}</div>
      ) : null}

      <TeamRoomStatusStrip
        freshness={scout?.freshness}
        retrievedAt={scout?.dataRetrievedAt}
        counterPlay={counterPlay}
        decisionQuality={decisionQuality}
      />

      <TeamRoomSummary
        loading={intelligenceLoading}
        action={
          portfolioPlan?.action.replaceAll("_", " ") ??
          (transfer ? "MOVE" : "HOLD")
        }
        headline={
          portfolioPlan?.headline ??
          (transfer
            ? transfer.out.name + " → " + transfer.in.name
            : "No move clears threshold")
        }
        leagueRank={leagueRank}
        leagueName={leagueName}
        squadNow={squadNow}
        squadFuture={squadFuture}
      />

      <TeamRoomWorkflowRail active={activeWorkflowPhase} />

      <TeamRoomPhaseHeading
        step={1}
        label="DECIDE"
        title="Start with the action, then inspect the evidence."
        caption="Recommendation → league pressure → plan"
        tone="decision"
      />

      <DecisionPanel
        loading={intelligenceLoading}
        portfolioPlan={portfolioPlan}
        transfer={transfer}
        captain={captain}
        actionQuip={actionQuip}
        transferWhy={transferWhy}
        transferEvidence={transferEvidence}
        transferConfidence={transferInProfile?.decisionConfidence ?? null}
        transferFailure={transferFailure}
        weakPlayers={weakPlayers}
        leagueRank={leagueRank}
        leagueName={leagueName}
        standingsWindow={standingsWindow}
        teamId={teamId}
        targetName={manager?.league_strategy?.target_name ?? null}
        gapAbove={manager?.league_strategy?.gap_above ?? null}
        chaserName={manager?.league_strategy?.chaser_name ?? null}
        gapBelow={manager?.league_strategy?.gap_below ?? null}
        resourceStatus={manager?.resource_advice?.status ?? null}
        resourceRecommendation={manager?.resource_advice?.recommendation ?? null}
        captainQuip={
          captain?.player.name
            ? footyQuip("captain", { player: captain.player.name })
            : null
        }
        onManagerOpen={setSelectedManager}
      />

      <TeamRoomPhaseHeading
        step={2}
        label="PLAN"
        title="Build the path, then size the risk."
        caption="Portfolio structure → CounterPlay → risk posture"
        id="plan"
        tone="plan"
      />

      {portfolioPlan ? (
        <PortfolioPanel
          portfolioPlan={portfolioPlan}
          researchHref={researchHref}
        />
      ) : null}

      {counterPlay ? (
        <CounterPlayPanel
          counterPlay={counterPlay}
          activePosture={activeCounterPosture}
          postureLoading={counterPostureLoading}
          postureError={counterPostureError}
          activeHorizon={activeCounterHorizon}
          horizon={counterHorizon}
          researchHref={researchHref}
          onPostureChange={(posture) => void rerunCounterPosture(posture)}
          onHorizonChange={setCounterHorizon}
        />
      ) : null}

      {counterPlay ? (
        <>
          <TeamRoomPhaseHeading
            step={3}
            label="TEST"
            title="Challenge the plan without changing the recommendation."
            caption="Custom transfer / captain → same model → side-by-side result"
            tone="test"
          />

          <WhatIfPanel
            counterPlay={counterPlay}
            counterHorizon={counterHorizon}
            outId={whatIfOutId}
            inId={whatIfInId}
            captainId={whatIfCaptainId}
            loading={whatIfLoading}
            error={whatIfError}
            replacementOptions={whatIfReplacementOptions}
            captainOptions={whatIfCaptainOptions}
            scenario={whatIfHorizonScenario}
            activeHorizon={activeCounterHorizon}
            onOutChange={(value) => {
              setWhatIfOutId(value);
              setWhatIfInId(null);
              if (whatIfCaptainId === value) setWhatIfCaptainId(null);
              setWhatIfError(null);
            }}
            onInChange={(value) => {
              setWhatIfInId(value);
              setWhatIfError(null);
            }}
            onCaptainChange={(value) => {
              setWhatIfCaptainId(value);
              setWhatIfError(null);
            }}
            onRun={() => void runWhatIf()}
            onReset={() => void clearWhatIf()}
          />
        </>
      ) : null}

      <TeamRoomPhaseHeading
        step={4}
        label="REVIEW"
        title="Judge the decision, not just the score."
        caption="Frozen expectations, regret and outcome variance"
        tone="review"
      />

      {decisionQuality ? (
        <DecisionQualityPanel decisionQuality={decisionQuality} />
      ) : null}

      <TeamRoomReferenceDrawer
        squadRatings={squadRatings}
        researchHref={researchHref}
        resourceRows={resourceRows}
        teamId={teamId}
        onPlayerOpen={(profile) => {
          setSelectedTeam(null);
          setSelectedPlayer(profile);
        }}
        onManagerOpen={setSelectedManager}
      />

      <TeamRoomMobileDock
        active={activeWorkflowPhase}
        decisionLabel={
          intelligenceLoading
            ? "Checking…"
            : portfolioPlan?.headline ??
              (transfer
                ? transfer.out.name + " → " + transfer.in.name
                : "Hold transfer")
        }
        posture={activeCounterPosture}
        reviewLabel={decisionQuality?.pending ? "Armed" : "Audit"}
      />

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
