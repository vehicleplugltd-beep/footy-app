import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const INPUT = process.argv[2] || "/tmp/odds.ndjson";
const PROVIDER = "oddsportal";
const SPORT_KEY = "football";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase server credentials");
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(fc|afc|cf|sc|ac|calcio|club|football|futbol|deportivo)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function parseKickoff(value) {
  const raw = String(value || "").trim().replace(/ UTC$/i, "Z");
  const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function providerEventId(row) {
  const link = String(row.match_link || "");
  const fragment = link.split("#").pop();
  if (fragment && fragment !== link) return fragment;
  return createHash("sha1")
    .update(
      [
        row.home_team,
        row.away_team,
        row.match_date,
        row.league_name,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 20);
}

function oddsportalMatchId(row, kickoff) {
  return `oddsportal:${providerEventId(row)}:${kickoff.slice(0, 10)}`;
}

function leagueLabel(row) {
  const name = String(row.league_name || "Football").trim();
  const key = name.toLowerCase();
  const aliases = new Map([
    ["premier league", "ENG-Premier League"],
    ["championship", "ENG-Championship"],
    ["league one", "ENG-League One"],
    ["league two", "ENG-League Two"],
    ["premiership", "SCO-Premiership"],
    ["laliga", "ESP-La Liga"],
    ["la liga", "ESP-La Liga"],
    ["serie a", "ITA-Serie A"],
    ["serie b", "ITA-Serie B"],
    ["bundesliga", "GER-Bundesliga"],
    ["2. bundesliga", "GER-2. Bundesliga"],
    ["ligue 1", "FRA-Ligue 1"],
    ["ligue 2", "FRA-Ligue 2"],
    ["eredivisie", "NED-Eredivisie"],
    ["liga portugal", "POR-Primeira Liga"],
    ["super lig", "TUR-Super Lig"],
    ["liga profesional", "ARG-Primera Division"],
  ]);
  return aliases.get(key) || name;
}

function seasonCode(kickoff) {
  const date = new Date(kickoff);
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 6 ? year : year - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

async function sb(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  await sb(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function insert(table, rows) {
  if (!rows.length) return;
  await sb(table, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
}

function reconcile(row, kickoff, matches) {
  const home = cleanText(row.home_team);
  const away = cleanText(row.away_team);
  const kickoffMs = new Date(kickoff).getTime();

  return (
    matches
      .map((match) => ({
        match,
        teamMatch:
          cleanText(match.home_team) === home &&
          cleanText(match.away_team) === away,
        diff: Math.abs(
          new Date(match.kickoff_at).getTime() - kickoffMs,
        ),
      }))
      .filter((candidate) => candidate.teamMatch && candidate.diff <= 8 * 60 * 60 * 1000)
      .sort((a, b) => a.diff - b.diff)[0]?.match || null
  );
}

const content = await readFile(INPUT, "utf8");
const records = content
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith("{"))
  .map((line) => JSON.parse(line));

const now = new Date().toISOString();
const kickoffValues = records
  .map((row) => parseKickoff(row.match_date))
  .filter(Boolean);
const earliest = kickoffValues.length
  ? new Date(Math.min(...kickoffValues.map((value) => new Date(value).getTime())) - 12 * 60 * 60 * 1000).toISOString()
  : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
const latest = kickoffValues.length
  ? new Date(Math.max(...kickoffValues.map((value) => new Date(value).getTime())) + 12 * 60 * 60 * 1000).toISOString()
  : new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();

const matches =
  (await sb(
    `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(earliest)}&kickoff_at=lte.${encodeURIComponent(latest)}&limit=10000`,
  )) || [];

const existing =
  (await sb(
    `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(PROVIDER)}&limit=30000`,
  )) || [];
const existingMap = new Map(existing.map((row) => [row.price_key, row]));

const fixtureRows = [];
const currentRows = [];
const historyRows = [];

for (const row of records) {
  const kickoff = parseKickoff(row.match_date);
  if (!kickoff || !row.home_team || !row.away_team) continue;

  let match = reconcile(row, kickoff, matches);
  if (!match) {
    match = {
      match_id: oddsportalMatchId(row, kickoff),
      kickoff_at: kickoff,
      home_team: row.home_team,
      away_team: row.away_team,
      league: leagueLabel(row),
    };
    matches.push(match);
    fixtureRows.push({
      match_id: match.match_id,
      league: match.league,
      season: seasonCode(kickoff),
      kickoff_at: kickoff,
      home_team: row.home_team,
      away_team: row.away_team,
      status: "scheduled",
      source: PROVIDER,
      retrieved_at: now,
    });
  }

  const eventId = providerEventId(row);
  for (const quote of row["1x2_market"] || []) {
    if (
      quote?.period &&
      !["FullTime", "Full Time", "FT"].includes(String(quote.period))
    ) {
      continue;
    }

    const bookmakerName = String(quote.bookmaker_name || "").trim();
    if (!bookmakerName) continue;
    const bookmakerKey = cleanText(bookmakerName) || "unknown";

    const outcomes = [
      ["home", quote["1"]],
      ["draw", quote["X"]],
      ["away", quote["2"]],
    ];

    for (const [selection, rawPrice] of outcomes) {
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price <= 1) continue;

      const priceKey = [
        PROVIDER,
        eventId,
        bookmakerKey,
        "1X2",
        selection,
      ].join("|");
      const before = existingMap.get(priceKey);
      const changed =
        !before ||
        Math.abs(Number(before.decimal_odds) - price) > 1e-9;

      currentRows.push({
        price_key: priceKey,
        provider: PROVIDER,
        provider_event_id: eventId,
        match_id: match.match_id,
        sport_key: SPORT_KEY,
        home_team: row.home_team,
        away_team: row.away_team,
        commence_time: kickoff,
        bookmaker_key: bookmakerKey,
        bookmaker_name: bookmakerName,
        market: "1X2",
        selection,
        line: null,
        decimal_odds: price,
        previous_decimal_odds: changed
          ? Number(before?.decimal_odds) || null
          : Number(before?.previous_decimal_odds) || null,
        provider_last_update: null,
        captured_at: now,
      });

      if (changed) {
        historyRows.push({
          price_key: priceKey,
          provider: PROVIDER,
          provider_event_id: eventId,
          match_id: match.match_id,
          bookmaker_key: bookmakerKey,
          bookmaker_name: bookmakerName,
          market: "1X2",
          selection,
          line: null,
          decimal_odds: price,
          captured_at: now,
        });
      }
    }
  }
}

await upsert("footy_matches", fixtureRows, "match_id");
await upsert("footy_live_odds_current", currentRows, "price_key");
await insert("footy_live_odds_history", historyRows);

await upsert(
  "footy_odds_feed_status",
  [{
    provider: PROVIDER,
    sport_key: SPORT_KEY,
    last_attempt_at: now,
    last_success_at: currentRows.length ? now : null,
    events_received: records.length,
    prices_received: currentRows.length,
    last_error: currentRows.length
      ? null
      : "Collector returned no usable 1X2 bookmaker prices.",
    updated_at: now,
  }],
  "provider",
);

console.log(JSON.stringify({
  provider: PROVIDER,
  matches_received: records.length,
  fixtures_inserted: fixtureRows.length,
  prices_written: currentRows.length,
  changed_prices: historyRows.length,
}, null, 2));
