import { NextResponse } from "next/server";
import {
  getLeagueManagerEdgeAnalysis,
  getRivalResourceHistory,
} from "@/lib/fpl";

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

type LeagueEntry = {
  league_id: number;
  entry_id: number;
  entry_name: string;
  player_name: string | null;
  rank: number | null;
  last_rank: number | null;
  event_total: number | null;
  total: number | null;
};

function battleMode(manager: LeagueEntry, leader: LeagueEntry) {
  const gap = Math.max(0, Number(leader.total || 0) - Number(manager.total || 0));
  if (manager.entry_id === leader.entry_id) return "PROTECT" as const;
  if (gap <= 20) return "CHASE" as const;
  return "RECOVER" as const;
}

function buildLeagueStrategy(
  manager: LeagueEntry,
  targetAbove: LeagueEntry | null,
  chaserBelow: LeagueEntry | null,
  leader: LeagueEntry,
  analysis: Awaited<ReturnType<typeof getLeagueManagerEdgeAnalysis>>,
) {
  const mode = battleMode(manager, leader);
  const rivalByEntry = new Map(
    analysis.rivals.map((item) => [item.entryId, item]),
  );
  const targetAnalysis = targetAbove
    ? rivalByEntry.get(targetAbove.entry_id) ?? null
    : null;
  const chaserAnalysis = chaserBelow
    ? rivalByEntry.get(chaserBelow.entry_id) ?? null
    : null;
  const targetIds = new Set(
    (targetAnalysis?.squad ?? []).map((player) => player.id),
  );
  const chaserIds = new Set(
    (chaserAnalysis?.squad ?? []).map((player) => player.id),
  );

  const gapAbove =
    targetAbove?.total != null && manager.total != null
      ? Number(targetAbove.total) - Number(manager.total)
      : null;
  const gapBelow =
    chaserBelow?.total != null && manager.total != null
      ? Number(manager.total) - Number(chaserBelow.total)
      : null;
  const pressureFocus =
    manager.entry_id === leader.entry_id
      ? "PROTECT"
      : gapAbove != null &&
          gapBelow != null &&
          gapAbove <= 5 &&
          gapBelow <= 5
        ? "BOTH_SIDES"
        : gapBelow != null &&
            gapAbove != null &&
            gapBelow < gapAbove
          ? "CHASE_AND_PROTECT"
          : "CHASE";

  const captainMoves = analysis.captainOptions
    .map((player) => {
      const targetOwns = targetIds.has(player.id);
      const chaserOwns = chaserIds.has(player.id);

      // League context is intentionally small. Expected football output must
      // dominate captaincy; ownership only breaks close calls.
      const separation =
        targetAbove && !targetOwns && mode !== "PROTECT"
          ? Math.min(0.20, player.assistantScore * 0.025)
          : 0;
      const protection =
        chaserBelow && chaserOwns
          ? Math.min(0.12, player.assistantScore * 0.015)
          : 0;

      return {
        player,
        rival_owns: targetOwns,
        chaser_owns: chaserOwns,
        league_score: player.assistantScore + separation + protection,
        rationale:
          targetAbove && chaserBelow
            ? targetOwns
              ? `Strong underlying captain; also limits variance against ${targetAbove.entry_name} while keeping ${chaserBelow.entry_name} in view.`
              : `Strong underlying captain with some separation from ${targetAbove.entry_name}${chaserOwns ? ` and coverage against ${chaserBelow.entry_name}` : ""}.`
            : targetAbove
              ? targetOwns
                ? `Strong underlying captain who also covers ${targetAbove.entry_name}.`
                : `Strong underlying captain with separation from ${targetAbove.entry_name}.`
              : chaserBelow
                ? chaserOwns
                  ? `Strong underlying captain who also covers ${chaserBelow.entry_name} chasing from behind.`
                  : "Ranked on expected output; no ownership adjustment is strong enough to change the call."
                : "Ranked on expected output.",
      };
    })
    .sort((a, b) => b.league_score - a.league_score)
    .slice(0, 3);

  const transferMoves = analysis.manager.weakLinks
    .filter(
      (move) =>
        move.replacement &&
        move.timing === "NOW" &&
        move.gain >= move.minimumGain,
    )
    .map((move) => {
      const replacement = move.replacement!;
      const rawGain = move.gain;
      const targetOwns = targetIds.has(replacement.id);
      const chaserOwns = chaserIds.has(replacement.id);

      // Football model already includes process, fixture and availability.
      // League ownership is a small second-stage adjustment only.
      const separation =
        targetAbove && !targetOwns && mode !== "PROTECT"
          ? Math.min(0.22, Math.max(0, rawGain) * 0.08)
          : 0;
      const protection =
        chaserBelow && chaserOwns
          ? Math.min(0.12, Math.max(0, rawGain) * 0.05 + 0.03)
          : 0;

      return {
        out: move.player,
        in: replacement,
        raw_gain: rawGain,
        minimum_gain: move.minimumGain,
        horizon_gain: move.horizonGain,
        timing: move.timing,
        league_score: rawGain + separation + protection,
        rival_owns: targetOwns,
        chaser_owns: chaserOwns,
        process_adjustment: replacement.processBoost,
        rationale:
          targetAbove && chaserBelow
            ? !targetOwns
              ? `The football edge clears the transfer threshold and creates separation from ${targetAbove.entry_name}${chaserOwns ? ` while covering ${chaserBelow.entry_name}` : ""}.`
              : `The football edge clears the transfer threshold; ownership mainly reduces risk against ${targetAbove.entry_name}.`
            : targetAbove && !targetOwns
              ? `The football edge clears the transfer threshold with added separation from ${targetAbove.entry_name}.`
              : chaserBelow && chaserOwns
                ? `The football edge clears the transfer threshold and covers ${chaserBelow.entry_name} chasing from behind.`
                : "The football edge clears Footy's transfer-value threshold without relying on rival ownership.",
      };
    })
    .sort((a, b) => b.league_score - a.league_score)
    .slice(0, 3);

  return {
    mode,
    pressure_focus: pressureFocus,
    gap_to_leader: Math.max(
      0,
      Number(leader.total || 0) - Number(manager.total || 0),
    ),
    rival_entry_id: targetAbove?.entry_id ?? chaserBelow?.entry_id ?? null,
    rival_name: targetAbove?.entry_name ?? chaserBelow?.entry_name ?? null,
    target_entry_id: targetAbove?.entry_id ?? null,
    target_name: targetAbove?.entry_name ?? null,
    chaser_entry_id: chaserBelow?.entry_id ?? null,
    chaser_name: chaserBelow?.entry_name ?? null,
    gap_above: gapAbove,
    gap_below: gapBelow,
    captain_moves: captainMoves,
    transfer_moves: transferMoves,
    caveat:
      "Football quality, fixture and transfer value are evaluated first. Mini-league ownership can only break close calls; it cannot promote a move that fails the football threshold.",
  };
}

function buildResourceAdvice(
  managerHistory: Awaited<ReturnType<typeof getRivalResourceHistory>>,
  rivalHistory: Awaited<ReturnType<typeof getRivalResourceHistory>> | null,
  mode: "PROTECT" | "CHASE" | "RECOVER",
) {
  if (!rivalHistory) {
    return {
      status: "UNKNOWN" as const,
      chip_edge: [] as string[],
      chip_threats: [] as string[],
      free_transfer_edge: 0,
      recommendation: "No direct rival resource comparison is available yet.",
    };
  }

  const your = new Set(managerHistory.currentHalfRemaining);
  const their = new Set(rivalHistory.currentHalfRemaining);
  const chipEdge = [...your].filter((chip) => !their.has(chip));
  const chipThreats = [...their].filter((chip) => !your.has(chip));
  const freeTransferEdge =
    managerHistory.estimatedFreeTransfers - rivalHistory.estimatedFreeTransfers;
  const resourceScore =
    chipEdge.length * 2 -
    chipThreats.length * 2 +
    Math.max(-2, Math.min(2, freeTransferEdge));

  const status =
    resourceScore >= 2
      ? ("ADVANTAGE" as const)
      : resourceScore <= -2
        ? ("THREAT" as const)
        : ("EVEN" as const);

  let recommendation =
    "Resource position is broadly even. Let player quality, fixtures and underlying process drive the decision.";

  if (status === "ADVANTAGE") {
    recommendation =
      mode === "PROTECT"
        ? "You hold the stronger resource hand. Avoid burning chips or free transfers merely to mirror the rival; preserve the edge for a higher-quality swing window."
        : "You hold extra ammunition. Build with strong underlying picks now, then deploy the resource edge when fixtures create a genuine separation opportunity.";
  } else if (status === "THREAT") {
    recommendation =
      mode === "PROTECT"
        ? "The rival has more flexibility or chip ammunition. Cover their strongest high-quality threats and avoid unnecessary hits that widen their resource edge."
        : "The rival has more flexibility. Close the gap through strong process-backed transfers first rather than compensating with low-quality punts.";
  }

  if (rivalHistory.estimatedFreeTransfers >= 4 && freeTransferEdge < 0) {
    recommendation +=
      " The rival can currently reshape several squad spots without taking hits, so their next deadline carries elevated tactical threat.";
  }

  return {
    status,
    chip_edge: chipEdge,
    chip_threats: chipThreats,
    free_transfer_edge: freeTransferEdge,
    recommendation,
  };
}


function buildDecisionPath(
  analysis: Awaited<ReturnType<typeof getLeagueManagerEdgeAnalysis>>,
  leagueStrategy: ReturnType<typeof buildLeagueStrategy>,
  managerHistory: Awaited<ReturnType<typeof getRivalResourceHistory>> | null,
  resourceAdvice: ReturnType<typeof buildResourceAdvice> | null,
) {
  const transfer = leagueStrategy.transfer_moves[0] ?? null;
  const captain = leagueStrategy.captain_moves[0]?.player ?? null;
  const currentFreeTransfers = managerHistory?.estimatedFreeTransfers ?? null;
  const projectedNextFreeTransfers =
    currentFreeTransfers == null
      ? null
      : Math.min(
          5,
          Math.max(0, currentFreeTransfers - (transfer ? 1 : 0)) + 1,
        );

  const nextWeek = analysis.managerFuturePlan[1] ?? null;
  const nextTransfer =
    nextWeek?.transfer &&
    (!transfer ||
      (nextWeek.transfer.in.id !== transfer.in.id &&
        nextWeek.transfer.out.id !== transfer.out.id))
      ? nextWeek.transfer
      : null;

  const normalizeChip = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const chipsAvailable = new Set(
    (managerHistory?.currentHalfRemaining ?? []).map(normalizeChip),
  );
  const chipCandidate =
    analysis.chipRadar.find(
      (signal) =>
        signal.status === "STRONG" &&
        chipsAvailable.has(normalizeChip(signal.chip)),
    ) ??
    analysis.chipRadar.find(
      (signal) =>
        signal.status === "WATCH" &&
        chipsAvailable.has(normalizeChip(signal.chip)),
    ) ??
    null;

  const laterWeek =
    chipCandidate?.eventName ??
    analysis.managerFuturePlan[2]?.name ??
    analysis.managerFuturePlan[1]?.name ??
    null;

  return {
    now: {
      event_id: analysis.nextEvent?.id ?? null,
      event_name: analysis.nextEvent?.name ?? "Next Gameweek",
      transfer: transfer
        ? {
            out: transfer.out,
            in: transfer.in,
            gain: transfer.raw_gain,
          }
        : null,
      captain,
      instruction: transfer
        ? `Make ${transfer.out.name} → ${transfer.in.name} and captain ${captain?.name ?? "your top-ranked option"}.`
        : `Hold the transfer and captain ${captain?.name ?? "your top-ranked option"}.`,
    },
    next: {
      event_id: nextWeek?.eventId ?? null,
      event_name: nextWeek?.name ?? "Following Gameweek",
      transfer_watch: nextTransfer,
      captain_watch: nextWeek?.captain ?? null,
      projected_free_transfers: projectedNextFreeTransfers,
      instruction: nextTransfer
        ? `Watch ${nextTransfer.out.name} → ${nextTransfer.in.name}; re-run after this deadline before committing.`
        : "Bank flexibility unless next week produces a stronger fresh edge.",
    },
    later: {
      event_name: laterWeek,
      chip: chipCandidate,
      instruction: chipCandidate
        ? `${chipCandidate.status === "STRONG" ? "Prepare" : "Keep"} ${chipCandidate.chip.toLowerCase()} for ${chipCandidate.eventName ?? "the strongest upcoming window"}; confirm again as fixtures settle.`
        : "Preserve chips for now; no upcoming window is strong enough to force deployment.",
    },
    resources: {
      estimated_free_transfers_now: currentFreeTransfers,
      projected_free_transfers_next: projectedNextFreeTransfers,
      confidence: managerHistory?.freeTransferConfidence ?? null,
      league_status: resourceAdvice?.status ?? "UNKNOWN",
      note:
        resourceAdvice?.recommendation ??
        "Use resource flexibility only when the underlying football edge justifies it.",
    },
    caveat:
      "Future steps are a watchlist, not locked instructions. Footy re-runs them each deadline with fresh fixtures, availability, prices and rival context.",
  };
}

async function persistRecommendationSnapshot(
  leagueId: number,
  manager: LeagueEntry,
  rival: LeagueEntry | null,
  leader: LeagueEntry,
  analysis: Awaited<ReturnType<typeof getLeagueManagerEdgeAnalysis>>,
  leagueStrategy: ReturnType<typeof buildLeagueStrategy>,
) {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const next = analysis.nextEvent;
  if (!key || !next?.id || !next.deadline_time) return;

  const now = new Date();
  const preDeadline = now.getTime() < new Date(next.deadline_time).getTime();

  const captainOptions = leagueStrategy.captain_moves.length
    ? leagueStrategy.captain_moves.map((move) => move.player)
    : analysis.captainOptions;

  const transferOptions = leagueStrategy.transfer_moves.length
    ? leagueStrategy.transfer_moves.map((move) => ({
        player: move.out,
        replacement: move.in,
        reason: move.rationale,
      }))
    : analysis.transferOptions;

  const response = await fetch(
    `${url}/rest/v1/footy_fpl_recommendation_snapshots`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        league_id: leagueId,
        entry_id: manager.entry_id,
        rival_entry_id: rival?.entry_id ?? null,
        event: next.id,
        deadline_time: next.deadline_time,
        generated_at: now.toISOString(),
        data_retrieved_at: analysis.dataRetrievedAt,
        model_version: "league-edge-v2-resource",
        battle_mode: battleMode(manager, leader),
        captain_options: captainOptions.map((player) => ({
          id: player.id,
          name: player.name,
          team: player.team,
          score: player.assistantScore,
          opponent: player.opponent,
          form: player.form,
          xgi_per_90: player.xgiPer90,
          transfers_net: player.transfersNet,
          process_boost: player.processBoost,
        })),
        transfer_options: transferOptions.map((item) => ({
          out: {
            id: item.player.id,
            name: item.player.name,
            team: item.player.team,
            score: item.player.assistantScore,
          },
          in: item.replacement
            ? {
                id: item.replacement.id,
                name: item.replacement.name,
                team: item.replacement.team,
                score: item.replacement.assistantScore,
                opponent: item.replacement.opponent,
                form: item.replacement.form,
                xgi_per_90: item.replacement.xgiPer90,
                transfers_net: item.replacement.transfersNet,
                process_boost: item.replacement.processBoost,
              }
            : null,
          reason: item.reason,
        })),
        overlap: {
          count: analysis.overlap.count,
          common_ids: analysis.overlap.common.map((player) => player.id),
          manager_only_ids: analysis.overlap.managerOnly.map((player) => player.id),
          rival_only_ids: analysis.overlap.rivalOnly.map((player) => player.id),
        },
        player_trends: analysis.playerTrends.map((player) => ({
          id: player.id,
          name: player.name,
          team: player.team,
          trend_score: player.trendScore,
          form: player.form,
          xgi_per_90: player.xgiPer90,
          transfers_net: player.transfersNet,
          process_boost: player.processBoost,
        })),
        team_trends: analysis.teamTrends,
        is_pre_deadline: preDeadline,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(
      "Footy receipt snapshot failed",
      response.status,
      await response.text(),
    );
  }
}

async function leagueEntries(leagueId: number): Promise<LeagueEntry[]> {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Footy league analysis is not configured.");

  const response = await fetch(
    `${url}/rest/v1/footy_fpl_league_entries?select=league_id,entry_id,entry_name,player_name,rank,last_rank,event_total,total&league_id=eq.${leagueId}&order=rank.asc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`League entry lookup failed (${response.status}).`);
  }
  return response.json() as Promise<LeagueEntry[]>;
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; entryId: string }>;
  },
) {
  const { id, entryId } = await params;
  const leagueId = Number(id.replace(/\D/g, ""));
  const managerEntryId = Number(entryId.replace(/\D/g, ""));

  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return NextResponse.json(
      { error: "A valid classic league ID is required." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(managerEntryId) || managerEntryId <= 0) {
    return NextResponse.json(
      { error: "A valid FPL manager entry ID is required." },
      { status: 400 },
    );
  }

  try {
    const entries = await leagueEntries(leagueId);
    const managerIndex = entries.findIndex(
      (row) => Number(row.entry_id) === managerEntryId,
    );

    if (managerIndex < 0) {
      return NextResponse.json(
        { error: "That manager is not in the connected league snapshot." },
        { status: 404 },
      );
    }

    const managerStanding = entries[managerIndex];
    const targetStanding =
      managerIndex > 0 ? entries[managerIndex - 1] : null;
    const chaserStandings = entries.slice(managerIndex + 1, managerIndex + 4);
    const nearestChaser = chaserStandings[0] ?? null;
    const rivalStanding = targetStanding ?? nearestChaser;
    const leaderStanding = entries[0] ?? managerStanding;
    const pressureAbove = entries
      .slice(Math.max(0, managerIndex - 3), managerIndex)
      .reverse();

    const analysisRivalIds = [
      targetStanding?.entry_id,
      ...chaserStandings.map((entry) => entry.entry_id),
      leaderStanding.entry_id,
    ].filter(
      (value, index, list): value is number =>
        Boolean(value) &&
        value !== managerEntryId &&
        list.indexOf(value) === index,
    );

    const analysis = await getLeagueManagerEdgeAnalysis(
      managerEntryId,
      analysisRivalIds,
    );
    const leagueStrategy = buildLeagueStrategy(
      managerStanding,
      targetStanding,
      nearestChaser,
      leaderStanding,
      analysis,
    );

    const pressureEntries = [
      managerStanding,
      targetStanding,
      ...chaserStandings,
      leaderStanding,
    ].filter(
      (entry, index, list): entry is LeagueEntry =>
        Boolean(entry) &&
        list.findIndex((item) => item?.entry_id === entry?.entry_id) === index,
    );

    const resourceMap = (
      await Promise.all(
        pressureEntries.map(async (standing) => ({
          standing,
          history: await getRivalResourceHistory(standing.entry_id).catch(
            () => null,
          ),
        })),
      )
    ).filter(
      (
        item,
      ): item is {
        standing: LeagueEntry;
        history: Awaited<ReturnType<typeof getRivalResourceHistory>>;
      } => Boolean(item.history),
    );

    const managerHistory =
      resourceMap.find(
        (item) => item.standing.entry_id === managerStanding.entry_id,
      )?.history ?? null;
    const targetHistory =
      targetStanding
        ? resourceMap.find(
            (item) => item.standing.entry_id === targetStanding.entry_id,
          )?.history ?? null
        : null;
    const nearestChaserHistory =
      nearestChaser
        ? resourceMap.find(
            (item) => item.standing.entry_id === nearestChaser.entry_id,
          )?.history ?? null
        : null;
    const resourceAdvice = managerHistory
      ? buildResourceAdvice(
          managerHistory,
          targetHistory ?? nearestChaserHistory,
          leagueStrategy.mode,
        )
      : null;
    const chaserResourceAdvice =
      managerHistory && nearestChaserHistory
        ? buildResourceAdvice(
            managerHistory,
            nearestChaserHistory,
            "PROTECT",
          )
        : null;
    const decisionPath = buildDecisionPath(
      analysis,
      leagueStrategy,
      managerHistory,
      resourceAdvice,
    );

    const pressureMap = {
      above: pressureAbove.map((entry) => ({
        ...entry,
        gap:
          entry.total != null && managerStanding.total != null
            ? Number(entry.total) - Number(managerStanding.total)
            : null,
      })),
      below: chaserStandings.map((entry) => ({
        ...entry,
        gap:
          entry.total != null && managerStanding.total != null
            ? Number(managerStanding.total) - Number(entry.total)
            : null,
      })),
      leader: {
        ...leaderStanding,
        gap:
          leaderStanding.total != null && managerStanding.total != null
            ? Number(leaderStanding.total) - Number(managerStanding.total)
            : null,
      },
    };

    const staffOnly =
      new URL(request.url).searchParams.get("staff") === "1";

    if (!staffOnly) {
      await persistRecommendationSnapshot(
        leagueId,
        managerStanding,
        rivalStanding,
        leaderStanding,
        analysis,
        leagueStrategy,
      ).catch(() => null);
    }

    return NextResponse.json({
      league_id: leagueId,
      manager_standing: managerStanding,
      rival_standing: rivalStanding,
      target_standing: targetStanding,
      chaser_standings: chaserStandings,
      pressure_map: pressureMap,
      analysis,
      league_strategy: leagueStrategy,
      resource_map: resourceMap,
      resource_advice: resourceAdvice,
      chaser_resource_advice: chaserResourceAdvice,
      decision_path: decisionPath,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Footy could not build this manager analysis.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
