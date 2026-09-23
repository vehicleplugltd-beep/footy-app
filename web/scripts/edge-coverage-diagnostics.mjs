// Read-only coverage report: research forecasts and live prices have different horizons.
const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!base || !key) throw new Error("Missing Supabase credentials");
const headers = { apikey: key, Authorization: `Bearer ${key}` };
async function read(table, query) {
  const response = await fetch(`${base}/rest/v1/${table}?${query}`, { headers });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const [fixtures, models, odds] = await Promise.all([
  read("footy_matches", `select=match_id,league,kickoff_at&kickoff_at=gte.${encodeURIComponent(iso(now))}&kickoff_at=lte.${encodeURIComponent(iso(now+21*86400000))}&limit=10000`),
  read("footy_model_outputs", "select=match_id,market,selection&limit=10000"),
  read("footy_live_odds_current", `select=match_id,market,selection&captured_at=gte.${encodeURIComponent(iso(now-3*3600000))}&commence_time=gte.${encodeURIComponent(iso(now))}&limit=30000`),
]);
const core = new Set(["ENG-Premier League","ESP-La Liga","GER-Bundesliga","ITA-Serie A","FRA-Ligue 1"]);
const byId = new Map(fixtures.map(f => [f.match_id, f]));
const futureModels = models.filter(m => byId.has(m.match_id));
const priced = new Set(odds.map(o => `${o.match_id}|${o.market}|${o.selection}`));
const modelIds = new Set(futureModels.map(m => m.match_id));
const priceIds = new Set(odds.map(o => o.match_id));
const overlap = futureModels.filter(m => priced.has(`${m.match_id}|${m.market}|${m.selection}`));
const firstModel = futureModels.map(m => byId.get(m.match_id).kickoff_at).sort()[0] || null;
const within8 = futureModels.filter(m => Date.parse(byId.get(m.match_id).kickoff_at) <= now+8*86400000);
const report = {
  status: overlap.length ? "priced-models-available" : within8.length ? "unmatched-near-term-models" : futureModels.length ? "research-ahead-of-price-window" : "no-upcoming-models",
  research_horizon_days: 21, price_horizon_days: 8,
  core_fixtures_21d: fixtures.filter(f => core.has(f.league)).length,
  model_market_rows_21d: futureModels.length,
  model_market_rows_8d: within8.length,
  model_fixtures_21d: modelIds.size,
  fresh_price_rows: odds.length,
  priced_model_fixtures: [...modelIds].filter(id => priceIds.has(id)).length,
  matched_model_market_rows: overlap.length,
  first_model_kickoff: firstModel,
  note: "No match or price is fabricated; BET requires separately verified price, validation and EV.",
};
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Footy Edge coverage\n\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n`);
}
if (report.status === "unmatched-near-term-models") process.exitCode = 1;
