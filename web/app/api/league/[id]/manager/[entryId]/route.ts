import { NextResponse } from "next/server";
import {
  getLeagueManagerEdgeAnalysis,
  getRivalResourceHistory,
  type RankedPlayer,
  type TeamAnalysis,
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

type EntrySnapshot = {
  entry_id: number;
  event: number;
  picks: Array<{
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
  }>;
  entry_history: {
    bank?: number;
    event_transfers?: number;
    event_transfers_cost?: number;
    points_on_bench?: number;
    total_points?: number;
  } | null;
};

type LocalExposure = {
  player_id: number;
  squad_ownership: number;
  starter_ownership: number;
  captain_share: number;
  effective_exposure: number;
};

async function localPlayerDirectory() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return new Map<number, { id: number; name: string; team: string }>();

  const response = await fetch(
    `${url}/rest/v1/footy_fpl_snapshots?select=payload&snapshot_key=eq.bootstrap-static&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  if (!response.ok) return new Map<number, { id: number; name: string; team: string }>();
  const rows = (await response.json()) as Array<{
    payload?: {
      elements?: Array<{ id: number; web_name: string; team: number }>;
      teams?: Array<{ id: number; short_name: string }>;
    };
  }>;
  const payload = rows[0]?.payload;
  const teams = new Map(
    (payload?.teams ?? []).map((team) => [Number(team.id), team.short_name]),
  );
  return new Map(
    (payload?.elements ?? []).map((player) => [
      Number(player.id),
      {
        id: Number(player.id),
        name: player.web_name,
        team: teams.get(Number(player.team)) ?? "—",
      },
    ]),
  );
}

async function latestLeagueSnapshots(leagueId: number): Promise<{
  event: number | null;
  snapshots: EntrySnapshot[];
}> {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { event: null, snapshots: [] };

  const eventResponse = await fetch(
    `${url}/rest/v1/footy_fpl_entry_snapshots?select=event&league_id=eq.${leagueId}&order=event.desc&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  if (!eventResponse.ok) return { event: null, snapshots: [] };
  const eventRows = (await eventResponse.json()) as Array<{ event: number }>;
  const event = Number(eventRows[0]?.event ?? 0);
  if (!event) return { event: null, snapshots: [] };

  const snapshotResponse = await fetch(
    `${url}/rest/v1/footy_fpl_entry_snapshots?select=entry_id,event,picks,entry_history&league_id=eq.${leagueId}&event=eq.${event}&order=entry_id.asc`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  if (!snapshotResponse.ok) return { event, snapshots: [] };
  return {
    event,
    snapshots: (await snapshotResponse.json()) as EntrySnapshot[],
  };
}

type RecommendationReceipt = {
  event: number;
  generated_at: string;
  battle_mode: string | null;
  model_version: string | null;
  captain_options: Array<{
    id: number;
    name: string;
    team: string;
    score: number;
  }>;
  transfer_options: Array<{
    out: { id: number; name: string; team: string; score: number };
    in: { id: number; name: string; team: string; score: number } | null;
    reason: string;
  }>;
};

type EventLiveSnapshot = {
  snapshot_key: string;
  payload: {
    elements?: Array<{
      id: number;
      stats?: { total_points?: number };
    }>;
  };
};

async function decisionQualityHistory(
  leagueId: number,
  entryId: number,
  currentEvent: { id: number; finished: boolean } | null,
) {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    return {
      status: "UNAVAILABLE",
      tracked_from_event: 6,
      completed: [],
      summary: null,
      caveat: "Decision receipts require the Footy server data connection.",
    };
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [receiptResponse, picksResponse, liveResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/footy_fpl_recommendation_snapshots?select=event,generated_at,battle_mode,model_version,captain_options,transfer_options&league_id=eq.${leagueId}&entry_id=eq.${entryId}&is_pre_deadline=eq.true&order=event.asc,generated_at.desc`,
      { headers, cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/footy_fpl_entry_snapshots?select=entry_id,event,picks,entry_history&league_id=eq.${leagueId}&entry_id=eq.${entryId}&order=event.asc`,
      { headers, cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/footy_fpl_snapshots?select=snapshot_key,payload&snapshot_key=like.event-live-*`,
      { headers, cache: "no-store" },
    ),
  ]);

  if (!receiptResponse.ok || !picksResponse.ok || !liveResponse.ok) {
    return {
      status: "UNAVAILABLE",
      tracked_from_event: 6,
      completed: [],
      summary: null,
      caveat: "One or more deadline-audit data sources are temporarily unavailable.",
    };
  }

  const receipts = (await receiptResponse.json()) as RecommendationReceipt[];
  const picks = (await picksResponse.json()) as EntrySnapshot[];
  const liveSnapshots = (await liveResponse.json()) as EventLiveSnapshot[];

  const latestReceiptByEvent = new Map<number, RecommendationReceipt>();
  for (const receipt of receipts) {
    if (!latestReceiptByEvent.has(Number(receipt.event))) {
      latestReceiptByEvent.set(Number(receipt.event), receipt);
    }
  }
  const pickByEvent = new Map(picks.map((snapshot) => [snapshot.event, snapshot]));
  const liveByEvent = new Map<number, Map<number, number>>();
  for (const snapshot of liveSnapshots) {
    const match = snapshot.snapshot_key.match(/^event-live-(\d+)$/);
    if (!match) continue;
    const points = new Map<number, number>();
    for (const element of snapshot.payload?.elements ?? []) {
      points.set(Number(element.id), Number(element.stats?.total_points ?? 0));
    }
    liveByEvent.set(Number(match[1]), points);
  }

  const currentEventId = currentEvent?.id ?? 0;
  const isCompleted = (event: number) =>
    event < currentEventId ||
    (event === currentEventId && Boolean(currentEvent?.finished));

  const completed = [...latestReceiptByEvent.values()]
    .filter((receipt) => isCompleted(Number(receipt.event)))
    .map((receipt) => {
      const event = Number(receipt.event);
      const eventPicks = pickByEvent.get(event);
      const priorPicks = pickByEvent.get(event - 1);
      const points = liveByEvent.get(event);
      if (!eventPicks || !points) return null;

      const actualCaptainPick = (eventPicks.picks ?? []).find(
        (pick) => pick.is_captain,
      );
      const topCaptain = receipt.captain_options?.[0] ?? null;
      const actualCaptainOption = actualCaptainPick
        ? receipt.captain_options?.find(
            (option) => option.id === actualCaptainPick.element,
          ) ?? null
        : null;
      const actualCaptainRawPoints = actualCaptainPick
        ? points.get(actualCaptainPick.element) ?? 0
        : null;
      const topCaptainRawPoints = topCaptain
        ? points.get(topCaptain.id) ?? 0
        : null;
      const expectedCaptainGap =
        topCaptain && actualCaptainOption
          ? Number(topCaptain.score ?? 0) - Number(actualCaptainOption.score ?? 0)
          : null;

      const captainProcess =
        !actualCaptainPick || !topCaptain
          ? "UNAVAILABLE"
          : actualCaptainPick.element === topCaptain.id
            ? "MODEL_ALIGNED"
            : actualCaptainOption && (expectedCaptainGap ?? 99) <= 0.5
              ? "CLOSE_CALL"
              : actualCaptainOption
                ? "OFF_MODEL"
                : "NOT_IN_MODEL_SHORTLIST";

      const currentIds = new Set((eventPicks.picks ?? []).map((pick) => pick.element));
      const priorIds = new Set((priorPicks?.picks ?? []).map((pick) => pick.element));
      const actualIn = priorPicks
        ? [...currentIds].filter((id) => !priorIds.has(id))
        : [];
      const actualOut = priorPicks
        ? [...priorIds].filter((id) => !currentIds.has(id))
        : [];

      const recommendedTransfers = receipt.transfer_options ?? [];
      const topTransfer = recommendedTransfers[0] ?? null;
      const alignedTransfer = topTransfer?.in
        ? actualIn.includes(topTransfer.in.id) && actualOut.includes(topTransfer.out.id)
        : false;
      const anyRecommendedTransfer = recommendedTransfers.find(
        (option) =>
          option.in &&
          actualIn.includes(option.in.id) &&
          actualOut.includes(option.out.id),
      );
      const transferProcess =
        !priorPicks
          ? "NO_PRIOR_SQUAD_SNAPSHOT"
          : actualIn.length === 0 && actualOut.length === 0
            ? topTransfer
              ? "BANKED_AGAINST_MODEL_MOVE"
              : "MODEL_ALIGNED_HOLD"
            : alignedTransfer
              ? "MODEL_ALIGNED"
              : anyRecommendedTransfer
                ? "MODEL_SHORTLIST"
                : "OFF_MODEL_OR_STRUCTURAL";

      const topTransferActualDelta =
        topTransfer?.in
          ? (points.get(topTransfer.in.id) ?? 0) -
            (points.get(topTransfer.out.id) ?? 0)
          : null;
      const topTransferExpectedDelta =
        topTransfer?.in
          ? Number(topTransfer.in.score ?? 0) -
            Number(topTransfer.out.score ?? 0)
          : null;

      const hitCost = Number(
        eventPicks.entry_history?.event_transfers_cost ?? 0,
      );
      const benchPoints = Number(
        eventPicks.entry_history?.points_on_bench ?? 0,
      );

      return {
        event,
        generated_at: receipt.generated_at,
        model_version: receipt.model_version,
        battle_mode: receipt.battle_mode,
        captain: {
          process: captainProcess,
          actual_player_id: actualCaptainPick?.element ?? null,
          model_player_id: topCaptain?.id ?? null,
          model_player_name: topCaptain?.name ?? null,
          model_expected: topCaptain?.score ?? null,
          actual_choice_expected: actualCaptainOption?.score ?? null,
          expected_ev_gap: expectedCaptainGap,
          actual_choice_points: actualCaptainRawPoints,
          model_choice_points: topCaptainRawPoints,
          actual_vs_model_expectation:
            actualCaptainRawPoints != null && actualCaptainOption
              ? actualCaptainRawPoints - Number(actualCaptainOption.score ?? 0)
              : null,
        },
        transfers: {
          process: transferProcess,
          actual_in_ids: actualIn,
          actual_out_ids: actualOut,
          model_top: topTransfer,
          model_expected_delta: topTransferExpectedDelta,
          model_actual_delta: topTransferActualDelta,
          hit_cost: hitCost,
        },
        bench_points: benchPoints,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!completed.length) {
    return {
      status: "ACCUMULATING",
      tracked_from_event:
        receipts.length
          ? Math.min(...receipts.map((receipt) => Number(receipt.event)))
          : 6,
      completed: [],
      summary: null,
      caveat:
        "Footy only scores decision quality where a genuine pre-deadline recommendation receipt exists. Tracking started in GW6, so earlier Gameweeks are not reconstructed with hindsight.",
    };
  }

  const alignedCaptains = completed.filter(
    (item) =>
      item.captain.process === "MODEL_ALIGNED" ||
      item.captain.process === "CLOSE_CALL",
  ).length;
  const hitCost = completed.reduce(
    (sum, item) => sum + item.transfers.hit_cost,
    0,
  );
  const averageBench =
    completed.reduce((sum, item) => sum + item.bench_points, 0) /
    completed.length;
  const negativeVariance = completed.filter(
    (item) =>
      item.captain.actual_vs_model_expectation != null &&
      item.captain.actual_vs_model_expectation < -2,
  ).length;

  const observations: string[] = [];
  if (hitCost >= 8) {
    observations.push(
      "Hit usage is material in the tracked sample. Audit whether the pre-deadline EV justified each cost rather than judging the hits by outcome alone.",
    );
  }
  if (averageBench >= 8) {
    observations.push(
      "Bench-point leakage is elevated in the tracked sample; review whether too much playable value is being left outside the XI.",
    );
  }
  if (negativeVariance > 0 && alignedCaptains > 0) {
    observations.push(
      "At least one process-aligned captain underperformed its pre-deadline expectation. Footy classifies that separately from a poor decision.",
    );
  }
  if (!observations.length) {
    observations.push(
      "No repeated behavioural issue is established yet. Footy waits for a meaningful sample rather than assigning a bias label from one deadline.",
    );
  }

  return {
    status: "ACTIVE",
    tracked_from_event: Math.min(...completed.map((item) => item.event)),
    completed,
    summary: {
      deadlines: completed.length,
      captain_process_alignment: alignedCaptains / completed.length,
      total_hit_cost: hitCost,
      average_bench_points: averageBench,
      negative_variance_deadlines: negativeVariance,
      observations,
    },
    caveat:
      "Decision quality is judged from the latest stored pre-deadline model receipt for each event. Outcome variance is reported separately from process alignment.",
  };
}

function buildLocalExposure(snapshots: EntrySnapshot[]) {
  const managers = Math.max(1, snapshots.length);
  const counts = new Map<
    number,
    { squad: number; starter: number; captain: number; multiplier: number }
  >();

  for (const snapshot of snapshots) {
    for (const pick of snapshot.picks ?? []) {
      const item = counts.get(pick.element) ?? {
        squad: 0,
        starter: 0,
        captain: 0,
        multiplier: 0,
      };
      item.squad += 1;
      if (pick.position <= 11 && pick.multiplier > 0) item.starter += 1;
      if (pick.is_captain) item.captain += 1;
      item.multiplier += Number(pick.multiplier ?? 0);
      counts.set(pick.element, item);
    }
  }

  return new Map<number, LocalExposure>(
    [...counts.entries()].map(([playerId, item]) => [
      playerId,
      {
        player_id: playerId,
        squad_ownership: (item.squad / managers) * 100,
        starter_ownership: (item.starter / managers) * 100,
        captain_share: (item.captain / managers) * 100,
        effective_exposure: (item.multiplier / managers) * 100,
      },
    ]),
  );
}

function deterministicUnit(seed: number) {
  let value = seed | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function normalFromSeed(seed: number) {
  const u1 = Math.max(1e-9, deterministicUnit(seed));
  const u2 = deterministicUnit(seed ^ 0x9e3779b9);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function simulationVolatility(player: RankedPlayer) {
  const rotationRisk = 1 - Math.max(0, Math.min(1, player.startReliability));
  const attackingVariance =
    (player.position === "MID" || player.position === "FWD"
      ? player.xgiPer90 * 2.3
      : player.xgiPer90 * 1.35);
  const cleanSheetVariance =
    player.position === "GKP" || player.position === "DEF" ? 1.0 : 0.25;
  return Math.max(
    1.0,
    Math.min(
      5.8,
      1.2 +
        rotationRisk * 3.0 +
        Math.min(2.3, attackingVariance) +
        cleanSheetVariance +
        Math.max(0, player.fixtureDifficulty - 2.5) * 0.25,
    ),
  );
}

function simulatedPlayerScore(
  player: RankedPlayer,
  iteration: number,
  cache?: Map<number, number>,
) {
  const cached = cache?.get(player.id);
  if (cached != null) return cached;
  const sd = simulationVolatility(player);
  const shock = normalFromSeed(
    (player.id * 73856093) ^ ((iteration + 1) * 19349663),
  );
  const score = Math.max(-1, player.assistantScore + shock * sd);
  cache?.set(player.id, score);
  return score;
}

function bestXiFromSquad(squad: RankedPlayer[]) {
  const sorted = [...squad].sort((a, b) => b.assistantScore - a.assistantScore);
  const byPosition = new Map<string, RankedPlayer[]>();
  for (const position of ["GKP", "DEF", "MID", "FWD"]) {
    byPosition.set(
      position,
      sorted.filter((player) => player.position === position),
    );
  }
  const keeper = (byPosition.get("GKP") ?? [])[0];
  if (!keeper) return sorted.slice(0, 11);

  let best: RankedPlayer[] = sorted.slice(0, 11);
  let bestScore = -Infinity;
  for (let defenders = 3; defenders <= 5; defenders += 1) {
    for (let midfielders = 2; midfielders <= 5; midfielders += 1) {
      const forwards = 10 - defenders - midfielders;
      if (forwards < 1 || forwards > 3) continue;
      const def = byPosition.get("DEF") ?? [];
      const mid = byPosition.get("MID") ?? [];
      const fwd = byPosition.get("FWD") ?? [];
      if (
        def.length < defenders ||
        mid.length < midfielders ||
        fwd.length < forwards
      ) continue;
      const xi = [
        keeper,
        ...def.slice(0, defenders),
        ...mid.slice(0, midfielders),
        ...fwd.slice(0, forwards),
      ];
      const score = xi.reduce((sum, player) => sum + player.assistantScore, 0);
      if (score > bestScore) {
        bestScore = score;
        best = xi;
      }
    }
  }
  return best;
}

function scenarioSquad(
  team: TeamAnalysis,
  transfer:
    | { out: RankedPlayer; in: RankedPlayer }
    | null,
) {
  if (!transfer) return team.squad;
  return team.squad.map((player) =>
    player.id === transfer.out.id ? transfer.in : player,
  );
}

function simulateTeamScore(
  team: TeamAnalysis,
  iteration: number,
  transfer: { out: RankedPlayer; in: RankedPlayer } | null,
  captain: RankedPlayer | null,
  cache?: Map<number, number>,
) {
  const squad = scenarioSquad(team, transfer);
  const xi = bestXiFromSquad(squad);
  let score = xi.reduce(
    (sum, player) => sum + simulatedPlayerScore(player, iteration, cache),
    0,
  );
  const captainId =
    captain && squad.some((player) => player.id === captain.id)
      ? captain.id
      : team.recommendedCaptain?.id ?? team.currentCaptain?.id ?? null;
  if (captainId && xi.some((player) => player.id === captainId)) {
    const player = xi.find((item) => item.id === captainId)!;
    score += simulatedPlayerScore(player, iteration, cache);
  }
  return score;
}

function buildCounterPlay(
  managerStanding: LeagueEntry,
  targetStanding: LeagueEntry | null,
  chaserStandings: LeagueEntry[],
  analysis: Awaited<ReturnType<typeof getLeagueManagerEdgeAnalysis>>,
  leagueStrategy: ReturnType<typeof buildLeagueStrategy>,
  localExposure: Map<number, LocalExposure>,
  snapshots: EntrySnapshot[],
  snapshotEvent: number | null,
  resourceMap: Array<{
    standing: LeagueEntry;
    history: Awaited<ReturnType<typeof getRivalResourceHistory>>;
  }>,
  playerDirectory: Map<number, { id: number; name: string; team: string }>,
) {
  const rivalByEntry = new Map(
    analysis.rivals.map((team) => [team.entryId, team]),
  );
  const selectedRivals = [
    targetStanding,
    ...chaserStandings.slice(0, 3),
  ]
    .filter(
      (standing, index, list): standing is LeagueEntry =>
        Boolean(standing) &&
        list.findIndex((item) => item?.entry_id === standing?.entry_id) === index,
    )
    .map((standing) => ({
      standing,
      team: rivalByEntry.get(standing.entry_id) ?? null,
    }))
    .filter(
      (
        item,
      ): item is { standing: LeagueEntry; team: TeamAnalysis } =>
        Boolean(item.team),
    );

  const target =
    targetStanding != null
      ? selectedRivals.find(
          (item) => item.standing.entry_id === targetStanding.entry_id,
        ) ?? null
      : selectedRivals[0] ?? null;
  const primaryChaser =
    chaserStandings.length > 0
      ? selectedRivals.find(
          (item) => item.standing.entry_id === chaserStandings[0].entry_id,
        ) ?? null
      : null;

  const resourceByEntry = new Map(
    resourceMap.map((item) => [item.standing.entry_id, item.history]),
  );
  const rivalVectorMap = new Map<
    number,
    Array<{
      transfer: { out: RankedPlayer; in: RankedPlayer } | null;
      label: string;
      raw_weight: number;
      model_share: number;
    }>
  >();

  for (const rival of selectedRivals) {
    const history = resourceByEntry.get(rival.standing.entry_id) ?? null;
    const moveVectors = rival.team.weakLinks
      .filter(
        (move) =>
          move.replacement &&
          move.timing === "NOW" &&
          move.gain >= move.minimumGain,
      )
      .slice(0, 3)
      .map((move) => ({
        transfer: { out: move.player, in: move.replacement! },
        label: `${move.player.name} → ${move.replacement!.name}`,
        raw_weight: Math.exp(Math.max(-2, Math.min(2, move.gain / 2))),
        model_share: 0,
      }));
    const holdWeight =
      history?.estimatedFreeTransfers != null &&
      history.estimatedFreeTransfers >= 4
        ? 0.7
        : 1.0;
    const vectors = [
      {
        transfer: null,
        label: "HOLD",
        raw_weight: holdWeight,
        model_share: 0,
      },
      ...moveVectors,
    ];
    const totalWeight = vectors.reduce(
      (sum, vector) => sum + vector.raw_weight,
      0,
    );
    rivalVectorMap.set(
      rival.standing.entry_id,
      vectors.map((vector) => ({
        ...vector,
        model_share:
          totalWeight > 0 ? vector.raw_weight / totalWeight : 0,
      })),
    );
  }

  const rivalTransferForIteration = (
    entryId: number,
    iteration: number,
  ) => {
    const vectors = rivalVectorMap.get(entryId) ?? [];
    if (!vectors.length) return null;
    const draw = deterministicUnit(
      (entryId * 83492791) ^ ((iteration + 7) * 2654435761),
    );
    let cumulative = 0;
    for (const vector of vectors) {
      cumulative += vector.model_share;
      if (draw <= cumulative) return vector.transfer;
    }
    return vectors[vectors.length - 1]?.transfer ?? null;
  };

  const candidates: Array<{
    id: string;
    label: string;
    transfer: { out: RankedPlayer; in: RankedPlayer } | null;
    captain: RankedPlayer | null;
    style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
  }> = [
    {
      id: "hold",
      label: "Hold structure",
      transfer: null,
      captain:
        leagueStrategy.captain_moves[0]?.player ??
        analysis.manager.recommendedCaptain ??
        null,
      style: "HOLD",
    },
  ];

  for (const move of leagueStrategy.transfer_moves.slice(0, 3)) {
    const targetOwns = target?.team.squad.some(
      (player) => player.id === move.in.id,
    );
    candidates.push({
      id: `transfer-${move.in.id}`,
      label: `${move.out.name} → ${move.in.name}`,
      transfer: { out: move.out, in: move.in },
      captain:
        leagueStrategy.captain_moves[0]?.player ??
        analysis.manager.recommendedCaptain ??
        null,
      style: targetOwns ? "BLOCK" : "ATTACK",
    });
  }

  for (const captainMove of leagueStrategy.captain_moves.slice(0, 3)) {
    if (
      candidates.some(
        (candidate) =>
          !candidate.transfer && candidate.captain?.id === captainMove.player.id,
      )
    ) continue;
    const targetOwns = target?.team.squad.some(
      (player) => player.id === captainMove.player.id,
    );
    candidates.push({
      id: `captain-${captainMove.player.id}`,
      label: `Captain ${captainMove.player.name}`,
      transfer: null,
      captain: captainMove.player,
      style: targetOwns ? "BLOCK" : "ATTACK",
    });
  }

  const iterations = 10000;
  const results = candidates.map((candidate) => {
    let beatTarget = 0;
    let stayAheadChaser = 0;
    let controlAll = 0;
    let scoreSum = 0;
    let squareSum = 0;
    const managerStart = Number(managerStanding.total ?? 0);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const scoreCache = new Map<number, number>();
      const managerScore = simulateTeamScore(
        analysis.manager,
        iteration,
        candidate.transfer,
        candidate.captain,
        scoreCache,
      );
      scoreSum += managerScore;
      squareSum += managerScore * managerScore;

      let controls = true;
      for (const rival of selectedRivals) {
        const rivalScore = simulateTeamScore(
          rival.team,
          iteration,
          rivalTransferForIteration(rival.standing.entry_id, iteration),
          rival.team.recommendedCaptain ?? rival.team.currentCaptain,
          scoreCache,
        );
        const managerTotal = managerStart + managerScore;
        const rivalTotal = Number(rival.standing.total ?? 0) + rivalScore;
        if (managerTotal <= rivalTotal) controls = false;

        if (
          target &&
          rival.standing.entry_id === target.standing.entry_id &&
          managerTotal > rivalTotal
        ) {
          beatTarget += 1;
        }
        if (
          primaryChaser &&
          rival.standing.entry_id === primaryChaser.standing.entry_id &&
          managerTotal > rivalTotal
        ) {
          stayAheadChaser += 1;
        }
      }
      if (controls) controlAll += 1;
    }

    const mean = scoreSum / iterations;
    const variance = Math.max(0, squareSum / iterations - mean * mean);
    const sd = Math.sqrt(variance);
    const objectiveProbability =
      leagueStrategy.mode === "PROTECT"
        ? primaryChaser
          ? stayAheadChaser / iterations
          : controlAll / iterations
        : target
          ? beatTarget / iterations
          : controlAll / iterations;

    return {
      ...candidate,
      mean_score: mean,
      volatility: sd,
      floor_5: mean - 1.645 * sd,
      ceiling_95: mean + 1.645 * sd,
      beat_target_probability: target ? beatTarget / iterations : null,
      protect_vs_chaser_probability: primaryChaser
        ? stayAheadChaser / iterations
        : null,
      pressure_control_probability: controlAll / iterations,
      objective_probability: objectiveProbability,
    };
  });

  const baseline = results.find((item) => item.id === "hold") ?? results[0];
  const rankedScenarios = results
    .map((result) => {
      const probabilityDelta =
        result.objective_probability - baseline.objective_probability;
      const meanDelta = result.mean_score - baseline.mean_score;
      const reason =
        result.id === "hold"
          ? "Baseline portfolio: current squad structure with Footy's highest-rated available captain."
          : probabilityDelta >= 0.02
            ? `${result.style === "BLOCK" ? "Block" : result.style === "ATTACK" ? "Attack" : "Balanced"} vector raises the league objective by ${(probabilityDelta * 100).toFixed(1)} percentage points while changing expected Gameweek score by ${meanDelta >= 0 ? "+" : ""}${meanDelta.toFixed(1)}.`
            : probabilityDelta <= -0.02
              ? `The move may alter raw expected score by ${meanDelta >= 0 ? "+" : ""}${meanDelta.toFixed(1)}, but its ownership/captain correlation and variance reduce the manager-specific league objective by ${Math.abs(probabilityDelta * 100).toFixed(1)} percentage points.`
              : `League-objective impact is small (${probabilityDelta >= 0 ? "+" : ""}${(probabilityDelta * 100).toFixed(1)}pp); football quality and structural flexibility should break the tie rather than game theory alone.`;
      return {
        ...result,
        probability_delta: probabilityDelta,
        reason,
      };
    })
    .sort((a, b) => {
      const probabilityGap =
        b.objective_probability - a.objective_probability;
      if (Math.abs(probabilityGap) > 0.01) return probabilityGap;

      // If objective probability is effectively tied, strategy mode decides
      // which tail matters. Protecting a lead prefers floor/tighter variance;
      // chasing a gap prefers ceiling/upside. Raw mean only breaks the final tie.
      if (leagueStrategy.mode === "PROTECT") {
        const floorGap = b.floor_5 - a.floor_5;
        if (Math.abs(floorGap) > 0.15) return floorGap;
        const volatilityGap = a.volatility - b.volatility;
        if (Math.abs(volatilityGap) > 0.05) return volatilityGap;
      } else {
        const ceilingGap = b.ceiling_95 - a.ceiling_95;
        if (Math.abs(ceilingGap) > 0.15) return ceilingGap;
      }
      return b.mean_score - a.mean_score;
    });

  const bestScenario = rankedScenarios[0] ?? baseline;
  const bestProbabilityDelta =
    bestScenario?.objective_probability != null && baseline
      ? bestScenario.objective_probability - baseline.objective_probability
      : 0;
  const gameTheoryMagnitude = Math.abs(bestProbabilityDelta);
  const gameTheoryBand =
    gameTheoryMagnitude < 0.01
      ? ("NEUTRAL" as const)
      : gameTheoryMagnitude < 0.03
        ? ("MATERIAL" as const)
        : ("DECISIVE" as const);
  const gameTheoryExplanation =
    gameTheoryBand === "NEUTRAL"
      ? `CounterPlay changes the manager-specific objective by only ${(bestProbabilityDelta * 100).toFixed(1)} percentage points. Football quality, multi-GW value and squad structure should drive the decision.`
      : gameTheoryBand === "MATERIAL"
        ? `CounterPlay moves the manager-specific objective by ${(bestProbabilityDelta * 100).toFixed(1)} percentage points. Use it to break close football calls, not to rescue a weak move.`
        : `CounterPlay moves the manager-specific objective by ${(bestProbabilityDelta * 100).toFixed(1)} percentage points. Rival context is large enough to materially alter which football-qualified option is preferred.`;

  const playerById = new Map<number, RankedPlayer>();
  for (const team of [analysis.manager, ...analysis.rivals]) {
    for (const player of team.squad) playerById.set(player.id, player);
  }

  const localMatrix = [...localExposure.values()]
    .map((item) => ({
      ...item,
      player:
        playerById.get(item.player_id) ??
        playerDirectory.get(item.player_id) ??
        null,
    }))
    .filter((item) => item.player)
    .sort(
      (a, b) =>
        b.effective_exposure - a.effective_exposure ||
        b.squad_ownership - a.squad_ownership,
    );

  const managerIds = new Set(analysis.manager.squad.map((player) => player.id));
  const threatPlayers = selectedRivals
    .flatMap((rival) =>
      rival.team.squad
        .filter((player) => !managerIds.has(player.id))
        .map((player) => {
          const exposure = localExposure.get(player.id);
          const ceiling =
            player.assistantScore + simulationVolatility(player) * 1.65;
          const threatScore = Math.round(
            Math.max(
              0,
              Math.min(
                100,
                player.assistantScore * 6 +
                  ceiling * 2.5 +
                  (exposure?.captain_share ?? 0) * 0.25 +
                  (exposure?.starter_ownership ?? 0) * 0.08,
              ),
            ),
          );
          return {
            rival_entry_id: rival.standing.entry_id,
            rival_name: rival.standing.entry_name,
            player,
            threat_score: threatScore,
            local_exposure: exposure ?? null,
            ceiling_proxy: ceiling,
          };
        }),
    )
    .sort((a, b) => b.threat_score - a.threat_score);

  const snapshotByEntry = new Map(
    snapshots.map((snapshot) => [Number(snapshot.entry_id), snapshot]),
  );

  const rivalVectors = selectedRivals.map((rival) => {
    const history = resourceByEntry.get(rival.standing.entry_id) ?? null;
    const vectors = rivalVectorMap.get(rival.standing.entry_id) ?? [];
    return {
      entry_id: rival.standing.entry_id,
      name: rival.standing.entry_name,
      gap:
        Number(rival.standing.total ?? 0) -
        Number(managerStanding.total ?? 0),
      bank:
        Number(
          snapshotByEntry.get(rival.standing.entry_id)?.entry_history?.bank ?? 0,
        ) / 10,
      estimated_free_transfers: history?.estimatedFreeTransfers ?? null,
      remaining_chips: history?.currentHalfRemaining ?? [],
      activity: history?.activity ?? null,
      transfer_vectors: vectors.map((vector) => ({
        out: vector.transfer?.out ?? null,
        in: vector.transfer?.in ?? null,
        label: vector.label,
        model_share: vector.model_share,
        caveat:
          "Model share is a relative Footy response weight used inside the simulation, not an observed probability of what the rival will do.",
      })),
    };
  });

  return {
    snapshot_event: snapshotEvent,
    managers_in_local_matrix: snapshots.length,
    iterations,
    strategy_mode: leagueStrategy.mode,
    objective:
      leagueStrategy.mode === "PROTECT"
        ? "Maximise probability of staying ahead of the nearest chasing pressure."
        : "Maximise probability of overtaking the nearest target above without ignoring downside from chasers.",
    baseline: baseline
      ? {
          objective_probability: baseline.objective_probability,
          mean_score: baseline.mean_score,
          volatility: baseline.volatility,
          floor_5: baseline.floor_5,
          ceiling_95: baseline.ceiling_95,
        }
      : null,
    game_theory_impact: {
      band: gameTheoryBand,
      probability_delta: bestProbabilityDelta,
      threshold_neutral: 0.01,
      threshold_decisive: 0.03,
      explanation: gameTheoryExplanation,
    },
    scenarios: rankedScenarios.slice(0, 7),
    recommended_scenario: rankedScenarios[0] ?? null,
    local_exposure: localMatrix,
    primary_threats: threatPlayers,
    rival_vectors: rivalVectors,
    caveats: [
      "The 10,000-run simulator is a model distribution, not a guarantee of future results.",
      "Shared players use the same simulated outcome in both squads, preserving ownership correlation rather than drawing them independently.",
      "Local effective exposure is calculated from the latest synced mini-league starting multipliers/captaincy; it is not global effective ownership and it is not a prediction of the next deadline.",
      "Rival HOLD/transfer vectors are model-weighted plausible responses and are sampled inside the simulation; they are not claims about a rival's intent.",
      "When objective probabilities are within one percentage point, PROTECT mode uses downside floor/tighter variance as the tie-break; CHASE/RECOVER uses upside ceiling. Raw expected score only breaks the final tie.",
      "The first CounterPlay release models next-deadline pressure control; 3GW/5GW path simulation is the next extension.",
    ],
  };
}

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


function buildPortfolioPlan(
  analysis: Awaited<ReturnType<typeof getLeagueManagerEdgeAnalysis>>,
  leagueStrategy: ReturnType<typeof buildLeagueStrategy>,
  managerHistory: Awaited<ReturnType<typeof getRivalResourceHistory>> | null,
  resourceAdvice: ReturnType<typeof buildResourceAdvice> | null,
  counterPlay: ReturnType<typeof buildCounterPlay>,
) {
  const portfolio = analysis.manager.portfolio;
  const footballTransfer = leagueStrategy.transfer_moves[0] ?? null;
  const counterScenario = counterPlay.recommended_scenario ?? null;
  const counterTransfer =
    counterScenario?.transfer
      ? leagueStrategy.transfer_moves.find(
          (move) =>
            move.out.id === counterScenario.transfer?.out.id &&
            move.in.id === counterScenario.transfer?.in.id,
        ) ?? null
      : null;
  const impactBand = counterPlay.game_theory_impact.band;
  const materialCloseCall =
    impactBand === "MATERIAL" &&
    footballTransfer &&
    counterTransfer &&
    Math.abs(counterTransfer.raw_gain - footballTransfer.raw_gain) <= 0.75;
  const gameTheoryTiebreak =
    Boolean(counterTransfer) &&
    (impactBand === "DECISIVE" || Boolean(materialCloseCall));
  const transfer =
    gameTheoryTiebreak && counterTransfer
      ? counterTransfer
      : footballTransfer;
  const freeTransfers = managerHistory?.estimatedFreeTransfers ?? null;
  const firstTwoEvents = new Set(
    analysis.futurePlan.slice(0, 2).map((item) => item.name),
  );
  const chipSignal =
    analysis.chipRadar.find(
      (signal) =>
        signal.status === "STRONG" &&
        signal.eventName != null &&
        firstTwoEvents.has(signal.eventName),
    ) ?? null;

  let action:
    | "BANK"
    | "HOLD"
    | "TRANSFER"
    | "STRUCTURAL_REPAIR"
    | "CHIP_PREP";
  if (chipSignal && portfolio.status !== "REPAIR") {
    action = "CHIP_PREP";
  } else if (
    portfolio.status === "REPAIR" ||
    (portfolio.status === "FRAGILE" &&
      (portfolio.reliableBench < 2 ||
        !portfolio.priceStructure.midfieldRoute ||
        !portfolio.priceStructure.forwardRoute))
  ) {
    action = "STRUCTURAL_REPAIR";
  } else if (transfer) {
    action = "TRANSFER";
  } else if (freeTransfers != null && freeTransfers < 5) {
    action = "BANK";
  } else {
    action = "HOLD";
  }

  const hitCostForExtraMove =
    freeTransfers == null ? null : freeTransfers >= 2 ? 0 : 4;
  const captain = leagueStrategy.captain_moves[0]?.player ?? null;

  const why: string[] = [
    ...portfolio.reasons,
    freeTransfers == null
      ? "Free-transfer bank could not be reconstructed with high confidence, so no hit is assumed."
      : `Estimated free transfers: ${freeTransfers}/5. One extra transfer beyond the current bank costs 4 points under standard FPL rules.`,
  ];

  if (transfer) {
    why.push(
      `${transfer.out.name} → ${transfer.in.name} clears the current football threshold: +${transfer.raw_gain.toFixed(1)} immediate model gain versus +${(transfer.minimum_gain ?? 0).toFixed(1)} required, with +${(transfer.horizon_gain ?? 0).toFixed(1)} weighted horizon value.`,
    );
  } else {
    why.push(
      "No current transfer clears Footy's football, timing and transfer-option-value threshold.",
    );
  }

  if (captain) {
    why.push(
      `${captain.name} is the current captain model leader. Official ownership is ${captain.selectedBy.toFixed(1)}%; Footy does not relabel that figure as effective ownership.`,
    );
  }

  why.push(counterPlay.game_theory_impact.explanation);
  if (gameTheoryTiebreak && footballTransfer && transfer) {
    why.push(
      `Game theory acts only as a tie-break between moves that already clear the football threshold: ${transfer.out.name} → ${transfer.in.name} is preferred over ${footballTransfer.out.name} → ${footballTransfer.in.name} in this league context.`,
    );
  }

  const failureModes = [
    ...portfolio.risks,
    analysis.freshness.nearDeadline
      ? "The deadline is close; late official team news can materially change minutes and captaincy."
      : "Fresh team news, role changes, prices or fixture rescheduling can change the portfolio optimum before the deadline.",
  ];

  if (resourceAdvice?.status === "THREAT") {
    failureModes.push(
      "A nearby rival currently has the stronger chip/free-transfer resource position; matching low-quality moves would still be a mistake, but their flexibility raises tactical risk.",
    );
  }

  const differentialGuidance =
    portfolio.differentialCount > 3
      ? "Differential exposure is already high. Do not add another low-ownership player unless the underlying football edge is materially stronger."
      : portfolio.differentialCount >= 2
        ? "Differential allocation is already within the intended 2–3 slot range; add risk selectively."
        : "There is room for a targeted differential, but only where underlying process and fixtures justify it.";

  const headline =
    action === "BANK"
      ? "Bank the transfer"
      : action === "HOLD"
        ? "Hold structure"
        : action === "TRANSFER"
          ? `Transfer: ${transfer?.out.name ?? "out"} → ${transfer?.in.name ?? "in"}`
          : action === "STRUCTURAL_REPAIR"
            ? "Repair the squad structure"
            : `Prepare ${chipSignal?.chip ?? "chip"} window`;

  return {
    action,
    headline,
    decision_driver:
      gameTheoryTiebreak
        ? "GAME_THEORY_TIEBREAK"
        : action === "TRANSFER"
          ? "FOOTBALL_PORTFOLIO"
          : "PORTFOLIO_STRUCTURE",
    game_theory: {
      ...counterPlay.game_theory_impact,
      used_as_tiebreak: gameTheoryTiebreak,
      football_primary_transfer: footballTransfer
        ? {
            out: footballTransfer.out.name,
            in: footballTransfer.in.name,
            raw_gain: footballTransfer.raw_gain,
            horizon_gain: footballTransfer.horizon_gain,
          }
        : null,
      selected_transfer: transfer
        ? {
            out: transfer.out.name,
            in: transfer.in.name,
            raw_gain: transfer.raw_gain,
            horizon_gain: transfer.horizon_gain,
          }
        : null,
    },
    portfolio,
    free_transfers: freeTransfers,
    hit_cost_for_one_extra_move: hitCostForExtraMove,
    chip_signal: chipSignal,
    league_mode: leagueStrategy.mode,
    field_ownership_proxy: {
      average_squad_ownership: portfolio.averageFieldOwnership,
      high_ownership_assets: portfolio.highOwnershipCount,
      differentials_under_10: portfolio.differentialCount,
      caveat:
        "These are official FPL ownership percentages, not true effective ownership. Connected mini-league ownership/captaincy is analysed separately.",
    },
    differential_guidance: differentialGuidance,
    why,
    failure_modes: failureModes,
    underlying: portfolio.underlying,
    missing: portfolio.missing,
    resource_status: resourceAdvice?.status ?? "UNKNOWN",
    caveat:
      "Portfolio action is re-run each deadline. Structural flexibility and free-transfer option value can outweigh a small one-week projected-points edge.",
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
        model_version: "league-edge-v4-portfolio-counterplay",
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

    const [analysis, localSnapshotState, playerDirectory] = await Promise.all([
      getLeagueManagerEdgeAnalysis(
        managerEntryId,
        analysisRivalIds,
      ),
      latestLeagueSnapshots(leagueId),
      localPlayerDirectory(),
    ]);
    const decisionQuality = await decisionQualityHistory(
      leagueId,
      managerEntryId,
      analysis.currentEvent,
    );
    const localExposure = buildLocalExposure(localSnapshotState.snapshots);
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
    const counterPlay = buildCounterPlay(
      managerStanding,
      targetStanding,
      chaserStandings,
      analysis,
      leagueStrategy,
      localExposure,
      localSnapshotState.snapshots,
      localSnapshotState.event,
      resourceMap,
      playerDirectory,
    );
    const portfolioPlan = buildPortfolioPlan(
      analysis,
      leagueStrategy,
      managerHistory,
      resourceAdvice,
      counterPlay,
    );
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
      portfolio_plan: portfolioPlan,
      counterplay: counterPlay,
      decision_quality: decisionQuality,
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
