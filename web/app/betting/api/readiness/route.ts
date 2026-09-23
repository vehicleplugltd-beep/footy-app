import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MODEL_VERSION = "v7-r16-p50-v20";

type Probe = {
  state: "ready" | "missing_configuration" | "database_unavailable" | "no_forward_model" | "no_verified_price";
  modelVersion: string;
  forwardModelledFixtures: number;
  freshPricedModelledFixtures: number;
  checkedAt: string;
};

export async function GET() {
  const checkedAt = new Date().toISOString();
  const base = (process.env.SUPABASE_URL || "https://nlmtcimkqymynsyflimv.supabase.co").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result: Probe = {
    state: "missing_configuration",
    modelVersion: MODEL_VERSION,
    forwardModelledFixtures: 0,
    freshPricedModelledFixtures: 0,
    checkedAt,
  };
  if (!key) {
    return NextResponse.json(result, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    // Probe the same model version and upcoming match IDs that the homepage consumes.
    // Never return credentials, raw model rows or user data.
    const horizon = new Date(Date.now() + 30 * 86400000).toISOString();
    const now = checkedAt;
    const matchesUrl = `${base}/rest/v1/footy_matches?select=match_id&kickoff_at=gt.${encodeURIComponent(now)}&kickoff_at=lte.${encodeURIComponent(horizon)}&limit=5000`;
    const outputsUrl = `${base}/rest/v1/footy_model_outputs?select=match_id,selection&model_version=eq.${MODEL_VERSION}&market=eq.1X2&limit=2000`;
    const priceCutoff = new Date(Date.now() - 2 * 3600000).toISOString();
    const pricesUrl = `${base}/rest/v1/footy_live_odds_current?select=match_id,decimal_odds,bookmaker_key&market=eq.1X2&captured_at=gte.${encodeURIComponent(priceCutoff)}&limit=30000`;
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const [matchesResponse, outputsResponse, pricesResponse] = await Promise.all([
      fetch(matchesUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
      fetch(outputsUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
      fetch(pricesUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) }),
    ]);
    if (!matchesResponse.ok || !outputsResponse.ok || !pricesResponse.ok) throw new Error("Source read failed");
    const matches = (await matchesResponse.json()) as { match_id: string }[];
    const outputs = (await outputsResponse.json()) as { match_id: string; selection: string }[];
    const prices = (await pricesResponse.json()) as { match_id: string | null; decimal_odds: number; bookmaker_key: string }[];
    const futureIds = new Set(matches.map((row) => row.match_id));
    const outcomes = new Map<string, Set<string>>();
    for (const row of outputs) {
      if (!futureIds.has(row.match_id)) continue;
      const selections = outcomes.get(row.match_id) ?? new Set<string>();
      selections.add(row.selection);
      outcomes.set(row.match_id, selections);
    }
    result.forwardModelledFixtures = [...outcomes.values()].filter(
      (selections) => ["home", "draw", "away"].every((selection) => selections.has(selection)),
    ).length;
    const completeIds = new Set([...outcomes].filter(([, selections]) =>
      ["home", "draw", "away"].every((selection) => selections.has(selection)),
    ).map(([id]) => id));
    result.freshPricedModelledFixtures = new Set(prices.filter((row) =>
      row.match_id && completeIds.has(row.match_id) && Number(row.decimal_odds) > 1 && Boolean(row.bookmaker_key),
    ).map((row) => row.match_id)).size;
    // Exact fixture ID only: unmatched provider events must never count as verified prices.
    result.state = !result.forwardModelledFixtures ? "no_forward_model" :
      !result.freshPricedModelledFixtures ? "no_verified_price" : "ready";
    return NextResponse.json(result, {
      status: result.state === "ready" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    result.state = "database_unavailable";
    return NextResponse.json(result, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
