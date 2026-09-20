import { NextResponse } from "next/server";
import { getLeagueManagerEdgeAnalysis } from "@/lib/fpl";

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
  if (manager.entry_id === leader.entry_id) return "PROTECT";
  if (gap <= 20) return "CHASE";
  return "RECOVER";
}

async function persistRecommendationSnapshot(
  leagueId: number,
  manager: LeagueEntry,
  rival: LeagueEntry | null,
  leader: LeagueEntry,
  analysis: Awaited<ReturnType<typeof getLeagueManagerEdgeAnalysis>>,
) {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const next = analysis.nextEvent;
  if (!key || !next?.id || !next.deadline_time) return;

  const deadline = new Date(next.deadline_time);
  const now = new Date();
  const preDeadline = now.getTime() < deadline.getTime();

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
        model_version: "league-edge-v1",
        battle_mode: battleMode(manager, leader),
        captain_options: analysis.captainOptions.map((player) => ({
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
        transfer_options: analysis.transferOptions.map((item) => ({
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

  if (!key) {
    throw new Error("Footy league analysis is not configured.");
  }

  const response = await fetch(
    `${url}/rest/v1/footy_fpl_league_entries?select=league_id,entry_id,entry_name,player_name,rank,last_rank,event_total,total&league_id=eq.${leagueId}&order=rank.asc`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`League entry lookup failed (${response.status}).`);
  }

  return response.json() as Promise<LeagueEntry[]>;
}

export async function GET(
  _request: Request,
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
    const rivalStanding =
      managerIndex > 0
        ? entries[managerIndex - 1]
        : entries[managerIndex + 1] ?? null;

    const analysis = await getLeagueManagerEdgeAnalysis(
      managerEntryId,
      rivalStanding?.entry_id ?? null,
    );

    const leaderStanding = entries[0] ?? managerStanding;
    await persistRecommendationSnapshot(
      leagueId,
      managerStanding,
      rivalStanding,
      leaderStanding,
      analysis,
    ).catch(() => null);

    return NextResponse.json({
      league_id: leagueId,
      manager_standing: managerStanding,
      rival_standing: rivalStanding,
      analysis,
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
