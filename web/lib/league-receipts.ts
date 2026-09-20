type ReceiptPlayer = {
  id: number;
  name: string;
  team: string;
  score?: number;
  opponent?: string | null;
  form?: number;
  xgi_per_90?: number;
  process_boost?: number;
  transfers_net?: number;
};

type ReceiptTransfer = {
  out: ReceiptPlayer;
  in: ReceiptPlayer | null;
  reason: string;
};

type ReceiptRow = {
  id: string;
  league_id: number;
  entry_id: number;
  event: number;
  deadline_time: string;
  generated_at: string;
  data_retrieved_at: string;
  model_version: string;
  captain_options: ReceiptPlayer[] | null;
  transfer_options: ReceiptTransfer[] | null;
  actual_captain_id: number | null;
  actual_incoming_ids: number[] | null;
  matched_top3: boolean | null;
  matched_captain_top3: boolean | null;
  matched_transfer_top3: boolean | null;
  scored_at: string | null;
};

type LiveElement = {
  id: number;
  stats: {
    total_points: number;
  };
};

type Bootstrap = {
  elements: Array<{
    id: number;
    web_name: string;
    team: number;
  }>;
  teams: Array<{
    id: number;
    short_name: string;
  }>;
};

export type LeagueReviewItem = {
  id: string;
  event: number;
  generatedAt: string;
  scoredAt: string | null;
  captain: {
    recommended: ReceiptPlayer | null;
    actual: ReceiptPlayer | null;
    recommendedPoints: number | null;
    actualPoints: number | null;
    followedTop3: boolean | null;
  };
  transfer: {
    recommended: ReceiptTransfer | null;
    recommendedInPoints: number | null;
    recommendedOutPoints: number | null;
    actualIncoming: ReceiptPlayer[];
    followedTop3: boolean | null;
  };
  matchedTop3: boolean | null;
  status: "AWAITING" | "REVIEWED";
  outcome: "SUPPORTED" | "MIXED" | "AGAINST" | "AWAITING";
  lesson: string;
};

export type LeagueReceiptSummary = {
  officialCalls: number;
  scoredCalls: number;
  actedTop3: number;
  captainTop3: number;
  transferTop3: number;
  adherenceRate: number | null;
  latest: ReceiptRow[];
  reviews: LeagueReviewItem[];
};

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";
const FPL_BASE = "https://fantasy.premierleague.com/api";

async function fplFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${FPL_BASE}/${path}`, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Referer: "https://fantasy.premierleague.com/",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

function playerPoints(
  playerId: number | null | undefined,
  live: Map<number, number>,
) {
  return playerId ? live.get(playerId) ?? null : null;
}

function reviewOutcome(
  captainRecommended: number | null,
  captainActual: number | null,
  transferIn: number | null,
  transferOut: number | null,
): LeagueReviewItem["outcome"] {
  const signals: number[] = [];

  if (captainRecommended != null && captainActual != null) {
    signals.push(
      captainRecommended > captainActual
        ? 1
        : captainRecommended < captainActual
          ? -1
          : 0,
    );
  }

  if (transferIn != null && transferOut != null) {
    signals.push(
      transferIn > transferOut ? 1 : transferIn < transferOut ? -1 : 0,
    );
  }

  if (!signals.length) return "AWAITING";
  const total = signals.reduce((sum, value) => sum + value, 0);
  if (total > 0) return "SUPPORTED";
  if (total < 0) return "AGAINST";
  return "MIXED";
}

function reviewLesson(
  outcome: LeagueReviewItem["outcome"],
  row: ReceiptRow,
) {
  if (!row.scored_at) {
    return "The pre-deadline call is frozen. Footy will score the recommendation after the Gameweek is complete.";
  }
  if (outcome === "SUPPORTED") {
    return "The one-Gameweek outcome supported the call. Keep the process, but do not overfit a single result.";
  }
  if (outcome === "AGAINST") {
    return "The one-Gameweek outcome went against the call. Footy should review minutes, matchup and timing rather than hide the miss.";
  }
  if (outcome === "MIXED") {
    return "The result was mixed. Separate captaincy, transfer timing and variance before changing the model.";
  }
  return "The call is scored, but there is not enough comparable outcome data to grade it cleanly.";
}

async function buildReviews(rows: ReceiptRow[]) {
  const latestRows = rows.slice(0, 8);
  const scoredEvents = [
    ...new Set(
      latestRows.filter((row) => row.scored_at).map((row) => row.event),
    ),
  ];

  const [bootstrap, ...livePayloads] = await Promise.all([
    scoredEvents.length ? fplFetch<Bootstrap>("bootstrap-static/") : null,
    ...scoredEvents.map((event) =>
      fplFetch<{ elements: LiveElement[] }>(`event/${event}/live/`),
    ),
  ]);

  const teamById = new Map(
    (bootstrap?.teams ?? []).map((team) => [team.id, team.short_name]),
  );
  const playerById = new Map(
    (bootstrap?.elements ?? []).map((player) => [
      player.id,
      {
        id: player.id,
        name: player.web_name,
        team: teamById.get(player.team) ?? "—",
      } satisfies ReceiptPlayer,
    ]),
  );

  const liveByEvent = new Map<number, Map<number, number>>();
  scoredEvents.forEach((event, index) => {
    const payload = livePayloads[index];
    liveByEvent.set(
      event,
      new Map(
        (payload?.elements ?? []).map((item) => [
          item.id,
          item.stats.total_points,
        ]),
      ),
    );
  });

  return latestRows.map((row): LeagueReviewItem => {
    const live = liveByEvent.get(row.event) ?? new Map<number, number>();
    const recommendedCaptain = row.captain_options?.[0] ?? null;
    const actualCaptain = row.actual_captain_id
      ? playerById.get(row.actual_captain_id) ?? null
      : null;
    const recommendedTransfer = row.transfer_options?.[0] ?? null;
    const actualIncoming = (row.actual_incoming_ids ?? [])
      .map((id) => playerById.get(id) ?? null)
      .filter((player): player is ReceiptPlayer => Boolean(player));

    const recommendedCaptainPoints = playerPoints(
      recommendedCaptain?.id,
      live,
    );
    const actualCaptainPoints = playerPoints(row.actual_captain_id, live);
    const recommendedInPoints = playerPoints(
      recommendedTransfer?.in?.id,
      live,
    );
    const recommendedOutPoints = playerPoints(
      recommendedTransfer?.out?.id,
      live,
    );
    const outcome = row.scored_at
      ? reviewOutcome(
          recommendedCaptainPoints,
          actualCaptainPoints,
          recommendedInPoints,
          recommendedOutPoints,
        )
      : "AWAITING";

    return {
      id: row.id,
      event: row.event,
      generatedAt: row.generated_at,
      scoredAt: row.scored_at,
      captain: {
        recommended: recommendedCaptain,
        actual: actualCaptain,
        recommendedPoints: recommendedCaptainPoints,
        actualPoints: actualCaptainPoints,
        followedTop3: row.matched_captain_top3,
      },
      transfer: {
        recommended: recommendedTransfer,
        recommendedInPoints,
        recommendedOutPoints,
        actualIncoming,
        followedTop3: row.matched_transfer_top3,
      },
      matchedTop3: row.matched_top3,
      status: row.scored_at ? "REVIEWED" : "AWAITING",
      outcome,
      lesson: reviewLesson(outcome, row),
    };
  });
}

export async function getLeagueReceiptSummary(filters?: {
  entryId?: number;
  leagueId?: number;
}): Promise<LeagueReceiptSummary> {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const empty: LeagueReceiptSummary = {
    officialCalls: 0,
    scoredCalls: 0,
    actedTop3: 0,
    captainTop3: 0,
    transferTop3: 0,
    adherenceRate: null,
    latest: [],
    reviews: [],
  };

  if (!key || !filters?.entryId) return empty;

  const filterQuery = [
    `entry_id=eq.${filters.entryId}`,
    filters.leagueId ? `league_id=eq.${filters.leagueId}` : null,
  ]
    .filter(Boolean)
    .join("&");

  const response = await fetch(
    `${url}/rest/v1/footy_fpl_recommendation_snapshots?select=id,league_id,entry_id,event,deadline_time,generated_at,data_retrieved_at,model_version,captain_options,transfer_options,actual_captain_id,actual_incoming_ids,matched_top3,matched_captain_top3,matched_transfer_top3,scored_at&is_pre_deadline=eq.true&${filterQuery}&order=generated_at.desc&limit=1000`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) return empty;

  const rows = (await response.json()) as ReceiptRow[];
  const official: ReceiptRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (
      new Date(row.generated_at).getTime() >=
      new Date(row.deadline_time).getTime()
    ) {
      continue;
    }
    const keyName = `${row.league_id}:${row.entry_id}:${row.event}`;
    if (seen.has(keyName)) continue;
    seen.add(keyName);
    official.push(row);
  }

  const scored = official.filter((row) => Boolean(row.scored_at));
  const actedTop3 = scored.filter((row) => row.matched_top3 === true).length;
  const captainTop3 = scored.filter(
    (row) => row.matched_captain_top3 === true,
  ).length;
  const transferTop3 = scored.filter(
    (row) => row.matched_transfer_top3 === true,
  ).length;

  return {
    officialCalls: official.length,
    scoredCalls: scored.length,
    actedTop3,
    captainTop3,
    transferTop3,
    adherenceRate: scored.length ? actedTop3 / scored.length : null,
    latest: official.slice(0, 8),
    reviews: await buildReviews(official),
  };
}
