import { NextResponse } from "next/server";
import {
  getLeagueManagerEdgeAnalysis,
  getRivalResourceHistory,
  type FplVolatilityCalibration,
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

type CounterPosture = "PROTECT" | "HYBRID" | "ATTACK";

type CounterWhatIfRequest = {
  outId: number | null;
  inId: number | null;
  captainId: number | null;
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

function calibrationReliabilityBucket(player: RankedPlayer) {
  if (player.startReliability >= 0.80) return "HIGH";
  if (player.startReliability >= 0.45) return "MIXED";
  return "LOW";
}

function calibrationProfile(
  player: RankedPlayer,
  calibration: FplVolatilityCalibration | null | undefined,
) {
  if (!calibration) return null;
  return (
    calibration.profiles[
      player.position + "_" + calibrationReliabilityBucket(player)
    ] ??
    calibration.profiles[player.position + "_ALL"] ??
    calibration.profiles.GLOBAL ??
    null
  );
}

function calibrationModifier(
  calibration: FplVolatilityCalibration | null | undefined,
  family: keyof FplVolatilityCalibration["modifiers"],
  band: string,
) {
  return calibration?.modifiers?.[family]?.[band]?.multiplier ?? 1;
}

function simulationVolatility(
  player: RankedPlayer,
  calibration?: FplVolatilityCalibration | null,
) {
  const profile = calibrationProfile(player, calibration);
  if (profile) {
    let scale = Math.max(0.75, Number(profile.residual_sd) || 0.75);

    if (player.position === "MID" || player.position === "FWD") {
      const xgiBand =
        player.xgiPer90 >= 0.45 ? "HIGH" : player.xgiPer90 >= 0.20 ? "MID" : "LOW";
      scale *= calibrationModifier(calibration, "xgi", xgiBand);
    }

    const minuteBand =
      player.recentMinutesSd >= 28 ? "UNSTABLE" : "STABLE";
    scale *= calibrationModifier(
      calibration,
      "minute_stability",
      minuteBand,
    );

    const bonusPer90 =
      player.minutes > 0 ? (player.bonus * 90) / player.minutes : 0;
    scale *= calibrationModifier(
      calibration,
      "bonus",
      bonusPer90 >= 0.45 ? "HIGH" : "LOW",
    );

    if (player.position === "GKP" || player.position === "DEF") {
      const cleanSheetRate =
        player.starts > 0 ? player.cleanSheets / player.starts : 0;
      const cleanSheetBand =
        cleanSheetRate >= 0.40
          ? "HIGH"
          : cleanSheetRate >= 0.20
            ? "MID"
            : "LOW";
      scale *= calibrationModifier(
        calibration,
        "clean_sheet",
        cleanSheetBand,
      );
    }

    return Math.max(0.75, Math.min(6.8, scale));
  }

  const rotationRisk = 1 - Math.max(0, Math.min(1, player.startReliability));
  const attackingVariance =
    player.position === "MID" || player.position === "FWD"
      ? player.xgiPer90 * 2.3
      : player.xgiPer90 * 1.35;
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

const EMPIRICAL_QUANTILE_POINTS = [
  [0.01, "q01"],
  [0.05, "q05"],
  [0.10, "q10"],
  [0.25, "q25"],
  [0.50, "q50"],
  [0.75, "q75"],
  [0.90, "q90"],
  [0.95, "q95"],
  [0.99, "q99"],
] as const;

function empiricalStandardShock(
  player: RankedPlayer,
  seed: number,
  calibration?: FplVolatilityCalibration | null,
) {
  const profile = calibrationProfile(player, calibration);
  if (!profile) return normalFromSeed(seed);

  const quantiles = profile.standardized_quantiles ?? {};
  const draw = Math.max(0.01, Math.min(0.99, deterministicUnit(seed)));
  let previous: (typeof EMPIRICAL_QUANTILE_POINTS)[number] =
    EMPIRICAL_QUANTILE_POINTS[0];
  for (const point of EMPIRICAL_QUANTILE_POINTS.slice(1)) {
    if (draw <= point[0]) {
      const low = Number(quantiles[previous[1]]);
      const high = Number(quantiles[point[1]]);
      if (!Number.isFinite(low) || !Number.isFinite(high)) {
        return normalFromSeed(seed);
      }
      const span = point[0] - previous[0];
      const weight = span > 0 ? (draw - previous[0]) / span : 0;
      return low + (high - low) * weight;
    }
    previous = point;
  }
  const fallback = Number(quantiles.q99);
  return Number.isFinite(fallback) ? fallback : normalFromSeed(seed);
}

function sampleQuantile(values: number[], probability: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function simulatedPlayerScore(
  player: RankedPlayer,
  iteration: number,
  cache?: Map<number, number>,
  calibration?: FplVolatilityCalibration | null,
) {
  const cached = cache?.get(player.id);
  if (cached != null) return cached;
  const seed = (player.id * 73856093) ^ ((iteration + 1) * 19349663);
  const sd = simulationVolatility(player, calibration);
  const shock = empiricalStandardShock(player, seed, calibration);
  const score = Math.max(-8, player.assistantScore + shock * sd);
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

type CounterHorizonScore = {
  score: number;
  fixtureCount: number;
  availability: number;
};

function bestXiFromHorizonScores(
  squad: RankedPlayer[],
  scores: Map<number, CounterHorizonScore>,
) {
  const expected = (player: RankedPlayer) => scores.get(player.id)?.score ?? 0;
  const sorted = [...squad].sort((a, b) => expected(b) - expected(a));
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
      const score = xi.reduce((sum, player) => sum + expected(player), 0);
      if (score > bestScore) {
        bestScore = score;
        best = xi;
      }
    }
  }
  return best;
}

function simulatedHorizonPlayerScore(
  player: RankedPlayer,
  mean: number,
  fixtureCount: number,
  eventId: number,
  iteration: number,
  cache: Map<string, number>,
  calibration?: FplVolatilityCalibration | null,
) {
  const key = eventId + ":" + player.id;
  const cached = cache.get(key);
  if (cached != null) return cached;
  const seed =
    (player.id * 73856093) ^
    ((iteration + 1) * 19349663) ^
    (eventId * 83492791);
  const sd =
    simulationVolatility(player, calibration) *
    Math.sqrt(Math.max(1, fixtureCount));
  const shock = empiricalStandardShock(player, seed, calibration);
  const score = Math.max(-8, mean + shock * sd);
  cache.set(key, score);
  return score;
}

function horizonTeamPlan(
  team: TeamAnalysis,
  transfer: { out: RankedPlayer; in: RankedPlayer } | null,
  scores: Map<number, CounterHorizonScore>,
  preferredCaptainId: number | null,
) {
  const squad = scenarioSquad(team, transfer);
  const xi = bestXiFromHorizonScores(squad, scores);
  const expected = (player: RankedPlayer) => scores.get(player.id)?.score ?? 0;
  const preferred =
    preferredCaptainId != null
      ? xi.find((player) => player.id === preferredCaptainId) ?? null
      : null;
  const captain =
    preferred ??
    [...xi].sort((a, b) => expected(b) - expected(a))[0] ??
    null;
  return { xi, captain };
}

function simulateHorizonPlan(
  plan: { xi: RankedPlayer[]; captain: RankedPlayer | null },
  scores: Map<number, CounterHorizonScore>,
  eventId: number,
  iteration: number,
  cache: Map<string, number>,
) {
  let total = 0;
  for (const player of plan.xi) {
    const item = scores.get(player.id);
    total += simulatedHorizonPlayerScore(
      player,
      item?.score ?? 0,
      item?.fixtureCount ?? 0,
      eventId,
      iteration,
      cache,
    );
  }
  if (plan.captain) {
    const item = scores.get(plan.captain.id);
    total += simulatedHorizonPlayerScore(
      plan.captain,
      item?.score ?? 0,
      item?.fixtureCount ?? 0,
      eventId,
      iteration,
      cache,
    );
  }
  return total;
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
  calibration?: FplVolatilityCalibration | null,
) {
  const squad = scenarioSquad(team, transfer);
  const xi = bestXiFromSquad(squad);
  let score = xi.reduce(
    (sum, player) =>
      sum + simulatedPlayerScore(player, iteration, cache, calibration),
    0,
  );
  const captainId =
    captain && squad.some((player) => player.id === captain.id)
      ? captain.id
      : team.recommendedCaptain?.id ?? team.currentCaptain?.id ?? null;
  if (captainId && xi.some((player) => player.id === captainId)) {
    const player = xi.find((item) => item.id === captainId)!;
    score += simulatedPlayerScore(player, iteration, cache, calibration);
  }
  return score;
}

function counterObjectiveProbability(
  posture: CounterPosture,
  attackProbability: number | null,
  protectProbability: number | null,
  controlProbability: number,
) {
  if (posture === "PROTECT") return protectProbability ?? controlProbability;
  if (posture === "ATTACK") return attackProbability ?? controlProbability;
  // HYBRID rewards plans that are simultaneously strong above and below.
  // The geometric mean penalises a path that achieves one side by giving away
  // too much on the other, unlike a simple midpoint average.
  if (attackProbability != null && protectProbability != null) {
    return Math.sqrt(
      Math.max(0, attackProbability) * Math.max(0, protectProbability),
    );
  }
  return attackProbability ?? protectProbability ?? controlProbability;
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
  posture: CounterPosture,
  postureSource: "USER" | "INFERRED",
  whatIfRequest: CounterWhatIfRequest | null,
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
      : null;
  const primaryChaser =
    chaserStandings.length > 0
      ? selectedRivals.find(
          (item) => item.standing.entry_id === chaserStandings[0].entry_id,
        ) ?? null
      : null;

  const resourceByEntry = new Map(
    resourceMap.map((item) => [item.standing.entry_id, item.history]),
  );
  const snapshotByEntry = new Map(
    snapshots.map((snapshot) => [Number(snapshot.entry_id), snapshot]),
  );
  const rivalVectorMap = new Map<
    number,
    Array<{
      transfer: { out: RankedPlayer; in: RankedPlayer } | null;
      label: string;
      raw_weight: number;
      model_share: number;
      drivers: string[];
      affordability_margin: number | null;
    }>
  >();

  for (const rival of selectedRivals) {
    const history = resourceByEntry.get(rival.standing.entry_id) ?? null;
    const snapshot = snapshotByEntry.get(rival.standing.entry_id) ?? null;
    const bank = Number(snapshot?.entry_history?.bank ?? 0) / 10;
    const freeTransfers = history?.estimatedFreeTransfers ?? 1;
    const activity = history?.activity ?? "PATIENT";
    const portfolioStatus = rival.team.portfolio.status;
    const hasReshapeChip = Boolean(
      history?.currentHalfRemaining.some(
        (chip) => chip === "Wildcard" || chip === "Free Hit",
      ),
    );

    const activityAdjustment =
      activity === "AGGRESSIVE" ? 0.42 : activity === "ACTIVE" ? 0.18 : -0.18;
    const freeTransferAdjustment =
      freeTransfers >= 4 ? 0.52 : freeTransfers >= 2 ? 0.24 : 0;
    const structureAdjustment =
      portfolioStatus === "REPAIR"
        ? 0.42
        : portfolioStatus === "FRAGILE"
          ? 0.22
          : portfolioStatus === "STRONG"
            ? -0.16
            : 0;
    const recentHitAdjustment =
      (history?.recentHitCost ?? 0) >= 8
        ? 0.18
        : (history?.recentHitCost ?? 0) >= 4
          ? 0.08
          : 0;

    const moveVectors = rival.team.weakLinks
      .filter(
        (move) =>
          move.replacement &&
          move.timing === "NOW" &&
          move.gain >= move.minimumGain,
      )
      .map((move) => {
        const replacement = move.replacement!;
        const affordabilityMargin =
          move.player.price + bank - replacement.price;
        if (affordabilityMargin < -0.001) return null;

        const exposure = localExposure.get(replacement.id);
        const edgeAboveThreshold = Math.max(
          0,
          move.gain - move.minimumGain,
        );
        const edgeAdjustment = Math.min(
          1.0,
          0.18 + edgeAboveThreshold * 0.34 + Math.max(0, move.gain) * 0.07,
        );
        const affordabilityAdjustment =
          affordabilityMargin >= 1.0
            ? 0.12
            : affordabilityMargin >= 0.3
              ? 0.06
              : affordabilityMargin <= 0.05
                ? -0.08
                : 0;
        const ownershipAdjustment =
          replacement.selectedBy >= 25
            ? 0.16
            : replacement.selectedBy >= 10
              ? 0.07
              : replacement.selectedBy < 5
                ? -0.05
                : 0;
        const momentumAdjustment = Math.max(
          -0.08,
          Math.min(0.16, replacement.transfersNet / 750000),
        );
        const localTemplateAdjustment = exposure
          ? Math.min(
              0.18,
              exposure.starter_ownership * 0.0015 +
                exposure.captain_share * 0.0006,
            )
          : 0;

        const logWeight =
          edgeAdjustment +
          activityAdjustment +
          freeTransferAdjustment +
          structureAdjustment +
          recentHitAdjustment +
          affordabilityAdjustment +
          ownershipAdjustment +
          momentumAdjustment +
          localTemplateAdjustment;

        const drivers = [
          `football edge +${move.gain.toFixed(1)} vs +${move.minimumGain.toFixed(1)} threshold`,
          `${freeTransfers}/5 estimated FT`,
          `£${bank.toFixed(1)}m ITB; £${Math.max(0, affordabilityMargin).toFixed(1)}m after move`,
          `${activity.toLowerCase()} recent transfer behaviour`,
          `${portfolioStatus.toLowerCase()} squad structure`,
        ];
        if (replacement.selectedBy >= 10) {
          drivers.push(
            `${replacement.selectedBy.toFixed(1)}% official ownership template pressure`,
          );
        }
        if (replacement.transfersNet > 50000) {
          drivers.push(
            `+${Math.round(replacement.transfersNet / 1000)}k net public transfers`,
          );
        }
        if ((exposure?.starter_ownership ?? 0) >= 35) {
          drivers.push(
            `${exposure!.starter_ownership.toFixed(0)}% local starter exposure`,
          );
        }

        return {
          transfer: { out: move.player, in: replacement },
          label: `${move.player.name} → ${replacement.name}`,
          raw_weight: Math.exp(Math.max(-3, Math.min(3, logWeight))),
          model_share: 0,
          drivers,
          affordability_margin: affordabilityMargin,
        };
      })
      .filter(
        (
          vector,
        ): vector is {
          transfer: { out: RankedPlayer; in: RankedPlayer };
          label: string;
          raw_weight: number;
          model_share: number;
          drivers: string[];
          affordability_margin: number;
        } => Boolean(vector),
      )
      .sort((a, b) => b.raw_weight - a.raw_weight)
      .slice(0, 4);

    let holdLogWeight = 0;
    holdLogWeight +=
      activity === "PATIENT" ? 0.42 : activity === "AGGRESSIVE" ? -0.35 : 0;
    holdLogWeight +=
      freeTransfers <= 1 ? 0.24 : freeTransfers >= 4 ? -0.48 : freeTransfers >= 3 ? -0.2 : 0;
    holdLogWeight +=
      portfolioStatus === "STRONG"
        ? 0.24
        : portfolioStatus === "REPAIR"
          ? -0.46
          : portfolioStatus === "FRAGILE"
            ? -0.20
            : 0;

    const holdDrivers = [
      `${freeTransfers}/5 estimated FT`,
      `${activity.toLowerCase()} recent transfer behaviour`,
      `${portfolioStatus.toLowerCase()} squad structure`,
    ];
    if (hasReshapeChip) {
      holdDrivers.push(
        "Wildcard/Free Hit resource increases response uncertainty",
      );
    }

    const vectors = [
      {
        transfer: null,
        label: "HOLD",
        raw_weight: Math.exp(Math.max(-3, Math.min(3, holdLogWeight))),
        model_share: 0,
        drivers: holdDrivers,
        affordability_margin: null,
      },
      ...moveVectors,
    ];

    // A live WC/FH resource means our single-transfer response set is
    // incomplete. Flatten the distribution instead of pretending the missing
    // chip branch makes any specific transfer more likely.
    const temperature = hasReshapeChip ? 1.18 : 1.0;
    const temperedWeights = vectors.map((vector) =>
      Math.pow(vector.raw_weight, 1 / temperature),
    );
    const totalWeight = temperedWeights.reduce((sum, weight) => sum + weight, 0);

    rivalVectorMap.set(
      rival.standing.entry_id,
      vectors.map((vector, index) => ({
        ...vector,
        model_share:
          totalWeight > 0 ? temperedWeights[index] / totalWeight : 0,
      })),
    );
  }

  const rivalVectorForIteration = (
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
      if (draw <= cumulative) return vector;
    }
    return vectors[vectors.length - 1] ?? null;
  };
  const rivalTransferForIteration = (
    entryId: number,
    iteration: number,
  ) => rivalVectorForIteration(entryId, iteration)?.transfer ?? null;

  const whatIfPool = new Map<number, RankedPlayer>();
  for (const player of analysis.counterPlayTransferPool ?? []) {
    whatIfPool.set(player.id, player);
  }
  for (const move of analysis.manager.weakLinks) {
    if (move.replacement) whatIfPool.set(move.replacement.id, move.replacement);
  }

  const whatIfOptions = {
    bank: analysis.manager.bank,
    squad: analysis.manager.squad.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.position,
      price: player.price,
      score: player.assistantScore,
    })),
    replacement_pool: [...whatIfPool.values()]
      .filter(
        (player) =>
          !analysis.manager.squad.some((owned) => owned.id === player.id) &&
          player.availability >= 75 &&
          player.price > 0,
      )
      .sort(
        (a, b) =>
          b.assistantScore - a.assistantScore ||
          b.valueScore - a.valueScore,
      )
      .slice(0, 60)
      .map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        price: player.price,
        score: player.assistantScore,
        selected_by: player.selectedBy,
      })),
  };

  let whatIfStatus:
    | {
        status: "IDLE";
        error: null;
        selection: null;
      }
    | {
        status: "INVALID";
        error: string;
        selection: {
          out_id: number | null;
          in_id: number | null;
          captain_id: number | null;
        };
      }
    | {
        status: "VALID";
        error: null;
        selection: {
          out_id: number | null;
          in_id: number | null;
          captain_id: number | null;
        };
      } = {
    status: "IDLE",
    error: null,
    selection: null,
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
    const chaserOwns = primaryChaser?.team.squad.some(
      (player) => player.id === move.in.id,
    );
    const candidateStyle =
      target
        ? targetOwns
          ? ("BLOCK" as const)
          : ("ATTACK" as const)
        : primaryChaser
          ? chaserOwns
            ? ("BLOCK" as const)
            : ("BALANCED" as const)
          : ("BALANCED" as const);
    candidates.push({
      id: `transfer-${move.in.id}`,
      label: `${move.out.name} → ${move.in.name}`,
      transfer: { out: move.out, in: move.in },
      captain:
        leagueStrategy.captain_moves[0]?.player ??
        analysis.manager.recommendedCaptain ??
        null,
      style: candidateStyle,
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
    const chaserOwns = primaryChaser?.team.squad.some(
      (player) => player.id === captainMove.player.id,
    );
    const candidateStyle =
      target
        ? targetOwns
          ? ("BLOCK" as const)
          : ("ATTACK" as const)
        : primaryChaser
          ? chaserOwns
            ? ("BLOCK" as const)
            : ("BALANCED" as const)
          : ("BALANCED" as const);
    candidates.push({
      id: `captain-${captainMove.player.id}`,
      label: `Captain ${captainMove.player.name}`,
      transfer: null,
      captain: captainMove.player,
      style: candidateStyle,
    });
  }

  if (whatIfRequest) {
    const selection = {
      out_id: whatIfRequest.outId,
      in_id: whatIfRequest.inId,
      captain_id: whatIfRequest.captainId,
    };
    let customTransfer: { out: RankedPlayer; in: RankedPlayer } | null = null;
    let customSquad = [...analysis.manager.squad];
    let validationError: string | null = null;

    if (
      (whatIfRequest.outId == null) !==
      (whatIfRequest.inId == null)
    ) {
      validationError =
        "Choose both a player out and a replacement, or leave both blank.";
    } else if (
      whatIfRequest.outId != null &&
      whatIfRequest.inId != null
    ) {
      const out = analysis.manager.squad.find(
        (player) => player.id === whatIfRequest.outId,
      );
      const incoming = whatIfPool.get(whatIfRequest.inId);
      if (!out || !incoming) {
        validationError =
          "That transfer is no longer available in the current CounterPlay pool.";
      } else if (out.position !== incoming.position) {
        validationError = "What-If transfers must keep the same FPL position.";
      } else if (
        analysis.manager.squad.some((player) => player.id === incoming.id)
      ) {
        validationError = "The replacement is already in your squad.";
      } else if (
        incoming.price >
        out.price + analysis.manager.bank + 0.001
      ) {
        validationError =
          "That replacement is outside the current listed-price budget.";
      } else {
        const clubCounts = new Map<string, number>();
        for (const player of analysis.manager.squad) {
          if (player.id === out.id) continue;
          clubCounts.set(
            player.team,
            (clubCounts.get(player.team) ?? 0) + 1,
          );
        }
        if ((clubCounts.get(incoming.team) ?? 0) >= 3) {
          validationError =
            "That transfer would exceed the three-player club limit.";
        } else {
          customTransfer = { out, in: incoming };
          customSquad = analysis.manager.squad.map((player) =>
            player.id === out.id ? incoming : player,
          );
        }
      }
    }

    const customCaptain =
      whatIfRequest.captainId == null
        ? leagueStrategy.captain_moves[0]?.player ??
          analysis.manager.recommendedCaptain ??
          null
        : customSquad.find(
            (player) => player.id === whatIfRequest.captainId,
          ) ?? null;

    if (
      !validationError &&
      whatIfRequest.captainId != null &&
      !customCaptain
    ) {
      validationError =
        "The selected captain is not in the post-transfer squad.";
    }
    if (
      !validationError &&
      !customTransfer &&
      whatIfRequest.captainId == null
    ) {
      validationError =
        "Choose a transfer, a captain change, or both before running What-If.";
    }

    if (validationError) {
      whatIfStatus = {
        status: "INVALID",
        error: validationError,
        selection,
      };
    } else {
      const comparisonPlayer = customTransfer?.in ?? customCaptain;
      const targetOwns =
        comparisonPlayer != null &&
        target?.team.squad.some(
          (player) => player.id === comparisonPlayer.id,
        );
      const chaserOwns =
        comparisonPlayer != null &&
        primaryChaser?.team.squad.some(
          (player) => player.id === comparisonPlayer.id,
        );
      const customStyle =
        target
          ? targetOwns
            ? ("BLOCK" as const)
            : ("ATTACK" as const)
          : primaryChaser
            ? chaserOwns
              ? ("BLOCK" as const)
              : ("BALANCED" as const)
            : ("BALANCED" as const);

      candidates.push({
        id: "what-if",
        label: customTransfer
          ? customTransfer.out.name +
            " → " +
            customTransfer.in.name +
            (customCaptain
              ? " · C " + customCaptain.name
              : "")
          : "Captain " + (customCaptain?.name ?? "custom option"),
        transfer: customTransfer,
        captain: customCaptain,
        style: customStyle,
      });
      whatIfStatus = {
        status: "VALID",
        error: null,
        selection,
      };
    }
  }

  const iterations = 10000;
  const results = candidates.map((candidate) => {
    let beatTarget = 0;
    let stayAheadChaser = 0;
    let controlAll = 0;
    let scoreSum = 0;
    let squareSum = 0;
    const scoreSamples: number[] = [];
    const managerStart = Number(managerStanding.total ?? 0);

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const scoreCache = new Map<number, number>();
      const managerScore = simulateTeamScore(
        analysis.manager,
        iteration,
        candidate.transfer,
        candidate.captain,
        scoreCache,
        analysis.volatilityCalibration,
      );
      scoreSamples.push(managerScore);
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
          analysis.volatilityCalibration,
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
    const attackProbability = target
      ? beatTarget / iterations
      : null;
    const protectProbability = primaryChaser
      ? stayAheadChaser / iterations
      : null;
    const controlProbability = controlAll / iterations;
    const objectiveProbability = counterObjectiveProbability(
      posture,
      attackProbability,
      protectProbability,
      controlProbability,
    );

    return {
      ...candidate,
      mean_score: mean,
      volatility: sd,
      floor_5: sampleQuantile(scoreSamples, 0.05),
      ceiling_95: sampleQuantile(scoreSamples, 0.95),
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

      // Posture only breaks close, football-qualified calls.
      if (posture === "PROTECT") {
        const floorGap = b.floor_5 - a.floor_5;
        if (Math.abs(floorGap) > 0.15) return floorGap;
        const volatilityGap = a.volatility - b.volatility;
        if (Math.abs(volatilityGap) > 0.05) return volatilityGap;
      } else if (posture === "ATTACK") {
        const ceilingGap = b.ceiling_95 - a.ceiling_95;
        if (Math.abs(ceilingGap) > 0.15) return ceilingGap;
      } else {
        const meanGap = b.mean_score - a.mean_score;
        if (Math.abs(meanGap) > 0.15) return meanGap;
        const floorGap = b.floor_5 - a.floor_5;
        if (Math.abs(floorGap) > 0.15) return floorGap;
      }
      return b.mean_score - a.mean_score;
    });

  const recommendationScenarios = rankedScenarios.filter(
    (scenario) => scenario.id !== "what-if",
  );
  const whatIfNextGameweek =
    rankedScenarios.find((scenario) => scenario.id === "what-if") ?? null;
  const bestScenario = recommendationScenarios[0] ?? baseline;
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

  const horizonEvents = analysis.counterPlayHorizon.slice(0, 5).map((event) => ({
    eventId: event.eventId,
    name: event.name,
    scores: new Map<number, CounterHorizonScore>(
      event.scores.map((item) => [
        item.id,
        {
          score: item.score,
          fixtureCount: item.fixtureCount,
          availability: item.availability,
        },
      ]),
    ),
  }));
  const horizonLengths = [1, 3, 5].filter(
    (length) => length <= horizonEvents.length,
  );
  const pathIterations = 10000;

  type PathTransfer = {
    out: RankedPlayer;
    in: RankedPlayer;
    gain: number;
  };
  type PathWeek = {
    event_id: number;
    event_name: string;
    squad: RankedPlayer[];
    xi: RankedPlayer[];
    captain: RankedPlayer | null;
    chip: string | null;
    transfers: PathTransfer[];
    hit_cost: number;
    free_transfers_before: number;
    free_transfers_after: number;
    bank_before: number;
    bank_after: number;
    mean_score: number;
  };
  type StatefulPath = {
    starting_free_transfers: number;
    starting_bank: number;
    starting_chips: string[];
    weeks: PathWeek[];
    ending_free_transfers: number;
    ending_bank: number;
    remaining_chips: string[];
  };

  const playerPool = new Map<number, RankedPlayer>();
  for (const player of analysis.counterPlayTransferPool ?? []) {
    playerPool.set(player.id, player);
  }
  for (const team of [analysis.manager, ...analysis.rivals]) {
    for (const player of team.squad) playerPool.set(player.id, player);
    for (const move of team.weakLinks) {
      if (move.replacement) playerPool.set(move.replacement.id, move.replacement);
    }
  }

  const chipKey = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const chipLabel = (value: string) => {
    const key = chipKey(value);
    if (key === "triplecaptain" || key === "3xc") return "Triple Captain";
    if (key === "benchboost" || key === "bboost") return "Bench Boost";
    if (key === "freehit") return "Free Hit";
    if (key === "wildcard") return "Wildcard";
    return value;
  };
  const hasChip = (chips: Set<string>, label: string) =>
    [...chips].some((chip) => chipKey(chip) === chipKey(label));
  const removeChip = (chips: Set<string>, label: string) => {
    const match = [...chips].find((chip) => chipKey(chip) === chipKey(label));
    if (match) chips.delete(match);
  };

  const eventScore = (eventIndex: number, playerId: number) =>
    horizonEvents[eventIndex]?.scores.get(playerId)?.score ?? 0;

  const weightedTransferGain = (
    out: RankedPlayer,
    incoming: RankedPlayer,
    eventIndex: number,
  ) => {
    const weights = [1, 0.82, 0.62];
    let gain = 0;
    for (let offset = 0; offset < weights.length; offset += 1) {
      if (!horizonEvents[eventIndex + offset]) break;
      gain +=
        (eventScore(eventIndex + offset, incoming.id) -
          eventScore(eventIndex + offset, out.id)) *
        weights[offset];
    }
    return gain;
  };

  const transferIsLegal = (
    squad: RankedPlayer[],
    bank: number,
    out: RankedPlayer,
    incoming: RankedPlayer,
  ) => {
    if (!squad.some((player) => player.id === out.id)) return false;
    if (out.position !== incoming.position) return false;
    if (squad.some((player) => player.id === incoming.id)) return false;
    if (incoming.price > out.price + bank + 0.001) return false;
    const clubCounts = new Map<string, number>();
    for (const player of squad) {
      if (player.id === out.id) continue;
      clubCounts.set(player.team, (clubCounts.get(player.team) ?? 0) + 1);
    }
    return (clubCounts.get(incoming.team) ?? 0) < 3;
  };

  const bestFutureTransfer = (
    squad: RankedPlayer[],
    bank: number,
    eventIndex: number,
  ): PathTransfer | null => {
    let best: PathTransfer | null = null;
    for (const out of squad) {
      for (const incoming of playerPool.values()) {
        if (!transferIsLegal(squad, bank, out, incoming)) continue;
        const gain = weightedTransferGain(out, incoming, eventIndex);
        if (!best || gain > best.gain) best = { out, in: incoming, gain };
      }
    }
    return best;
  };

  const applyTransfer = (
    squad: RankedPlayer[],
    bank: number,
    transfer: PathTransfer,
  ) => ({
    squad: squad.map((player) =>
      player.id === transfer.out.id ? transfer.in : player,
    ),
    // Public entry data does not expose exact selling-price profit for every
    // squad snapshot, so path cash uses current listed prices as an explicit
    // approximation rather than inventing purchase-price history.
    bank: Math.max(
      0,
      bank + transfer.out.price - transfer.in.price,
    ),
  });

  const selectFutureTransfers = (
    squadInput: RankedPlayer[],
    bankInput: number,
    freeTransfers: number,
    eventIndex: number,
    style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED",
    activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT" | null,
  ) => {
    let squad = [...squadInput];
    let bank = bankInput;
    const transfers: PathTransfer[] = [];
    const activityAdjustment =
      activity === "AGGRESSIVE" ? -0.25 : activity === "PATIENT" ? 0.30 : 0;
    const styleThreshold =
      style === "ATTACK"
        ? 0.95
        : style === "BLOCK"
          ? 1.25
          : style === "HOLD"
            ? 1.45
            : 1.20;
    const bankPressure = freeTransfers >= 4 ? -0.35 : 0;
    const paidSecondMoveIsPlausible =
      freeTransfers === 1 &&
      (style === "ATTACK" || activity === "AGGRESSIVE");
    const maxMoves =
      freeTransfers >= 3
        ? 2
        : freeTransfers >= 2 && (style === "ATTACK" || activity === "AGGRESSIVE")
          ? 2
          : paidSecondMoveIsPlausible
            ? 2
            : 1;

    for (let moveIndex = 0; moveIndex < maxMoves; moveIndex += 1) {
      const best = bestFutureTransfer(squad, bank, eventIndex);
      if (!best) break;
      const paidMove = moveIndex >= freeTransfers;
      const threshold =
        styleThreshold +
        activityAdjustment +
        bankPressure +
        (moveIndex > 0 ? 0.45 : 0) +
        (paidMove ? 4.25 : 0);
      if (best.gain < threshold) break;
      const applied = applyTransfer(squad, bank, best);
      squad = applied.squad;
      bank = applied.bank;
      transfers.push(best);
    }

    return { squad, bank, transfers };
  };

  const planFromSquad = (
    squad: RankedPlayer[],
    scores: Map<number, CounterHorizonScore>,
    preferredCaptainId: number | null,
  ) => {
    const xi = bestXiFromHorizonScores(squad, scores);
    const expected = (player: RankedPlayer) => scores.get(player.id)?.score ?? 0;
    const preferred =
      preferredCaptainId != null
        ? xi.find((player) => player.id === preferredCaptainId) ?? null
        : null;
    const captain =
      preferred ??
      [...xi].sort((a, b) => expected(b) - expected(a))[0] ??
      null;
    return { xi, captain };
  };

  const chipSquadScore = (
    squad: RankedPlayer[],
    eventIndex: number,
    chip: "Wildcard" | "Free Hit",
  ) => {
    const offsets =
      chip === "Free Hit"
        ? [0]
        : [0, 1, 2, 3, 4].filter(
            (offset) => horizonEvents[eventIndex + offset],
          );
    const weights = [1, 0.84, 0.69, 0.56, 0.45];
    let total = 0;
    for (const offset of offsets) {
      const event = horizonEvents[eventIndex + offset];
      if (!event) continue;
      const plan = planFromSquad(squad, event.scores, null);
      const xiScore = expectedPlanScore(
        squad,
        plan.xi,
        plan.captain,
        event.scores,
        null,
      );
      const bench = squad.filter(
        (player) => !plan.xi.some((starter) => starter.id === player.id),
      );
      const benchDepth = bench.reduce(
        (sum, player) => sum + (event.scores.get(player.id)?.score ?? 0),
        0,
      );
      const depthWeight = chip === "Wildcard" ? 0.10 : 0.02;
      total += (xiScore + benchDepth * depthWeight) * weights[offset];
    }
    return total;
  };

  const optimizeChipSquad = (
    currentSquad: RankedPlayer[],
    bank: number,
    eventIndex: number,
    chip: "Wildcard" | "Free Hit",
  ) => {
    const budget =
      currentSquad.reduce((sum, player) => sum + player.price, 0) +
      Math.max(0, bank);
    const required: Record<string, number> = {
      GKP: 2,
      DEF: 5,
      MID: 5,
      FWD: 3,
    };
    const slotWeights: Record<string, number[]> = {
      GKP: [1, 0.18],
      DEF: [1, 1, 1, 0.72, 0.30],
      MID: [1, 1, 1, 0.90, 0.30],
      FWD: [1, 1, 0.72],
    };
    const poolByPosition = new Map<string, RankedPlayer[]>();
    for (const position of Object.keys(required)) {
      const candidates = [...playerPool.values()]
        .filter(
          (player) =>
            player.position === position &&
            player.price > 0 &&
            player.availability >= 75 &&
            horizonEvents[eventIndex]?.scores.has(player.id),
        )
        .sort((a, b) => {
          const scoreA =
            chip === "Free Hit"
              ? eventScore(eventIndex, a.id)
              : [0, 1, 2, 3, 4].reduce(
                  (sum, offset) =>
                    sum +
                    (horizonEvents[eventIndex + offset]
                      ? eventScore(eventIndex + offset, a.id) *
                        [1, 0.84, 0.69, 0.56, 0.45][offset]
                      : 0),
                  0,
                );
          const scoreB =
            chip === "Free Hit"
              ? eventScore(eventIndex, b.id)
              : [0, 1, 2, 3, 4].reduce(
                  (sum, offset) =>
                    sum +
                    (horizonEvents[eventIndex + offset]
                      ? eventScore(eventIndex + offset, b.id) *
                        [1, 0.84, 0.69, 0.56, 0.45][offset]
                      : 0),
                  0,
                );
          return scoreB - scoreA || a.price - b.price;
        })
        .slice(0, position === "GKP" ? 10 : 18);
      poolByPosition.set(position, candidates);
    }

    if (
      [...Object.entries(required)].some(
        ([position, count]) =>
          (poolByPosition.get(position)?.length ?? 0) < count,
      )
    ) {
      return null;
    }

    const slots = Object.entries(required).flatMap(([position, count]) =>
      Array.from({ length: count }, (_, index) => ({
        position,
        index,
      })),
    );
    const cheapestByPosition = new Map(
      [...poolByPosition.entries()].map(([position, players]) => [
        position,
        [...players].sort((a, b) => a.price - b.price),
      ]),
    );
    const minRemainingCost = (slotIndex: number) => {
      const need = new Map<string, number>();
      for (const slot of slots.slice(slotIndex)) {
        need.set(slot.position, (need.get(slot.position) ?? 0) + 1);
      }
      let cost = 0;
      for (const [position, count] of need) {
        const cheapest = cheapestByPosition.get(position) ?? [];
        for (let index = 0; index < count; index += 1) {
          cost += cheapest[index]?.price ?? 1000;
        }
      }
      return cost;
    };
    const playerProxy = (player: RankedPlayer) =>
      chip === "Free Hit"
        ? eventScore(eventIndex, player.id)
        : [0, 1, 2, 3, 4].reduce(
            (sum, offset) =>
              sum +
              (horizonEvents[eventIndex + offset]
                ? eventScore(eventIndex + offset, player.id) *
                  [1, 0.84, 0.69, 0.56, 0.45][offset]
                : 0),
            0,
          );

    type BeamState = {
      players: RankedPlayer[];
      spent: number;
      proxy: number;
      clubs: Map<string, number>;
    };
    let beam: BeamState[] = [
      { players: [], spent: 0, proxy: 0, clubs: new Map() },
    ];

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex];
      const candidates = poolByPosition.get(slot.position) ?? [];
      const next: BeamState[] = [];
      for (const state of beam) {
        for (const player of candidates) {
          if (state.players.some((owned) => owned.id === player.id)) continue;
          if ((state.clubs.get(player.team) ?? 0) >= 3) continue;
          const spent = state.spent + player.price;
          if (
            spent +
              minRemainingCost(slotIndex + 1) >
            budget + 0.001
          ) continue;
          const clubs = new Map(state.clubs);
          clubs.set(player.team, (clubs.get(player.team) ?? 0) + 1);
          next.push({
            players: [...state.players, player],
            spent,
            proxy:
              state.proxy +
              playerProxy(player) *
                (slotWeights[slot.position]?.[slot.index] ?? 0.3),
            clubs,
          });
        }
      }
      beam = next
        .sort(
          (a, b) =>
            b.proxy - a.proxy ||
            a.spent - b.spent,
        )
        .slice(0, 1400);
      if (!beam.length) return null;
    }

    let best:
      | {
          squad: RankedPlayer[];
          bank: number;
          score: number;
        }
      | null = null;
    for (const state of beam) {
      if (state.players.length !== 15) continue;
      const score = chipSquadScore(state.players, eventIndex, chip);
      if (!best || score > best.score) {
        best = {
          squad: state.players,
          bank: Math.max(0, budget - state.spent),
          score,
        };
      }
    }
    return best;
  };

  const chipTransferDiff = (
    before: RankedPlayer[],
    after: RankedPlayer[],
    eventIndex: number,
  ) => {
    const afterIds = new Set(after.map((player) => player.id));
    const beforeIds = new Set(before.map((player) => player.id));
    const removed = before.filter((player) => !afterIds.has(player.id));
    const added = after.filter((player) => !beforeIds.has(player.id));
    const transfers: PathTransfer[] = [];
    for (const position of ["GKP", "DEF", "MID", "FWD"]) {
      const outs = removed.filter((player) => player.position === position);
      const ins = added.filter((player) => player.position === position);
      for (let index = 0; index < Math.min(outs.length, ins.length); index += 1) {
        transfers.push({
          out: outs[index],
          in: ins[index],
          gain: weightedTransferGain(outs[index], ins[index], eventIndex),
        });
      }
    }
    return transfers;
  };

  const managerChipForWeek = (
    chips: Set<string>,
    eventName: string,
  ) => {
    const signal = analysis.chipRadar.find(
      (item) =>
        item.eventName === eventName &&
        item.status === "STRONG" &&
        hasChip(chips, chipLabel(item.chip)),
    );
    if (!signal) return null;
    const label = chipLabel(signal.chip);
    return label === "Triple Captain" ||
      label === "Bench Boost" ||
      label === "Wildcard" ||
      label === "Free Hit"
      ? label
      : null;
  };

  const rivalChipForWeek = (
    chips: Set<string>,
    squad: RankedPlayer[],
    xi: RankedPlayer[],
    captain: RankedPlayer | null,
    event: (typeof horizonEvents)[number],
    activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT" | null,
  ) => {
    const captainScore = captain
      ? event.scores.get(captain.id)?.score ?? 0
      : 0;
    const captainFixtures = captain
      ? event.scores.get(captain.id)?.fixtureCount ?? 0
      : 0;
    const bench = squad.filter(
      (player) => !xi.some((starter) => starter.id === player.id),
    );
    const benchScore = bench.reduce(
      (sum, player) => sum + (event.scores.get(player.id)?.score ?? 0),
      0,
    );
    const activityBoost = activity === "AGGRESSIVE" ? 0.6 : 0;

    if (
      hasChip(chips, "Triple Captain") &&
      captainFixtures >= 2 &&
      captainScore >= 6.8 - activityBoost
    ) {
      return "Triple Captain";
    }
    if (
      hasChip(chips, "Bench Boost") &&
      benchScore >= 12.5 - activityBoost
    ) {
      return "Bench Boost";
    }
    return null;
  };

  const expectedPlanScore = (
    squad: RankedPlayer[],
    xi: RankedPlayer[],
    captain: RankedPlayer | null,
    scores: Map<number, CounterHorizonScore>,
    chip: string | null,
  ) => {
    let total = xi.reduce(
      (sum, player) => sum + (scores.get(player.id)?.score ?? 0),
      0,
    );
    if (captain) total += scores.get(captain.id)?.score ?? 0;
    if (chip === "Triple Captain" && captain) {
      total += scores.get(captain.id)?.score ?? 0;
    }
    if (chip === "Bench Boost") {
      for (const player of squad) {
        if (xi.some((starter) => starter.id === player.id)) continue;
        total += scores.get(player.id)?.score ?? 0;
      }
    }
    return total;
  };

  const buildStatefulPath = (
    team: TeamAnalysis,
    firstTransfer: { out: RankedPlayer; in: RankedPlayer } | null,
    preferredCaptainId: number | null,
    style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED",
    history: Awaited<ReturnType<typeof getRivalResourceHistory>> | null,
    isManager: boolean,
  ): StatefulPath => {
    let squad = [...team.squad];
    let bank = Math.max(0, Number(team.bank ?? 0));
    let freeTransfers = Math.max(
      1,
      Math.min(5, Number(history?.estimatedFreeTransfers ?? 1)),
    );
    const chips = new Set((history?.currentHalfRemaining ?? []).map(chipLabel));
    const startingFreeTransfers = freeTransfers;
    const startingBank = bank;
    const startingChips = [...chips];
    const weeks: PathWeek[] = [];

    for (let eventIndex = 0; eventIndex < horizonEvents.length; eventIndex += 1) {
      const event = horizonEvents[eventIndex];
      const freeBefore = freeTransfers;
      const bankBefore = bank;
      const permanentSquadBefore = [...squad];
      const permanentBankBefore = bank;
      let transfers: PathTransfer[] = [];
      let chip: string | null = isManager
        ? managerChipForWeek(chips, event.name)
        : null;
      let scoringSquad = squad;
      let optimizedChip:
        | ReturnType<typeof optimizeChipSquad>
        | null = null;

      if (
        chip === "Wildcard" ||
        chip === "Free Hit"
      ) {
        optimizedChip = optimizeChipSquad(
          squad,
          bank,
          eventIndex,
          chip,
        );
        if (!optimizedChip) chip = null;
      }

      if (chip === "Wildcard" && optimizedChip) {
        transfers = chipTransferDiff(
          squad,
          optimizedChip.squad,
          eventIndex,
        );
        squad = [...optimizedChip.squad];
        bank = optimizedChip.bank;
        scoringSquad = squad;
      } else if (chip === "Free Hit" && optimizedChip) {
        transfers = chipTransferDiff(
          squad,
          optimizedChip.squad,
          eventIndex,
        );
        scoringSquad = [...optimizedChip.squad];
      } else if (
        eventIndex === 0 &&
        firstTransfer &&
        transferIsLegal(squad, bank, firstTransfer.out, firstTransfer.in)
      ) {
        const gain = weightedTransferGain(
          firstTransfer.out,
          firstTransfer.in,
          eventIndex,
        );
        const transfer = { ...firstTransfer, gain };
        const applied = applyTransfer(squad, bank, transfer);
        squad = applied.squad;
        bank = applied.bank;
        scoringSquad = squad;
        transfers = [transfer];
      } else if (eventIndex > 0) {
        const selected = selectFutureTransfers(
          squad,
          bank,
          freeTransfers,
          eventIndex,
          style,
          history?.activity ?? null,
        );
        squad = selected.squad;
        bank = selected.bank;
        scoringSquad = squad;
        transfers = selected.transfers;
      }

      let hitCost = 0;
      if (chip === "Wildcard" || chip === "Free Hit") {
        // 2026/27 FPL keeps banked transfers through WC/FH. The Gameweek's
        // newly received FT is consumed by activating the chip, so the banked
        // total carried to the next deadline remains unchanged.
        freeTransfers = freeBefore;
      } else {
        hitCost = Math.max(0, transfers.length - freeBefore) * 4;
        freeTransfers = Math.min(
          5,
          Math.max(0, freeBefore - transfers.length) + 1,
        );
      }

      let plan = planFromSquad(
        scoringSquad,
        event.scores,
        eventIndex === 0 ? preferredCaptainId : null,
      );
      if (!isManager) {
        chip = rivalChipForWeek(
          chips,
          scoringSquad,
          plan.xi,
          plan.captain,
          event,
          history?.activity ?? null,
        );
      }
      if (chip) removeChip(chips, chip);

      const meanScore =
        expectedPlanScore(
          scoringSquad,
          plan.xi,
          plan.captain,
          event.scores,
          chip,
        ) - hitCost;

      if (chip === "Free Hit") {
        // Free Hit is a one-Gameweek temporary squad. Restore permanent state
        // for the following deadline, including the public-data bank estimate.
        squad = permanentSquadBefore;
        bank = permanentBankBefore;
      }

      weeks.push({
        event_id: event.eventId,
        event_name: event.name,
        squad: [...scoringSquad],
        xi: plan.xi,
        captain: plan.captain,
        chip,
        transfers,
        hit_cost: hitCost,
        free_transfers_before: freeBefore,
        free_transfers_after: freeTransfers,
        bank_before: bankBefore,
        bank_after: bank,
        mean_score: meanScore,
      });
    }

    return {
      starting_free_transfers: startingFreeTransfers,
      starting_bank: startingBank,
      starting_chips: startingChips,
      weeks,
      ending_free_transfers: freeTransfers,
      ending_bank: bank,
      remaining_chips: [...chips],
    };
  };

  const simulateStatefulWeek = (
    week: PathWeek,
    event: (typeof horizonEvents)[number],
    iteration: number,
    cache: Map<string, number>,
  ) => {
    let total = 0;
    for (const player of week.xi) {
      const item = event.scores.get(player.id);
      total += simulatedHorizonPlayerScore(
        player,
        item?.score ?? 0,
        item?.fixtureCount ?? 0,
        event.eventId,
        iteration,
        cache,
        analysis.volatilityCalibration,
      );
    }
    if (week.captain) {
      const item = event.scores.get(week.captain.id);
      const captainScore = simulatedHorizonPlayerScore(
        week.captain,
        item?.score ?? 0,
        item?.fixtureCount ?? 0,
        event.eventId,
        iteration,
        cache,
        analysis.volatilityCalibration,
      );
      total += captainScore;
      if (week.chip === "Triple Captain") total += captainScore;
    }
    if (week.chip === "Bench Boost") {
      for (const player of week.squad) {
        if (week.xi.some((starter) => starter.id === player.id)) continue;
        const item = event.scores.get(player.id);
        total += simulatedHorizonPlayerScore(
          player,
          item?.score ?? 0,
          item?.fixtureCount ?? 0,
          event.eventId,
          iteration,
          cache,
          analysis.volatilityCalibration,
        );
      }
    }
    return total - week.hit_cost;
  };

  const managerHistory =
    resourceByEntry.get(managerStanding.entry_id) ?? null;
  const managerPaths = new Map<string, StatefulPath>();
  for (const candidate of candidates) {
    const futureStyle =
      posture === "PROTECT"
        ? "BLOCK"
        : posture === "ATTACK"
          ? "ATTACK"
          : candidate.style;
    managerPaths.set(
      candidate.id,
      buildStatefulPath(
        analysis.manager,
        candidate.transfer,
        candidate.captain?.id ?? null,
        futureStyle,
        managerHistory,
        true,
      ),
    );
  }

  const rivalPaths = new Map<number, StatefulPath[]>();
  for (const rival of selectedRivals) {
    const vectors = rivalVectorMap.get(rival.standing.entry_id) ?? [];
    const history = resourceByEntry.get(rival.standing.entry_id) ?? null;
    rivalPaths.set(
      rival.standing.entry_id,
      vectors.map((vector) =>
        buildStatefulPath(
          rival.team,
          vector.transfer,
          null,
          "BALANCED",
          history,
          false,
        ),
      ),
    );
  }

  const summarizePath = (path: StatefulPath, horizonLength: number) => {
    const weeks = path.weeks.slice(0, horizonLength);
    const last = weeks.at(-1);
    return {
      starting_free_transfers: path.starting_free_transfers,
      ending_free_transfers:
        last?.free_transfers_after ?? path.starting_free_transfers,
      starting_bank: path.starting_bank,
      ending_bank: last?.bank_after ?? path.starting_bank,
      hit_cost: weeks.reduce((sum, week) => sum + week.hit_cost, 0),
      chips_used: weeks
        .filter((week) => week.chip)
        .map((week) => ({
          event_id: week.event_id,
          event_name: week.event_name,
          chip: week.chip!,
        })),
      weeks: weeks.map((week) => ({
        event_id: week.event_id,
        event_name: week.event_name,
        transfers: week.transfers.map((move) => ({
          out: { id: move.out.id, name: move.out.name, team: move.out.team },
          in: { id: move.in.id, name: move.in.name, team: move.in.team },
          weighted_gain: move.gain,
        })),
        captain: week.captain
          ? {
              id: week.captain.id,
              name: week.captain.name,
              team: week.captain.team,
            }
          : null,
        chip: week.chip,
        hit_cost: week.hit_cost,
        free_transfers_before: week.free_transfers_before,
        free_transfers_after: week.free_transfers_after,
        bank_after: week.bank_after,
        projected_mean: week.mean_score,
      })),
    };
  };

  const pathRaw = new Map<
    number,
    Array<{
      id: string;
      label: string;
      style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
      objective_probability: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
      resource_path: ReturnType<typeof summarizePath>;
    }>
  >(horizonLengths.map((length) => [length, []]));

  for (const candidate of candidates) {
    const stats = new Map<
      number,
      {
        beatTarget: number;
        stayAheadChaser: number;
        controlAll: number;
        scoreSum: number;
        squareSum: number;
        scoreSamples: number[];
      }
    >(
      horizonLengths.map((length) => [
        length,
        {
          beatTarget: 0,
          stayAheadChaser: 0,
          controlAll: 0,
          scoreSum: 0,
          squareSum: 0,
          scoreSamples: [],
        },
      ]),
    );
    const managerPath = managerPaths.get(candidate.id);
    const managerStart = Number(managerStanding.total ?? 0);
    if (!managerPath) continue;

    for (let iteration = 0; iteration < pathIterations; iteration += 1) {
      let managerCumulative = 0;
      const rivalCumulative = new Map<number, number>();
      const rivalVectorIndices = new Map<number, number>();

      for (const rival of selectedRivals) {
        const vector = rivalVectorForIteration(
          rival.standing.entry_id,
          iteration,
        );
        const vectors = rivalVectorMap.get(rival.standing.entry_id) ?? [];
        const vectorIndex = vector ? Math.max(0, vectors.indexOf(vector)) : 0;
        rivalVectorIndices.set(rival.standing.entry_id, vectorIndex);
        rivalCumulative.set(rival.standing.entry_id, 0);
      }

      for (let weekIndex = 0; weekIndex < horizonEvents.length; weekIndex += 1) {
        const event = horizonEvents[weekIndex];
        const scoreCache = new Map<string, number>();
        const managerWeek = managerPath.weeks[weekIndex];
        if (managerWeek) {
          managerCumulative += simulateStatefulWeek(
            managerWeek,
            event,
            iteration,
            scoreCache,
          );
        }

        for (const rival of selectedRivals) {
          const vectorIndex =
            rivalVectorIndices.get(rival.standing.entry_id) ?? 0;
          const week =
            rivalPaths.get(rival.standing.entry_id)?.[vectorIndex]?.weeks[
              weekIndex
            ] ?? null;
          if (!week) continue;
          const score = simulateStatefulWeek(
            week,
            event,
            iteration,
            scoreCache,
          );
          rivalCumulative.set(
            rival.standing.entry_id,
            (rivalCumulative.get(rival.standing.entry_id) ?? 0) + score,
          );
        }

        const horizonLength = weekIndex + 1;
        if (!horizonLengths.includes(horizonLength)) continue;
        const horizonStats = stats.get(horizonLength)!;
        horizonStats.scoreSum += managerCumulative;
        horizonStats.squareSum += managerCumulative * managerCumulative;
        horizonStats.scoreSamples.push(managerCumulative);

        let controlsAll = true;
        for (const rival of selectedRivals) {
          const managerTotal = managerStart + managerCumulative;
          const rivalTotal =
            Number(rival.standing.total ?? 0) +
            (rivalCumulative.get(rival.standing.entry_id) ?? 0);
          if (managerTotal <= rivalTotal) controlsAll = false;
          if (
            target &&
            rival.standing.entry_id === target.standing.entry_id &&
            managerTotal > rivalTotal
          ) {
            horizonStats.beatTarget += 1;
          }
          if (
            primaryChaser &&
            rival.standing.entry_id === primaryChaser.standing.entry_id &&
            managerTotal > rivalTotal
          ) {
            horizonStats.stayAheadChaser += 1;
          }
        }
        if (controlsAll) horizonStats.controlAll += 1;
      }
    }

    for (const horizonLength of horizonLengths) {
      const item = stats.get(horizonLength)!;
      const mean = item.scoreSum / pathIterations;
      const variance = Math.max(
        0,
        item.squareSum / pathIterations - mean * mean,
      );
      const volatility = Math.sqrt(variance);
      const attackProbability = target
        ? item.beatTarget / pathIterations
        : null;
      const protectProbability = primaryChaser
        ? item.stayAheadChaser / pathIterations
        : null;
      const controlProbability = item.controlAll / pathIterations;
      const objectiveProbability = counterObjectiveProbability(
        posture,
        attackProbability,
        protectProbability,
        controlProbability,
      );
      pathRaw.get(horizonLength)!.push({
        id: candidate.id,
        label: candidate.label,
        style: candidate.style,
        objective_probability: objectiveProbability,
        mean_score: mean,
        volatility,
        floor_5: sampleQuantile(item.scoreSamples, 0.05),
        ceiling_95: sampleQuantile(item.scoreSamples, 0.95),
        resource_path: summarizePath(managerPath, horizonLength),
      });
    }
  }

  const horizonResults = Object.fromEntries(
    horizonLengths.map((horizonLength) => {
      const raw = pathRaw.get(horizonLength) ?? [];
      const hold = raw.find((item) => item.id === "hold") ?? raw[0] ?? null;
      const ranked = raw
        .map((item) => ({
          ...item,
          probability_delta:
            hold == null
              ? 0
              : item.objective_probability - hold.objective_probability,
        }))
        .sort((a, b) => {
          const probabilityGap =
            b.objective_probability - a.objective_probability;
          if (Math.abs(probabilityGap) > 0.01) return probabilityGap;
          if (posture === "PROTECT") {
            const floorGap = b.floor_5 - a.floor_5;
            if (Math.abs(floorGap) > 0.15) return floorGap;
            const volatilityGap = a.volatility - b.volatility;
            if (Math.abs(volatilityGap) > 0.05) return volatilityGap;
          } else if (posture === "ATTACK") {
            const ceilingGap = b.ceiling_95 - a.ceiling_95;
            if (Math.abs(ceilingGap) > 0.15) return ceilingGap;
          } else {
            const meanGap = b.mean_score - a.mean_score;
            if (Math.abs(meanGap) > 0.15) return meanGap;
            const floorGap = b.floor_5 - a.floor_5;
            if (Math.abs(floorGap) > 0.15) return floorGap;
          }
          return b.mean_score - a.mean_score;
        });
      const whatIfScenario =
        ranked.find((scenario) => scenario.id === "what-if") ?? null;
      const recommendationRanked = ranked.filter(
        (scenario) => scenario.id !== "what-if",
      );
      const best = recommendationRanked[0] ?? null;
      const delta = best?.probability_delta ?? 0;
      const magnitude = Math.abs(delta);
      const band =
        magnitude < 0.01
          ? ("NEUTRAL" as const)
          : magnitude < 0.03
            ? ("MATERIAL" as const)
            : ("DECISIVE" as const);
      return [
        String(horizonLength),
        {
          horizon: horizonLength,
          event_names: horizonEvents
            .slice(0, horizonLength)
            .map((event) => event.name),
          iterations: pathIterations,
          baseline: hold,
          recommended_scenario: best,
          what_if_scenario: whatIfScenario,
          scenarios: recommendationRanked,
          game_theory_impact: {
            band,
            probability_delta: delta,
          },
        },
      ];
    }),
  );

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
            player.assistantScore +
            simulationVolatility(
              player,
              analysis.volatilityCalibration,
            ) *
              1.65;
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

  const rivalVectors = selectedRivals.map((rival) => {
    const history = resourceByEntry.get(rival.standing.entry_id) ?? null;
    const snapshot = snapshotByEntry.get(rival.standing.entry_id) ?? null;
    const vectors = rivalVectorMap.get(rival.standing.entry_id) ?? [];
    const sortedShares = [...vectors]
      .map((vector) => vector.model_share)
      .sort((a, b) => b - a);
    const entropy =
      vectors.length <= 1
        ? 0
        : -vectors.reduce(
            (sum, vector) =>
              vector.model_share > 0
                ? sum + vector.model_share * Math.log(vector.model_share)
                : sum,
            0,
          ) / Math.log(vectors.length);
    const evidenceCoverage =
      (history ? 0.45 : 0) +
      (snapshotByEntry.has(rival.standing.entry_id) ? 0.2 : 0) +
      (history?.freeTransferConfidence === "HIGH" ? 0.15 : 0.08) +
      (localExposure.size > 0 ? 0.2 : 0);
    const responseConfidence = Math.max(
      0,
      Math.min(
        1,
        evidenceCoverage * 0.72 +
          (1 - entropy) * 0.18 +
          (sortedShares[0] ?? 0) * 0.1,
      ),
    );
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
      recent_transfers: history?.recentTransfers ?? null,
      recent_hit_cost: history?.recentHitCost ?? null,
      response_confidence: responseConfidence,
      response_uncertainty:
        history?.currentHalfRemaining.some(
          (chip) => chip === "Wildcard" || chip === "Free Hit",
        )
          ? "ELEVATED_CHIP_OPTIONALITY"
          : entropy >= 0.78
            ? "DIFFUSE"
            : "NORMAL",
      transfer_vectors: vectors.map((vector) => ({
        out: vector.transfer?.out ?? null,
        in: vector.transfer?.in ?? null,
        label: vector.label,
        model_share: vector.model_share,
        drivers: vector.drivers,
        affordability_margin: vector.affordability_margin,
        caveat:
          "Model share is a relative Footy response weight conditioned on FT bank, cash affordability, recent transfer behaviour, squad repair need and template pressure. It is not an observed probability or a claim about intent.",
      })),
    };
  });

  return {
    snapshot_event: snapshotEvent,
    managers_in_local_matrix: snapshots.length,
    iterations,
    strategy_mode: leagueStrategy.mode,
    posture,
    posture_source: postureSource,
    volatility_calibration: analysis.volatilityCalibration
      ? {
          status: "EMPIRICAL",
          version: analysis.volatilityCalibration.version,
          season: analysis.volatilityCalibration.season,
          source: analysis.volatilityCalibration.source,
          sample_count: analysis.volatilityCalibration.sample_count,
          generated_at: analysis.volatilityCalibration.generated_at,
          tail_method: "SIMULATED_EMPIRICAL_QUANTILES",
        }
      : {
          status: "FALLBACK",
          version: null,
          season: null,
          source: null,
          sample_count: 0,
          generated_at: null,
          tail_method: "SIMULATED_HEURISTIC_QUANTILES",
        },
    objective:
      posture === "PROTECT"
        ? "Protect: maximise the probability of staying ahead of the nearest chasing pressure, with downside floor and tighter variance breaking close calls."
        : posture === "ATTACK"
          ? target
            ? "Attack: maximise the probability of overtaking the nearest target above, with upside ceiling breaking close calls."
            : "Attack: there is no target above, so maximise overall league-control probability and use upside ceiling to break close calls."
          : target && primaryChaser
            ? "Hybrid: balance overtaking the nearest target and staying ahead of the nearest chaser. The joint objective penalises paths that improve one side by sacrificing too much on the other."
            : target
              ? "Hybrid: there is no immediate chaser pressure, so the objective reduces to overtaking the nearest target while keeping football quality primary."
              : "Hybrid: there is no target above, so the objective reduces to protecting league control while keeping expected football output central.",
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
    horizon_results: horizonResults,
    what_if: {
      ...whatIfStatus,
      options: whatIfOptions,
      next_gameweek:
        whatIfStatus.status === "VALID" ? whatIfNextGameweek : null,
      horizons:
        whatIfStatus.status === "VALID"
          ? Object.fromEntries(
              Object.entries(horizonResults).map(([key, value]) => [
                key,
                value.what_if_scenario ?? null,
              ]),
            )
          : {},
      caveat:
        "What-If uses current listed prices for affordability because public league data does not expose exact selling-price profit. It reuses the same rival-response and empirical scoring model as CounterPlay.",
    },
    scenarios: recommendationScenarios.slice(0, 7),
    recommended_scenario: recommendationScenarios[0] ?? null,
    local_exposure: localMatrix,
    primary_threats: threatPlayers,
    rival_vectors: rivalVectors,
    caveats: [
      "The 10,000-run simulator is a model distribution, not a guarantee of future results.",
      analysis.volatilityCalibration
        ? `Player scoring shocks use ${analysis.volatilityCalibration.sample_count.toLocaleString()} leakage-controlled prior-season FPL player-Gameweek samples; displayed 5th/95th tails are direct simulation quantiles rather than a normal approximation.`
        : "The empirical volatility snapshot is unavailable, so player shocks use the conservative heuristic fallback; displayed 5th/95th tails are still direct simulation quantiles.",
      "Shared players use the same simulated outcome in both squads, preserving ownership correlation rather than drawing them independently.",
      "Local effective exposure is calculated from the latest synced mini-league starting multipliers/captaincy; it is not global effective ownership and it is not a prediction of the next deadline.",
      "Rival HOLD/transfer vectors are relative model weights conditioned on estimated FT bank, ITB/affordability, recent transfer and hit behaviour, squad structure, official ownership/public transfer momentum and local exposure. They are sampled inside the simulation and are not claims about a rival's intent.",
      "When objective probabilities are within one percentage point, Protect uses downside floor/tighter variance, Attack uses upside ceiling, and Hybrid prefers expected score then downside floor. Posture never promotes a move that failed the football-quality gate.",
      "The 1GW/3GW/5GW path is stateful: each deadline carries forward the squad, free-transfer bank, approximate cash balance, hit cost, captaincy and supported chip use before re-evaluating the next football-qualified transfer.",
      "Future manager and rival transfers are model-selected response paths from a bounded football-qualified pool. They are planning weights, not claims about what any manager will do.",
      "Path cash uses current listed prices because exact historical purchase/selling-price profit is not available in the public league snapshot; bank-sensitive moves should therefore be treated as approximate until selling-price state is added.",
      "Triple Captain and Bench Boost use the carried squad. Strong Wildcard/Free Hit signals now invoke a legal 15-man one-deadline optimiser; Free Hit reverts the squad afterward and both chips preserve banked transfers under current 2026/27 rules. Chip budgets still use public listed prices because exact manager selling prices are unavailable.",
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
  const url = new URL(request.url);
  const postureParam = url.searchParams.get("posture")?.toUpperCase() ?? null;
  const requestedPosture: CounterPosture | null =
    postureParam === "PROTECT" || postureParam === "HYBRID" || postureParam === "ATTACK"
      ? postureParam
      : null;
  const parseOptionalId = (name: string) => {
    const raw = url.searchParams.get(name);
    if (raw == null || raw === "") return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  };
  const whatIfOutId = parseOptionalId("whatif_out");
  const whatIfInId = parseOptionalId("whatif_in");
  const whatIfCaptainId = parseOptionalId("whatif_captain");
  const whatIfRequested =
    url.searchParams.has("whatif_out") ||
    url.searchParams.has("whatif_in") ||
    url.searchParams.has("whatif_captain");
  const whatIfRequest: CounterWhatIfRequest | null = whatIfRequested
    ? {
        outId: whatIfOutId,
        inId: whatIfInId,
        captainId: whatIfCaptainId,
      }
    : null;

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
    const inferredPosture: CounterPosture =
      leagueStrategy.mode === "PROTECT"
        ? "PROTECT"
        : leagueStrategy.mode === "RECOVER"
          ? "ATTACK"
          : "HYBRID";
    const selectedPosture = requestedPosture ?? inferredPosture;

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
      selectedPosture,
      requestedPosture ? "USER" : "INFERRED",
      whatIfRequest,
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

    const staffOnly = url.searchParams.get("staff") === "1";

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

    // The bounded transfer pool is an internal CounterPlay search space. Keep
    // it out of the response payload once the path engine has consumed it.
    const publicAnalysis = {
      ...analysis,
      counterPlayTransferPool: undefined,
      volatilityCalibration: undefined,
    };

    return NextResponse.json({
      league_id: leagueId,
      manager_standing: managerStanding,
      rival_standing: rivalStanding,
      target_standing: targetStanding,
      chaser_standings: chaserStandings,
      pressure_map: pressureMap,
      analysis: publicAnalysis,
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
