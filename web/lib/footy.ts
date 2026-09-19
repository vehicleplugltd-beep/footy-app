import type {
  BoardMatch,
  Match,
  ModelOutput,
  StrategyRule,
  Validation,
} from "@/lib/types";

const MODEL_VERSION = "v7-r16-p50-v20";

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

function latestOutputs(rows: ModelOutput[]) {
  const latest = new Map<string, ModelOutput>();
  for (const row of rows) {
    const key = `${row.match_id}:${row.market}:${row.selection}`;
    const current = latest.get(key);
    if (!current || current.created_at < row.created_at) {
      latest.set(key, row);
    }
  }
  return [...latest.values()];
}

export async function getDashboardData() {
  const now = new Date().toISOString();

  const [matches, outputs, validations, strategies] = await Promise.all([
    rest<Match>(
      `footy_matches?select=match_id,kickoff_at,league,home_team,away_team&kickoff_at=gte.${encodeURIComponent(now)}&order=kickoff_at.asc&limit=30`,
    ),
    rest<ModelOutput>(
      `footy_model_outputs?select=match_id,model_version,market,selection,model_probability,fair_odds,minimum_take_price,created_at&model_version=eq.${MODEL_VERSION}&market=eq.1X2&order=created_at.desc&limit=500`,
    ),
    rest<Validation>(
      `footy_model_market_validation?select=model_version,market,status,sample_size,model_log_loss,benchmark_log_loss,close_roi,clv_proxy,bookmaker_reference,notes&model_version=eq.${MODEL_VERSION}`,
    ),
    rest<StrategyRule>(
      "footy_strategy_rules?select=strategy_id,model_version,market,selection,status,min_probability_edge,min_model_probability,max_decimal_odds,min_raw_ev,holdout_bets,holdout_roi&order=evaluated_at.desc",
    ),
  ]);

  const futureIds = new Set(matches.map((match) => match.match_id));
  const byMatch = new Map<string, ModelOutput[]>();

  for (const output of latestOutputs(outputs)) {
    if (!futureIds.has(output.match_id)) continue;
    const list = byMatch.get(output.match_id) ?? [];
    list.push(output);
    byMatch.set(output.match_id, list);
  }

  const order = new Map([
    ["home", 0],
    ["draw", 1],
    ["away", 2],
  ]);

  const board: BoardMatch[] = matches
    .filter((match) => byMatch.has(match.match_id))
    .map((match) => ({
      ...match,
      selections: (byMatch.get(match.match_id) ?? [])
        .sort(
          (a, b) =>
            (order.get(a.selection) ?? 99) - (order.get(b.selection) ?? 99),
        )
        .map((selection) => ({
          ...selection,
          displaySelection:
            selection.selection === "home"
              ? match.home_team
              : selection.selection === "away"
                ? match.away_team
                : "Draw",
        })),
    }));

  const validation = validations.find((row) => row.market === "1X2") ?? null;

  return {
    board,
    validation,
    strategies,
    configured: Boolean(config()),
  };
}
