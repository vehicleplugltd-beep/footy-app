const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

function config() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return { url, key };
}

async function rest<T>(path: string): Promise<T[]> {
  const cfg = config();
  if (!cfg) return [];
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }
  return response.json() as Promise<T[]>;
}

export type PublicCall = {
  id: string;
  source_kind: "MODEL_CALL" | "VALUE_TIP";
  match_id: string;
  model_version: string;
  market: string;
  selection: string;
  model_probability: number;
  fair_odds: number;
  minimum_take_price: number | null;
  validation_status: "APPROVED" | "WATCH" | "RESEARCH" | "PASS" | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  published_at: string;
  quoted_bookmaker: string | null;
  quoted_odds: number | null;
  closing_odds: number | null;
  home_goals: number | null;
  away_goals: number | null;
  result_status: "OPEN" | "WON" | "LOST" | "PUSH" | "VOID";
  unit_profit: number | null;
  clv: number | null;
  settled_at: string | null;
};

export type AccuracyPoint = {
  index: number;
  label: string;
  accuracy: number;
};

function streak(calls: PublicCall[]) {
  const settled = calls
    .filter((call) => call.result_status === "WON" || call.result_status === "LOST")
    .sort(
      (a, b) =>
        new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime(),
    );
  if (!settled.length) return { type: "NONE", count: 0 };
  const type = settled[0].result_status;
  let count = 0;
  for (const call of settled) {
    if (call.result_status !== type) break;
    count += 1;
  }
  return { type, count };
}

function cumulativeAccuracy(calls: PublicCall[]): AccuracyPoint[] {
  const settled = calls
    .filter(
      (call) =>
        call.source_kind === "MODEL_CALL" &&
        (call.result_status === "WON" || call.result_status === "LOST"),
    )
    .sort(
      (a, b) =>
        new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime(),
    );

  let wins = 0;
  return settled.map((call, index) => {
    if (call.result_status === "WON") wins += 1;
    return {
      index: index + 1,
      label: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/London",
      }).format(new Date(call.kickoff_at)),
      accuracy: (wins / (index + 1)) * 100,
    };
  });
}

export async function getResultsData() {
  const calls = await rest<PublicCall>(
    "footy_public_calls?select=*&order=kickoff_at.desc&limit=500",
  );

  const modelCalls = calls.filter((call) => call.source_kind === "MODEL_CALL");
  const settledModel = modelCalls.filter(
    (call) => call.result_status === "WON" || call.result_status === "LOST",
  );
  const modelWins = settledModel.filter(
    (call) => call.result_status === "WON",
  ).length;

  const valueTips = calls.filter((call) => call.source_kind === "VALUE_TIP");
  const settledPricedTips = valueTips.filter(
    (call) =>
      call.unit_profit !== null &&
      (call.result_status === "WON" || call.result_status === "LOST"),
  );
  const totalUnitProfit = settledPricedTips.reduce(
    (sum, call) => sum + Number(call.unit_profit ?? 0),
    0,
  );
  const roi = settledPricedTips.length
    ? totalUnitProfit / settledPricedTips.length
    : null;

  const clvRows = valueTips.filter((call) => call.clv !== null);
  const averageClv = clvRows.length
    ? clvRows.reduce((sum, call) => sum + Number(call.clv ?? 0), 0) /
      clvRows.length
    : null;

  return {
    calls,
    recentCalls: calls.slice(0, 20),
    modelCalls: {
      published: modelCalls.length,
      settled: settledModel.length,
      open: modelCalls.filter((call) => call.result_status === "OPEN").length,
      wins: modelWins,
      losses: settledModel.length - modelWins,
      hitRate: settledModel.length ? modelWins / settledModel.length : null,
      streak: streak(modelCalls),
      curve: cumulativeAccuracy(modelCalls),
    },
    valueTips: {
      published: valueTips.length,
      settledPriced: settledPricedTips.length,
      unitProfit: settledPricedTips.length ? totalUnitProfit : null,
      roi,
      averageClv,
    },
  };
}
