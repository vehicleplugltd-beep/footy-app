import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || "";
const PROVIDER = "the-odds-api";
const FEED_KEY = "multi-soccer";
const FREE_PRICE_PROVIDER = "sofascore";
const ENABLE_SOFASCORE_FREE = process.env.ENABLE_SOFASCORE_FREE === "1";
const FLASHSCORE_PRICE_PROVIDER = "flashscore-lsapp";
const ENABLE_FLASHSCORE_FREE = process.env.ENABLE_FLASHSCORE_FREE !== "0";
const SOFASCORE_API_URLS = [
  "https://api.sofascore.com/api/v1",
  "https://www.sofascore.com/api/v1",
];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const COMPETITIONS = [
  ["soccer_epl", "ENG-Premier League", false],
  ["soccer_efl_champ", "ENG-Championship", false],
  ["soccer_england_league1", "ENG-League One", false],
  ["soccer_england_league2", "ENG-League Two", false],
  ["soccer_spl", "SCO-Premiership", false],
  ["soccer_spain_la_liga", "ESP-La Liga", false],
  ["soccer_spain_segunda_division", "ESP-Segunda", false],
  ["soccer_italy_serie_a", "ITA-Serie A", false],
  ["soccer_italy_serie_b", "ITA-Serie B", false],
  ["soccer_germany_bundesliga", "GER-Bundesliga", false],
  ["soccer_germany_bundesliga2", "GER-2. Bundesliga", false],
  ["soccer_france_ligue_one", "FRA-Ligue 1", false],
  ["soccer_france_ligue_two", "FRA-Ligue 2", false],
  ["soccer_netherlands_eredivisie", "NED-Eredivisie", false],
  ["soccer_belgium_first_div", "BEL-First Division A", false],
  ["soccer_portugal_primeira_liga", "POR-Primeira Liga", false],
  ["soccer_turkey_super_league", "TUR-Super Lig", false],
  ["soccer_greece_super_league", "GRE-Super League", false],
  ["soccer_denmark_superliga", "DEN-Superliga", false],
  ["soccer_norway_eliteserien", "NOR-Eliteserien", true],
  ["soccer_sweden_allsvenskan", "SWE-Allsvenskan", true],
  ["soccer_poland_ekstraklasa", "POL-Ekstraklasa", false],
  ["soccer_switzerland_superleague", "SUI-Super League", false],
  ["soccer_uefa_champs_league", "UEFA-Champions League", false],
  ["soccer_uefa_europa_league", "UEFA-Europa League", false],
  ["soccer_uefa_europa_conference_league", "UEFA-Conference League", false],
  ["soccer_england_efl_cup", "ENG-EFL Cup", false],
  ["soccer_fa_cup", "ENG-FA Cup", false],
  ["soccer_spain_copa_del_rey", "ESP-Copa del Rey", false],
  ["soccer_italy_coppa_italia", "ITA-Coppa Italia", false],
  ["soccer_germany_dfb_pokal", "GER-DFB Pokal", false],
  ["soccer_france_coupe_de_france", "FRA-Coupe de France", false],
  ["soccer_usa_mls", "USA-MLS", true],
  ["soccer_brazil_campeonato", "BRA-Serie A", true],
  ["soccer_argentina_primera_division", "ARG-Primera Division", true],
  ["soccer_mexico_ligamx", "MEX-Liga MX", true],
  ["soccer_fifa_world_cup_qualifiers_europe", "INT-World Cup Qualifiers Europe", true],
].map(([sportKey, league, calendarYear]) => ({
  sportKey,
  league,
  calendarYear,
}));

const COMPETITION_BY_KEY = new Map(
  COMPETITIONS.map((competition) => [competition.sportKey, competition]),
);

const OPENFOOTBALL_COMPETITIONS = [
  ["2026-27/en.1.json", "ENG-Premier League", "2627", "Europe/London"],
  ["2026-27/en.2.json", "ENG-Championship", "2627", "Europe/London"],
  ["2026-27/en.3.json", "ENG-League One", "2627", "Europe/London"],
  ["2026-27/en.4.json", "ENG-League Two", "2627", "Europe/London"],
  ["2026-27/sco.1.json", "SCO-Premiership", "2627", "Europe/London"],
  ["2026-27/sco.2.json", "SCO-Championship", "2627", "Europe/London"],
  ["2026-27/de.1.json", "GER-Bundesliga", "2627", "Europe/Berlin"],
  ["2026-27/de.2.json", "GER-2. Bundesliga", "2627", "Europe/Berlin"],
  ["2026-27/es.1.json", "ESP-La Liga", "2627", "Europe/Madrid"],
  ["2026-27/es.2.json", "ESP-La Liga 2", "2627", "Europe/Madrid"],
  ["2026-27/it.1.json", "ITA-Serie A", "2627", "Europe/Rome"],
  ["2026-27/it.2.json", "ITA-Serie B", "2627", "Europe/Rome"],
  ["2026-27/fr.1.json", "FRA-Ligue 1", "2627", "Europe/Paris"],
  ["2026-27/fr.2.json", "FRA-Ligue 2", "2627", "Europe/Paris"],
  ["2026-27/nl.1.json", "NED-Eredivisie", "2627", "Europe/Amsterdam"],
  ["2026-27/nl.2.json", "NED-Eerste Divisie", "2627", "Europe/Amsterdam"],
  ["2026-27/be.1.json", "BEL-First Division A", "2627", "Europe/Brussels"],
  ["2026-27/pt.1.json", "POR-Primeira Liga", "2627", "Europe/Lisbon"],
  ["2026-27/pt.2.json", "POR-Liga Portugal 2", "2627", "Europe/Lisbon"],
  ["2026-27/tr.1.json", "TUR-Super Lig", "2627", "Europe/Istanbul"],
  ["2026-27/gr.1.json", "GRE-Super League", "2627", "Europe/Athens"],
  ["2026-27/at.1.json", "AUT-Bundesliga", "2627", "Europe/Vienna"],
  ["2026-27/ch.1.json", "SUI-Super League", "2627", "Europe/Zurich"],
  ["2026-27/dk.1.json", "DEN-Superliga", "2627", "Europe/Copenhagen"],
  ["2026/no.1.json", "NOR-Eliteserien", "2026", "Europe/Oslo"],
  ["2026/se.1.json", "SWE-Allsvenskan", "2026", "Europe/Stockholm"],
  ["2026/ie.1.json", "IRL-Premier Division", "2026", "Europe/Dublin"],
  ["2026/br.1.json", "BRA-Serie A", "2026", "America/Sao_Paulo"],
  ["2026/ar.1.json", "ARG-Primera Division", "2026", "America/Argentina/Buenos_Aires"],
  ["2026/mls.json", "USA-MLS", "2026", "America/New_York"],
].map(([path, league, season, timeZone]) => ({ path, league, season, timeZone }));

const ESPN_COMPETITIONS = [
  ["eng.1", "ENG-Premier League"],
  ["eng.2", "ENG-Championship"],
  ["eng.3", "ENG-League One"],
  ["eng.4", "ENG-League Two"],
  ["sco.1", "SCO-Premiership"],
  ["sco.2", "SCO-Championship"],
  ["sco.3", "SCO-League One"],
  ["sco.4", "SCO-League Two"],
  ["esp.1", "ESP-La Liga"],
  ["esp.2", "ESP-La Liga 2"],
  ["ger.1", "GER-Bundesliga"],
  ["ger.2", "GER-2. Bundesliga"],
  ["ita.1", "ITA-Serie A"],
  ["ita.2", "ITA-Serie B"],
  ["fra.1", "FRA-Ligue 1"],
  ["fra.2", "FRA-Ligue 2"],
  ["ned.1", "NED-Eredivisie"],
  ["ned.2", "NED-Eerste Divisie"],
  ["por.1", "POR-Primeira Liga"],
  ["bel.1", "BEL-First Division A"],
  ["aut.1", "AUT-Bundesliga"],
  ["gre.1", "GRE-Super League"],
  ["tur.1", "TUR-Super Lig"],
  ["den.1", "DEN-Superliga"],
  ["nor.1", "NOR-Eliteserien"],
  ["swe.1", "SWE-Allsvenskan"],
  ["irl.1", "IRL-Premier Division"],
  ["uefa.champions", "UEFA-Champions League"],
  ["uefa.europa", "UEFA-Europa League"],
  ["uefa.europa.conf", "UEFA-Conference League"],
  ["usa.1", "USA-MLS"],
  ["bra.1", "BRA-Serie A"],
  ["arg.1", "ARG-Primera Division"],
  ["mex.1", "MEX-Liga MX"],
].map(([slug, league]) => ({ slug, league }));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase server credentials");
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const TEAM_ALIASES = new Map(Object.entries({
  "afc bournemouth": "bournemouth",
  "bournemouth": "bournemouth",
  "leeds united": "leeds",
  "leeds": "leeds",
  "brighton and hove albion": "brighton",
  "brighton & hove albion": "brighton",
  "brighton": "brighton",
  "tottenham hotspur": "tottenham",
  "tottenham": "tottenham",
  "nottingham forest": "nottingham forest",
  "nottm forest": "nottingham forest",
  "wolverhampton wanderers": "wolves",
  "wolves": "wolves",
  "west ham united": "west ham",
  "west ham": "west ham",
  "newcastle united": "newcastle",
  "newcastle": "newcastle",
  "manchester united": "manchester united",
  "man utd": "manchester united",
  "manchester city": "manchester city",
  "man city": "manchester city",
  "ipswich town": "ipswich",
  "ipswich": "ipswich",
  "hull city": "hull",
  "hull": "hull",
  "coventry city": "coventry",
  "coventry": "coventry",
  "crystal palace": "crystal palace",
  "aston villa": "aston villa",
  "brentford": "brentford",
  "chelsea": "chelsea",
  "arsenal": "arsenal",
  "liverpool": "liverpool",
  "fulham": "fulham",
  "everton": "everton",
  "sunderland": "sunderland",
}));

function cleanText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalTeam(value) {
  const cleaned = cleanText(value);
  return TEAM_ALIASES.get(cleaned) || cleaned;
}

function compact(value) {
  return cleanText(value).replace(/[^a-z0-9]/g, "");
}

function canonicalMarket(value) {
  const market = cleanText(value);
  if (
    ["1x2", "match result", "match winner", "moneyline", "h2h", "full time result"].includes(market)
  ) {
    return "1X2";
  }
  return String(value || "").trim();
}

function seasonCodeFor(dateValue, calendarYear = false) {
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return "unknown";
  const year = date.getUTCFullYear();
  if (calendarYear) return String(year);
  const start = date.getUTCMonth() >= 6 ? year : year - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

function syntheticMatchId(sportKey, eventId) {
  return `odds:${sportKey}:${eventId}`;
}

async function oddsApi(path, params = {}) {
  const endpoint = new URL(`https://api.the-odds-api.com/v4/${path}`);
  endpoint.searchParams.set("apiKey", ODDS_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) endpoint.searchParams.set(key, String(value));
  }

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Odds API ${response.status} for ${path}: ${body.slice(0, 500)}`,
    );
  }
  return {
    data: body ? JSON.parse(body) : [],
    headers: response.headers,
  };
}

async function sb(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders,
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

async function patch(table, filter, body) {
  await sb(`${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
}

async function recordFeedStatus(fields) {
  await upsert(
    "footy_odds_feed_status",
    [{
      provider: PROVIDER,
      sport_key: FEED_KEY,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...fields,
    }],
    "provider",
  );
}

function yyyymmdd(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("");
}

function londonDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}${values.month}${values.day}`;
}

function londonIsoDate(date) {
  const key = londonDateKey(date);
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

function sofascoreDecimal(choice) {
  const direct = Number(choice?.decimalValue ?? choice?.value);
  if (Number.isFinite(direct) && direct > 1) return direct;

  const fraction = String(choice?.fractionalValue || "").trim();
  const parts = fraction.split("/");
  if (parts.length === 2) {
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (
      Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      denominator > 0
    ) {
      return 1 + numerator / denominator;
    }
  }
  return null;
}

function sofascoreSelection(event, choiceName) {
  const raw = cleanText(choiceName);
  if (["1", "home", "home win"].includes(raw)) return "home";
  if (["x", "draw"].includes(raw)) return "draw";
  if (["2", "away", "away win"].includes(raw)) return "away";

  const candidate = canonicalTeam(choiceName);
  if (candidate === canonicalTeam(event?.homeTeam?.name)) return "home";
  if (candidate === canonicalTeam(event?.awayTeam?.name)) return "away";
  return null;
}

function sofascoreLeague(event) {
  const name = String(
    event?.tournament?.uniqueTournament?.name ||
      event?.tournament?.name ||
      "Football",
  ).trim();
  const country = String(
    event?.tournament?.category?.alpha2 ||
      event?.tournament?.category?.flag ||
      event?.tournament?.category?.name ||
      "",
  ).toUpperCase();

  const key = cleanText(name);
  const aliases = new Map([
    ["premier league|EN", "ENG-Premier League"],
    ["championship|EN", "ENG-Championship"],
    ["league one|EN", "ENG-League One"],
    ["league two|EN", "ENG-League Two"],
    ["premiership|SC", "SCO-Premiership"],
    ["laliga|ES", "ESP-La Liga"],
    ["la liga|ES", "ESP-La Liga"],
    ["serie a|IT", "ITA-Serie A"],
    ["serie b|IT", "ITA-Serie B"],
    ["bundesliga|DE", "GER-Bundesliga"],
    ["2 bundesliga|DE", "GER-2. Bundesliga"],
    ["ligue 1|FR", "FRA-Ligue 1"],
    ["ligue 2|FR", "FRA-Ligue 2"],
    ["eredivisie|NL", "NED-Eredivisie"],
    ["primeira liga|PT", "POR-Primeira Liga"],
    ["super lig|TR", "TUR-Super Lig"],
  ]);

  for (const [alias, label] of aliases) {
    const [leagueName, code] = alias.split("|");
    if (key === leagueName && (!code || country.startsWith(code))) return label;
  }

  return name;
}

async function sofascore(path) {
  const errors = [];
  for (const base of SOFASCORE_API_URLS) {
    const response = await fetch(`${base}/${path}`, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-GB,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Referer: "https://www.sofascore.com/",
        Origin: "https://www.sofascore.com",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
      },
    });
    const body = await response.text();
    if (response.ok) return body ? JSON.parse(body) : {};
    errors.push(`${base}: ${response.status}`);
  }

  try {
    const output = execFileSync(
      "python",
      [join(SCRIPT_DIR, "fetch-sofascore.py"), path],
      {
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return output ? JSON.parse(output) : {};
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error);
    throw new Error(
      `Sofascore browser fetch failed for ${path}: ${[...errors, detail].join(" | ").slice(0, 1000)}`,
    );
  }
}

async function syncSofascorePrices(capturedAt) {
  const date = londonIsoDate(new Date(capturedAt));
  const [fixturesPayload, oddsPayload] = await Promise.all([
    sofascore(`sport/football/scheduled-events/${date}`),
    sofascore(`sport/football/odds/1/${date}`),
  ]);

  const events = fixturesPayload?.events || [];
  const oddsByEvent = oddsPayload?.odds || {};

  const dayStart = new Date(
    new Date(capturedAt).getTime() - 18 * 60 * 60 * 1000,
  ).toISOString();
  const dayEnd = new Date(
    new Date(capturedAt).getTime() + 36 * 60 * 60 * 1000,
  ).toISOString();

  const matches =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(dayStart)}&kickoff_at=lte.${encodeURIComponent(dayEnd)}&limit=10000`,
    )) || [];

  const existing =
    (await sb(
      `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(FREE_PRICE_PROVIDER)}&captured_at=gte.${encodeURIComponent(new Date(new Date(capturedAt).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())}&limit=20000`,
    )) || [];
  const existingMap = new Map(existing.map((row) => [row.price_key, row]));

  const fixtureRows = [];
  const currentRows = [];
  const historyRows = [];

  for (const event of events) {
    const eventId = String(event?.id || "");
    const homeTeam = event?.homeTeam?.name;
    const awayTeam = event?.awayTeam?.name;
    const kickoff =
      Number.isFinite(Number(event?.startTimestamp))
        ? new Date(Number(event.startTimestamp) * 1000).toISOString()
        : null;
    if (!eventId || !homeTeam || !awayTeam || !kickoff) continue;

    const candidate = {
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: kickoff,
    };
    let footyMatch = reconcileMatch(candidate, matches);
    if (!footyMatch) {
      footyMatch = {
        match_id: `sofascore:${eventId}`,
        kickoff_at: kickoff,
        home_team: homeTeam,
        away_team: awayTeam,
        league: sofascoreLeague(event),
      };
      matches.push(footyMatch);
      fixtureRows.push({
        match_id: footyMatch.match_id,
        league: footyMatch.league,
        season: seasonCodeFor(kickoff),
        kickoff_at: kickoff,
        home_team: homeTeam,
        away_team: awayTeam,
        status:
          event?.status?.type === "finished"
            ? "finished"
            : event?.status?.type === "inprogress"
              ? "in_progress"
              : "scheduled",
        source: "sofascore",
        retrieved_at: capturedAt,
      });
    }

    const market = oddsByEvent[eventId];
    if (!market || market?.isLive === true) continue;

    const choices = Array.isArray(market?.choices) ? market.choices : [];
    for (const choice of choices) {
      const selection = sofascoreSelection(event, choice?.name);
      const price = sofascoreDecimal(choice);
      if (!selection || !price || price <= 1) continue;

      const sourceId = String(
        choice?.sourceId ?? market?.sourceId ?? "market",
      );
      const priceKey = [
        FREE_PRICE_PROVIDER,
        eventId,
        sourceId,
        "1X2",
        selection,
      ].join("|");
      const before = existingMap.get(priceKey);
      const changed =
        !before ||
        Math.abs(Number(before.decimal_odds) - Number(price)) > 1e-9;

      const row = {
        price_key: priceKey,
        provider: FREE_PRICE_PROVIDER,
        provider_event_id: eventId,
        match_id: footyMatch.match_id,
        sport_key: "football",
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: kickoff,
        bookmaker_key: `sofascore:${sourceId}`,
        bookmaker_name: "Sofascore market",
        market: "1X2",
        selection,
        line: null,
        decimal_odds: Number(price),
        previous_decimal_odds: changed
          ? Number(before?.decimal_odds) || null
          : Number(before?.previous_decimal_odds) || null,
        provider_last_update: null,
        captured_at: capturedAt,
      };
      currentRows.push(row);

      if (changed) {
        historyRows.push({
          price_key: priceKey,
          provider: FREE_PRICE_PROVIDER,
          provider_event_id: eventId,
          match_id: footyMatch.match_id,
          bookmaker_key: `sofascore:${sourceId}`,
          bookmaker_name: "Sofascore market",
          market: "1X2",
          selection,
          line: null,
          decimal_odds: Number(price),
          captured_at: capturedAt,
        });
      }
    }
  }

  await upsert("footy_matches", fixtureRows, "match_id");
  await upsert("footy_live_odds_current", currentRows, "price_key");
  await insert("footy_live_odds_history", historyRows);
  await upsert(
    "footy_odds_feed_status",
    [{
      provider: FREE_PRICE_PROVIDER,
      sport_key: "football",
      last_attempt_at: capturedAt,
      last_success_at: capturedAt,
      events_received: events.length,
      prices_received: currentRows.length,
      last_error: null,
      updated_at: capturedAt,
    }],
    "provider",
  );

  return {
    events: events.length,
    fixtureRows: fixtureRows.length,
    prices: currentRows.length,
    changedPrices: historyRows.length,
    rows: currentRows,
  };
}


async function syncFlashscorePrices(capturedAt) {
  let payload;
  try {
    const output = execFileSync(
      "python",
      [join(SCRIPT_DIR, "fetch-flashscore-prices.py")],
      {
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    payload = output ? JSON.parse(output) : {};
  } catch (error) {
    const detail = String(error?.stdout || error?.stderr || error?.message || error);
    throw new Error(
      `Flashscore collector failed: ${detail.slice(0, 1200)}`,
    );
  }

  const events = Array.isArray(payload?.events) ? payload.events : [];
  const prices = Array.isArray(payload?.prices) ? payload.prices : [];
  const collectorErrors = Array.isArray(payload?.errors) ? payload.errors : [];

  const dayStart = new Date(
    new Date(capturedAt).getTime() - 18 * 60 * 60 * 1000,
  ).toISOString();
  const dayEnd = new Date(
    new Date(capturedAt).getTime() + 36 * 60 * 60 * 1000,
  ).toISOString();

  const matches =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(dayStart)}&kickoff_at=lte.${encodeURIComponent(dayEnd)}&limit=10000`,
    )) || [];

  const existing =
    (await sb(
      `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(FLASHSCORE_PRICE_PROVIDER)}&captured_at=gte.${encodeURIComponent(new Date(new Date(capturedAt).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())}&limit=30000`,
    )) || [];
  const existingMap = new Map(existing.map((row) => [row.price_key, row]));

  const currentRows = [];
  const historyRows = [];
  let unmatchedPrices = 0;

  for (const price of prices) {
    const candidate = {
      home_team: price.home_team,
      away_team: price.away_team,
      commence_time: price.commence_time,
    };
    const match = reconcileMatch(candidate, matches);
    if (!match) {
      unmatchedPrices += 1;
      continue;
    }

    const decimalOdds = Number(price.decimal_odds);
    if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) continue;
    if (!["home", "draw", "away"].includes(price.selection)) continue;

    const bookmakerKey = `flashscore:${price.bookmaker_id}`;
    const priceKey = [
      FLASHSCORE_PRICE_PROVIDER,
      String(price.event_id),
      bookmakerKey,
      "1X2",
      price.selection,
    ].join("|");
    const before = existingMap.get(priceKey);
    const changed =
      !before ||
      Math.abs(Number(before.decimal_odds) - decimalOdds) > 1e-9;

    const row = {
      price_key: priceKey,
      provider: FLASHSCORE_PRICE_PROVIDER,
      provider_event_id: String(price.event_id),
      match_id: match.match_id,
      sport_key: "football",
      home_team: match.home_team,
      away_team: match.away_team,
      commence_time: match.kickoff_at,
      bookmaker_key: bookmakerKey,
      bookmaker_name: String(price.bookmaker_name),
      market: "1X2",
      selection: price.selection,
      line: null,
      decimal_odds: decimalOdds,
      previous_decimal_odds: changed
        ? Number(before?.decimal_odds) || null
        : Number(before?.previous_decimal_odds) || null,
      provider_last_update: null,
      captured_at: capturedAt,
    };
    currentRows.push(row);

    if (changed) {
      historyRows.push({
        price_key: priceKey,
        provider: FLASHSCORE_PRICE_PROVIDER,
        provider_event_id: String(price.event_id),
        match_id: match.match_id,
        bookmaker_key: bookmakerKey,
        bookmaker_name: String(price.bookmaker_name),
        market: "1X2",
        selection: price.selection,
        line: null,
        decimal_odds: decimalOdds,
        captured_at: capturedAt,
      });
    }
  }

  await upsert("footy_live_odds_current", currentRows, "price_key");
  await insert("footy_live_odds_history", historyRows);

  const lastError =
    collectorErrors.length || unmatchedPrices
      ? [
          collectorErrors.length
            ? `${collectorErrors.length} event request error${collectorErrors.length === 1 ? "" : "s"}`
            : null,
          unmatchedPrices
            ? `${unmatchedPrices} price row${unmatchedPrices === 1 ? "" : "s"} could not be reconciled`
            : null,
        ].filter(Boolean).join(" · ")
      : null;

  await upsert(
    "footy_odds_feed_status",
    [{
      provider: FLASHSCORE_PRICE_PROVIDER,
      sport_key: "football",
      last_attempt_at: capturedAt,
      last_success_at: currentRows.length ? capturedAt : null,
      events_received: events.length,
      prices_received: currentRows.length,
      last_error: lastError,
      updated_at: capturedAt,
    }],
    "provider",
  );

  return {
    events: events.length,
    sourcePrices: prices.length,
    prices: currentRows.length,
    changedPrices: historyRows.length,
    unmatchedPrices,
    collectorErrors: collectorErrors.length,
  };
}

function timeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}

function zonedLocalToIso(dateValue, timeValue, timeZone) {
  if (!dateValue) return null;
  const time = String(timeValue || "12:00");
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  let offset = timeZoneOffsetMs(guess, timeZone);
  let actual = new Date(guess.getTime() - offset);
  const refinedOffset = timeZoneOffsetMs(actual, timeZone);
  if (refinedOffset !== offset) {
    actual = new Date(guess.getTime() - refinedOffset);
  }
  return actual.toISOString();
}

function openFootballMatchId(league, dateValue, homeTeam, awayTeam) {
  return [
    "openfootball",
    compact(league),
    dateValue,
    compact(homeTeam),
    compact(awayTeam),
  ].join(":");
}

async function fetchOpenFootballFile(path) {
  const url =
    `https://raw.githubusercontent.com/openfootball/football.json/master/${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "footy-app-fixture-sync/1.0",
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `OpenFootball ${path} ${response.status}: ${(await response.text()).slice(0, 220)}`,
    );
  }
  return await response.json();
}

async function syncOpenFootballFixtures(capturedAt) {
  const londonToday = londonDateKey(new Date(capturedAt));
  const rows = [];
  const errors = [];
  let filesLoaded = 0;

  for (let index = 0; index < OPENFOOTBALL_COMPETITIONS.length; index += 6) {
    const batch = OPENFOOTBALL_COMPETITIONS.slice(index, index + 6);
    const results = await Promise.allSettled(
      batch.map(async (competition) => ({
        competition,
        payload: await fetchOpenFootballFile(competition.path),
      })),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason?.message || result.reason));
        continue;
      }
      const { competition, payload } = result.value;
      if (!payload) continue;
      filesLoaded += 1;

      for (const match of payload.matches || []) {
        if (!match?.date || !match?.team1 || !match?.team2) continue;
        const kickoff = zonedLocalToIso(
          match.date,
          match.time || "12:00",
          competition.timeZone,
        );
        if (!kickoff) continue;

        const londonKey = londonDateKey(new Date(kickoff));
        if (londonKey !== londonToday) continue;

        const status =
          match.status === "postponed"
            ? "postponed"
            : match.score
              ? "finished"
              : "scheduled";

        rows.push({
          match_id: openFootballMatchId(
            competition.league,
            match.date,
            match.team1,
            match.team2,
          ),
          league: competition.league,
          season: competition.season,
          kickoff_at: kickoff,
          home_team: match.team1,
          away_team: match.team2,
          status,
          source: "openfootball-json",
          retrieved_at: capturedAt,
        });
      }
    }
  }

  if (rows.length) {
    const dayStart = new Date(
      new Date(capturedAt).getTime() - 30 * 60 * 60 * 1000,
    ).toISOString();
    const dayEnd = new Date(
      new Date(capturedAt).getTime() + 30 * 60 * 60 * 1000,
    ).toISOString();
    const existing =
      (await sb(
        `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(dayStart)}&kickoff_at=lte.${encodeURIComponent(dayEnd)}&limit=10000`,
      )) || [];

    const inserts = [];
    for (const row of rows) {
      const matched = reconcileMatch(
        {
          home_team: row.home_team,
          away_team: row.away_team,
          commence_time: row.kickoff_at,
        },
        existing,
      );
      if (matched) continue;
      inserts.push(row);
      existing.push(row);
    }
    await upsert("footy_matches", inserts, "match_id");

    await upsert(
      "footy_odds_feed_status",
      [{
        provider: "openfootball-fixtures",
        sport_key: "multi-league",
        last_attempt_at: capturedAt,
        last_success_at: capturedAt,
        events_received: rows.length,
        prices_received: 0,
        last_error: errors.length
          ? `${errors.length} fixture file${errors.length === 1 ? "" : "s"} unavailable`
          : null,
        updated_at: capturedAt,
      }],
      "provider",
    );

    return {
      discovered: rows.length,
      inserted: inserts.length,
      leagues: new Set(rows.map((row) => row.league)).size,
      filesLoaded,
      errors: errors.length,
    };
  }

  await upsert(
    "footy_odds_feed_status",
    [{
      provider: "openfootball-fixtures",
      sport_key: "multi-league",
      last_attempt_at: capturedAt,
      last_success_at: capturedAt,
      events_received: 0,
      prices_received: 0,
      last_error: errors.length
        ? `${errors.length} fixture file${errors.length === 1 ? "" : "s"} unavailable`
        : null,
      updated_at: capturedAt,
    }],
    "provider",
  );

  return {
    discovered: 0,
    inserted: 0,
    leagues: 0,
    filesLoaded,
    errors: errors.length,
  };
}

function titleFromSlug(value) {
  const slug = String(value || "")
    .replace(/^\d{4}(?:-\d{2})?-/, "")
    .replace(/-/g, " ")
    .trim();
  if (!slug) return "Football";
  return slug.replace(/\b\w/g, (char) => char.toUpperCase());
}

function espnLeagueLabel(event) {
  const slug = String(event?.season?.slug || "").toLowerCase();
  const known = [
    ["english-premier-league", "ENG-Premier League"],
    ["english-league-championship", "ENG-Championship"],
    ["english-league-one", "ENG-League One"],
    ["english-league-two", "ENG-League Two"],
    ["spanish-laliga", "ESP-La Liga"],
    ["spanish-laliga-2", "ESP-La Liga 2"],
    ["german-bundesliga", "GER-Bundesliga"],
    ["german-2-bundesliga", "GER-2. Bundesliga"],
    ["italian-serie-a", "ITA-Serie A"],
    ["italian-serie-b", "ITA-Serie B"],
    ["french-ligue-1", "FRA-Ligue 1"],
    ["french-ligue-2", "FRA-Ligue 2"],
    ["dutch-eredivisie", "NED-Eredivisie"],
    ["scottish-premiership", "SCO-Premiership"],
    ["portuguese-primeira-liga", "POR-Primeira Liga"],
    ["belgian-pro-league", "BEL-First Division A"],
    ["turkish-super-lig", "TUR-Super Lig"],
    ["greek-super-league", "GRE-Super League"],
    ["uefa-champions-league", "UEFA-Champions League"],
    ["uefa-europa-league", "UEFA-Europa League"],
    ["uefa-conference-league", "UEFA-Conference League"],
    ["major-league-soccer", "USA-MLS"],
    ["brazilian-serie-a", "BRA-Serie A"],
    ["argentine-liga-profesional", "ARG-Primera Division"],
    ["mexican-liga-bbva-mx", "MEX-Liga MX"],
  ];
  for (const [needle, label] of known) {
    if (slug.includes(needle)) return label;
  }
  return titleFromSlug(slug || event?.name || "football");
}

function espnSeasonCode(event) {
  const slug = String(event?.season?.slug || "");
  const pair = slug.match(/^(\d{4})-(\d{2})-/);
  if (pair) return `${pair[1].slice(-2)}${pair[2]}`;
  const year = Number(event?.season?.year);
  return Number.isFinite(year) ? String(year) : "unknown";
}

function espnFixture(event) {
  const competition = event?.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  const home = competitors.find((row) => row.homeAway === "home");
  const away = competitors.find((row) => row.homeAway === "away");
  const homeTeam = home?.team?.displayName || home?.team?.shortDisplayName;
  const awayTeam = away?.team?.displayName || away?.team?.shortDisplayName;
  const kickoff = event.date || competition.date;
  if (!event.id || !homeTeam || !awayTeam || !kickoff) return null;

  const state = String(event?.status?.type?.state || "").toLowerCase();
  const status =
    state === "post"
      ? "finished"
      : state === "in"
        ? "in_progress"
        : "scheduled";

  return {
    event,
    candidate: {
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: kickoff,
    },
    row: {
      match_id: `espn:${event.id}`,
      league: espnLeagueLabel(event),
      season: espnSeasonCode(event),
      kickoff_at: kickoff,
      home_team: homeTeam,
      away_team: awayTeam,
      status,
      source: "espn-scoreboard",
      retrieved_at: new Date().toISOString(),
    },
  };
}

function reconcileMatch(event, matches) {
  const home = canonicalTeam(event.home_team);
  const away = canonicalTeam(event.away_team);
  const eventTime = new Date(event.commence_time).getTime();

  const candidates = matches
    .filter(
      (match) =>
        canonicalTeam(match.home_team) === home &&
        canonicalTeam(match.away_team) === away,
    )
    .map((match) => ({
      match,
      diff: Math.abs(new Date(match.kickoff_at).getTime() - eventTime),
    }))
    .filter((row) => row.diff <= 6 * 60 * 60 * 1000)
    .sort((a, b) => a.diff - b.diff);

  return candidates[0]?.match || null;
}

async function reconcileUnmatchedPrices(capturedAt) {
  const start = new Date(
    new Date(capturedAt).getTime() - 36 * 60 * 60 * 1000,
  ).toISOString();
  const end = new Date(
    new Date(capturedAt).getTime() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [rows, matches] = await Promise.all([
    sb(
      `footy_live_odds_current?select=price_key,provider,provider_event_id,match_id,home_team,away_team,commence_time&match_id=is.null&commence_time=gte.${encodeURIComponent(start)}&commence_time=lte.${encodeURIComponent(end)}&limit=5000`,
    ),
    sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(start)}&kickoff_at=lte.${encodeURIComponent(end)}&limit=5000`,
    ),
  ]);

  let linked = 0;
  for (const row of rows || []) {
    const match = reconcileMatch(
      {
        home_team: row.home_team,
        away_team: row.away_team,
        commence_time: row.commence_time,
      },
      matches || [],
    );
    if (!match) continue;

    await patch(
      "footy_live_odds_current",
      `price_key=eq.${encodeURIComponent(row.price_key)}`,
      { match_id: match.match_id },
    );
    await patch(
      "footy_live_odds_history",
      [
        `provider=eq.${encodeURIComponent(row.provider)}`,
        `provider_event_id=eq.${encodeURIComponent(row.provider_event_id)}`,
        "match_id=is.null",
      ].join("&"),
      { match_id: match.match_id },
    );
    linked += 1;
  }
  return linked;
}

function outcomeSelection(event, outcomeName) {
  if (cleanText(outcomeName) === "draw") return "draw";
  const outcome = canonicalTeam(outcomeName);
  if (outcome === canonicalTeam(event.home_team)) return "home";
  if (outcome === canonicalTeam(event.away_team)) return "away";
  return null;
}

function alertSelection(alert, sample) {
  const raw = cleanText(alert.selection);
  if (["home", "draw", "away"].includes(raw)) return raw;
  const candidate = canonicalTeam(alert.selection);
  if (candidate === canonicalTeam(sample.home_team)) return "home";
  if (candidate === canonicalTeam(sample.away_team)) return "away";
  return null;
}

function bookmakerMatches(alertBookmaker, row) {
  const wanted = cleanText(alertBookmaker);
  if (!wanted || ["any", "best", "any best price"].includes(wanted)) return true;
  const title = cleanText(row.bookmaker_name);
  const key = cleanText(row.bookmaker_key);
  return (
    title === wanted ||
    key === wanted ||
    title.includes(wanted) ||
    wanted.includes(title)
  );
}

function eventMatchesAlert(alert, row) {
  if (alert.match_id) return String(alert.match_id) === String(row.match_id);
  const haystack = compact(alert.event_name);
  return (
    haystack.includes(compact(row.home_team)) &&
    haystack.includes(compact(row.away_team))
  );
}

async function evaluateAlerts(currentRows, capturedAt) {
  const alerts =
    (await sb(
      "footy_price_alerts?select=id,user_id,match_id,event_name,market,selection,bookmaker,target_odds,enabled,last_triggered_at,was_above_target,last_observed_odds&enabled=eq.true",
    )) || [];

  let triggered = 0;

  for (const alert of alerts) {
    const eventRows = currentRows.filter((row) => eventMatchesAlert(alert, row));
    if (!eventRows.length) continue;

    const selection = alertSelection(alert, eventRows[0]);
    if (!selection) continue;

    const candidates = eventRows.filter(
      (row) =>
        row.market === "1X2" &&
        row.selection === selection &&
        bookmakerMatches(alert.bookmaker, row),
    );
    if (!candidates.length) continue;

    const best = [...candidates].sort(
      (a, b) => Number(b.decimal_odds) - Number(a.decimal_odds),
    )[0];
    const observed = Number(best.decimal_odds);
    const target = Number(alert.target_odds);
    const above = observed >= target;
    const crossed = above && !Boolean(alert.was_above_target);

    if (crossed) {
      await insert("footy_alert_events", [{
        user_id: alert.user_id,
        alert_id: alert.id,
        match_id: best.match_id || alert.match_id || null,
        event_name: alert.event_name,
        market: alert.market,
        selection: alert.selection,
        bookmaker: best.bookmaker_name,
        target_odds: target,
        observed_odds: observed,
        triggered_at: capturedAt,
      }]);
      triggered += 1;
    }

    await patch(
      "footy_price_alerts",
      `id=eq.${encodeURIComponent(alert.id)}`,
      {
        was_above_target: above,
        last_observed_odds: observed,
        last_checked_at: capturedAt,
        last_triggered_at: crossed ? capturedAt : alert.last_triggered_at,
      },
    );
  }

  return triggered;
}

async function captureUserClosingLines(capturedAt) {
  const now = new Date(capturedAt);
  const windowStart = new Date(
    now.getTime() - 36 * 60 * 60 * 1000,
  ).toISOString();

  const [pendingBets, pendingLegs, recentMatches] = await Promise.all([
    sb(
      "footy_bets?select=id,match_id,kickoff_at,market,selection,bookmaker,decimal_odds,closing_odds&closing_odds=is.null&match_id=not.is.null&limit=500",
    ),
    sb(
      "footy_bet_legs?select=id,bet_id,match_id,market,selection,bookmaker,decimal_odds,closing_odds&closing_odds=is.null&match_id=not.is.null&limit=1000",
    ),
    sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team&kickoff_at=gte.${encodeURIComponent(windowStart)}&kickoff_at=lte.${encodeURIComponent(capturedAt)}&limit=500`,
    ),
  ]);

  const matchById = new Map(
    (recentMatches || []).map((row) => [String(row.match_id), row]),
  );
  const kickoffByMatch = new Map(
    (recentMatches || []).map((row) => [String(row.match_id), row.kickoff_at]),
  );

  async function closingQuote(item, explicitKickoff = null) {
    const kickoffAt =
      explicitKickoff || kickoffByMatch.get(String(item.match_id));
    if (!kickoffAt) return null;

    const kickoffMs = new Date(kickoffAt).getTime();
    if (!Number.isFinite(kickoffMs) || kickoffMs > now.getTime()) return null;
    if (now.getTime() - kickoffMs > 36 * 60 * 60 * 1000) return null;

    const searchStart = new Date(
      kickoffMs - 8 * 60 * 60 * 1000,
    ).toISOString();
    const match = matchById.get(String(item.match_id));
    const rawSelection = cleanText(item.selection);
    let normalizedSelection = rawSelection;
    if (match && !["home", "draw", "away"].includes(rawSelection)) {
      const candidate = canonicalTeam(item.selection);
      if (candidate === canonicalTeam(match.home_team)) {
        normalizedSelection = "home";
      }
      if (candidate === canonicalTeam(match.away_team)) {
        normalizedSelection = "away";
      }
    }
    if (!["home", "draw", "away"].includes(normalizedSelection)) return null;

    const rows =
      (await sb(
        `footy_live_odds_history?select=bookmaker_name,bookmaker_key,decimal_odds,captured_at&match_id=eq.${encodeURIComponent(item.match_id)}&market=eq.${encodeURIComponent(canonicalMarket(item.market))}&selection=eq.${encodeURIComponent(normalizedSelection)}&captured_at=gte.${encodeURIComponent(searchStart)}&captured_at=lte.${encodeURIComponent(kickoffAt)}&order=captured_at.desc&limit=120`,
      )) || [];

    if (!rows.length) return null;

    const wanted = cleanText(item.bookmaker || "");
    let chosen = null;
    if (wanted) {
      chosen =
        rows.find((row) => {
          const title = cleanText(row.bookmaker_name);
          const key = cleanText(row.bookmaker_key);
          return (
            title === wanted ||
            key === wanted ||
            title.includes(wanted) ||
            wanted.includes(title)
          );
        }) || null;
    }

    if (!chosen) {
      const latestAt = rows[0].captured_at;
      const latestRows = rows.filter((row) => row.captured_at === latestAt);
      chosen = [...latestRows].sort(
        (a, b) => Number(b.decimal_odds) - Number(a.decimal_odds),
      )[0];
    }

    if (!chosen) return null;
    const closingOdds = Number(chosen.decimal_odds);
    const takenOdds = Number(item.decimal_odds);
    if (!Number.isFinite(closingOdds) || closingOdds <= 1) return null;

    return {
      closing_odds: closingOdds,
      closing_bookmaker: chosen.bookmaker_name,
      closing_price_at: chosen.captured_at,
      clv:
        Number.isFinite(takenOdds) && takenOdds > 1
          ? takenOdds / closingOdds - 1
          : null,
    };
  }

  let betsUpdated = 0;
  for (const bet of pendingBets || []) {
    const quote = await closingQuote(bet, bet.kickoff_at);
    if (!quote) continue;
    await patch(
      "footy_bets",
      `id=eq.${encodeURIComponent(bet.id)}`,
      quote,
    );
    betsUpdated += 1;
  }

  let legsUpdated = 0;
  for (const leg of pendingLegs || []) {
    const quote = await closingQuote(leg);
    if (!quote) continue;
    await patch(
      "footy_bet_legs",
      `id=eq.${encodeURIComponent(leg.id)}`,
      quote,
    );
    legsUpdated += 1;
  }

  const pendingAccas =
    (await sb(
      "footy_bets?select=id,decimal_odds,leg_count,bet_type,closing_odds&closing_odds=is.null&bet_type=in.(DOUBLE,TREBLE,ACCA)&limit=300",
    )) || [];
  let accasUpdated = 0;

  for (const bet of pendingAccas) {
    const legs =
      (await sb(
        `footy_bet_legs?select=closing_odds,closing_price_at&bet_id=eq.${encodeURIComponent(bet.id)}&order=leg_no.asc`,
      )) || [];
    if (
      legs.length !== Number(bet.leg_count) ||
      legs.some(
        (leg) =>
          !Number.isFinite(Number(leg.closing_odds)) ||
          Number(leg.closing_odds) <= 1,
      )
    ) {
      continue;
    }

    const combinedClose = legs.reduce(
      (product, leg) => product * Number(leg.closing_odds),
      1,
    );
    const taken = Number(bet.decimal_odds);
    const latestCloseAt =
      legs
        .map((leg) => leg.closing_price_at)
        .filter(Boolean)
        .sort()
        .at(-1) || capturedAt;

    await patch(
      "footy_bets",
      `id=eq.${encodeURIComponent(bet.id)}`,
      {
        closing_odds: combinedClose,
        closing_bookmaker: "Combined market close",
        closing_price_at: latestCloseAt,
        clv:
          Number.isFinite(taken) && taken > 1
            ? taken / combinedClose - 1
            : null,
      },
    );
    accasUpdated += 1;
  }

  return { betsUpdated, legsUpdated, accasUpdated };
}

async function fetchEspnScoreboard(competition, dateKey) {
  const hosts = [
    "https://site.api.espn.com",
    "https://site.web.api.espn.com",
  ];
  let lastError = null;

  for (const host of hosts) {
    const endpoint = new URL(
      `${host}/apis/site/v2/sports/soccer/${competition.slug}/scoreboard`,
    );
    for (const includeLimit of [true, false]) {
      endpoint.searchParams.set("dates", dateKey);
      if (includeLimit) endpoint.searchParams.set("limit", "500");
      else endpoint.searchParams.delete("limit");

      try {
        const response = await fetch(endpoint, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          lastError = new Error(
            `ESPN ${competition.slug} ${response.status}: ${(await response.text()).slice(0, 220)}`,
          );
          continue;
        }
        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error(`ESPN ${competition.slug} unavailable`);
}

async function syncEspnFixtures(capturedAt) {
  const anchor = new Date(capturedAt);
  const dateKey = londonDateKey(anchor);

  const eventMap = new Map();
  const errors = [];

  for (let index = 0; index < ESPN_COMPETITIONS.length; index += 6) {
    const batch = ESPN_COMPETITIONS.slice(index, index + 6);
    const results = await Promise.allSettled(
      batch.map(async (competition) => ({
        competition,
        payload: await fetchEspnScoreboard(competition, dateKey),
      })),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason?.message || result.reason));
        continue;
      }
      const { competition, payload } = result.value;
      for (const event of payload.events || []) {
        if (!event?.id) continue;
        eventMap.set(`${competition.slug}:${event.id}`, {
          event,
          league: competition.league,
        });
      }
    }
  }

  const parsed = [...eventMap.values()]
    .map(({ event, league }) => {
      const item = espnFixture(event);
      if (!item) return null;
      item.row.league = league;
      return item;
    })
    .filter(Boolean);

  if (!parsed.length) {
    if (errors.length === ESPN_COMPETITIONS.length) {
      throw new Error(errors.slice(0, 4).join(" | "));
    }
    return {
      discovered: 0,
      inserted: 0,
      leagues: 0,
      errors: errors.length,
    };
  }

  const kickoffTimes = parsed
    .map((item) => new Date(item.row.kickoff_at).getTime())
    .filter(Number.isFinite);
  const earliest = new Date(Math.min(...kickoffTimes) - 8 * 60 * 60 * 1000).toISOString();
  const latest = new Date(Math.max(...kickoffTimes) + 8 * 60 * 60 * 1000).toISOString();
  const existing =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(earliest)}&kickoff_at=lte.${encodeURIComponent(latest)}&limit=10000`,
    )) || [];

  const inserts = [];
  for (const item of parsed) {
    const matched = reconcileMatch(item.candidate, existing);
    if (matched) continue;
    inserts.push({
      ...item.row,
      retrieved_at: capturedAt,
    });
    existing.push(item.row);
  }

  await upsert("footy_matches", inserts, "match_id");

  await upsert(
    "footy_odds_feed_status",
    [{
      provider: "espn-fixtures",
      sport_key: "soccer-registry",
      last_attempt_at: capturedAt,
      last_success_at: capturedAt,
      events_received: parsed.length,
      prices_received: 0,
      last_error: errors.length
        ? `${errors.length} competition feed${errors.length === 1 ? "" : "s"} unavailable`
        : null,
      updated_at: capturedAt,
    }],
    "provider",
  );

  return {
    discovered: parsed.length,
    inserted: inserts.length,
    leagues: new Set(parsed.map((item) => item.row.league)).size,
    errors: errors.length,
  };
}

async function processPriceOperations(capturedAt) {
  const reconciledPriceRows = await reconcileUnmatchedPrices(capturedAt);
  const freshCutoff = new Date(
    new Date(capturedAt).getTime() - 2 * 60 * 60 * 1000,
  ).toISOString();
  const freshRows =
    (await sb(
      `footy_live_odds_current?select=price_key,provider,provider_event_id,match_id,sport_key,home_team,away_team,commence_time,bookmaker_key,bookmaker_name,market,selection,line,decimal_odds,previous_decimal_odds,provider_last_update,captured_at&captured_at=gte.${encodeURIComponent(freshCutoff)}&limit=30000`,
    )) || [];
  const alertsTriggered = await evaluateAlerts(freshRows, capturedAt);
  const closingCapture = await captureUserClosingLines(capturedAt);

  return {
    reconciledPriceRows,
    freshRows,
    alertsTriggered,
    closingCapture,
  };
}

async function main() {
  const now = new Date();
  const capturedAt = now.toISOString();

  if (process.env.PRICE_OPS_ONLY === "1") {
    const priceOps = await processPriceOperations(capturedAt);
    console.log(JSON.stringify({
      status: "ok",
      mode: "price-ops-only",
      fresh_price_rows: priceOps.freshRows.length,
      reconciled_price_rows: priceOps.reconciledPriceRows,
      alerts_triggered: priceOps.alertsTriggered,
      closing_bets_updated: priceOps.closingCapture.betsUpdated,
      closing_legs_updated: priceOps.closingCapture.legsUpdated,
      closing_accas_updated: priceOps.closingCapture.accasUpdated,
    }, null, 2));
    return;
  }

  let openFootballSync = {
    discovered: 0,
    inserted: 0,
    leagues: 0,
    filesLoaded: 0,
    errors: 0,
  };
  try {
    openFootballSync = await syncOpenFootballFixtures(capturedAt);
  } catch (error) {
    await upsert(
      "footy_odds_feed_status",
      [{
        provider: "openfootball-fixtures",
        sport_key: "multi-league",
        last_attempt_at: capturedAt,
        last_success_at: null,
        events_received: 0,
        prices_received: 0,
        last_error: String(error?.message || error).slice(0, 1000),
        updated_at: capturedAt,
      }],
      "provider",
    );
  }

  let espnSync = { discovered: 0, inserted: 0, leagues: 0 };
  try {
    espnSync = await syncEspnFixtures(capturedAt);
  } catch (error) {
    await upsert(
      "footy_odds_feed_status",
      [{
        provider: "espn-fixtures",
        sport_key: "soccer-registry",
        last_attempt_at: capturedAt,
        last_success_at: null,
        events_received: 0,
        prices_received: 0,
        last_error: String(error?.message || error).slice(0, 1000),
        updated_at: capturedAt,
      }],
      "provider",
    );
  }

  const fixtureSync = {
    discovered: openFootballSync.discovered + espnSync.discovered,
    inserted: openFootballSync.inserted + espnSync.inserted,
    leagues: Math.max(openFootballSync.leagues, espnSync.leagues),
  };

  let flashscoreSync = {
    events: 0,
    sourcePrices: 0,
    prices: 0,
    changedPrices: 0,
    unmatchedPrices: 0,
    collectorErrors: 0,
  };
  let flashscoreError = null;
  if (ENABLE_FLASHSCORE_FREE) {
    try {
      flashscoreSync = await syncFlashscorePrices(capturedAt);
    } catch (error) {
      flashscoreError = String(error?.message || error);
      await upsert(
        "footy_odds_feed_status",
        [{
          provider: FLASHSCORE_PRICE_PROVIDER,
          sport_key: "football",
          last_attempt_at: capturedAt,
          last_success_at: null,
          events_received: 0,
          prices_received: 0,
          last_error: flashscoreError.slice(0, 1000),
          updated_at: capturedAt,
        }],
        "provider",
      );
    }
  }

  let freePriceSync = {
    events: 0,
    fixtureRows: 0,
    prices: 0,
    changedPrices: 0,
    rows: [],
  };
  let freePriceError = null;
  if (ENABLE_SOFASCORE_FREE) {
    try {
      freePriceSync = await syncSofascorePrices(capturedAt);
    } catch (error) {
      freePriceError = String(error?.message || error);
      await upsert(
        "footy_odds_feed_status",
        [{
          provider: FREE_PRICE_PROVIDER,
          sport_key: "football",
          last_attempt_at: capturedAt,
          last_success_at: null,
          events_received: 0,
          prices_received: 0,
          last_error: freePriceError.slice(0, 1000),
          updated_at: capturedAt,
        }],
        "provider",
      );
    }
  }

  if (process.env.FIXTURES_ONLY === "1") {
    console.log(JSON.stringify({
      status: "ok",
      mode: "fixtures-only",
      fixture_sources: {
        openfootball: openFootballSync,
        espn: espnSync,
      },
      fixtures_discovered: fixtureSync.discovered,
      fixtures_inserted: fixtureSync.inserted + freePriceSync.fixtureRows,
    }, null, 2));
    return;
  }

  const freePriceOps = await processPriceOperations(capturedAt);

  if (!ODDS_API_KEY) {
    console.log(JSON.stringify({
      status: freePriceOps.freshRows.length > 0 ? "free-prices" : "fixtures-only",
      fixture_sources: {
        openfootball: openFootballSync,
        espn: espnSync,
      },
      free_prices: {
        providers: [...new Set(freePriceOps.freshRows.map((row) => row.provider))],
        rows: freePriceOps.freshRows.length,
        flashscore: flashscoreSync,
        flashscore_error: flashscoreError,
        sofascore_attempted: ENABLE_SOFASCORE_FREE,
        sofascore_error: freePriceError,
      },
      fixtures_discovered: fixtureSync.discovered,
      fixtures_inserted: fixtureSync.inserted + freePriceSync.fixtureRows,
      alerts_triggered: freePriceOps.alertsTriggered,
      closing_bets_updated: freePriceOps.closingCapture.betsUpdated,
      closing_legs_updated: freePriceOps.closingCapture.legsUpdated,
      closing_accas_updated: freePriceOps.closingCapture.accasUpdated,
      reconciled_price_rows: freePriceOps.reconciledPriceRows,
      paid_odds: "optional provider disabled",
    }, null, 2));
    return;
  }
  const discoveryStart = new Date(
    now.getTime() - 6 * 60 * 60 * 1000,
  ).toISOString();
  const discoveryCutoff = new Date(
    now.getTime() + 72 * 60 * 60 * 1000,
  ).toISOString();
  const oddsCutoff = new Date(
    now.getTime() + 42 * 60 * 60 * 1000,
  ).toISOString();
  const matchCutoff = new Date(
    now.getTime() + 21 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const matches =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(discoveryStart)}&kickoff_at=lte.${encodeURIComponent(matchCutoff)}&order=kickoff_at.asc&limit=3000`,
    )) || [];

  const existingSince = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const existing =
    (await sb(
      `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(PROVIDER)}&captured_at=gte.${encodeURIComponent(existingSince)}&limit=20000`,
    )) || [];
  const existingMap = new Map(existing.map((row) => [row.price_key, row]));

  const sportsResponse = await oddsApi("sports/", {});
  const activeSoccer = new Set(
    (sportsResponse.data || [])
      .filter(
        (sport) =>
          sport.active &&
          !sport.has_outrights &&
          String(sport.group || "").toLowerCase().includes("soccer"),
      )
      .map((sport) => String(sport.key)),
  );

  const activeCompetitions = COMPETITIONS.filter((competition) =>
    activeSoccer.has(competition.sportKey),
  );

  const fixtureRows = [];
  const eventsBySport = new Map();
  const allDiscoveredEvents = [];
  const discoveryErrors = [];

  for (const competition of activeCompetitions) {
    try {
      const eventResponse = await oddsApi(
        `sports/${competition.sportKey}/events`,
        {
          dateFormat: "iso",
          commenceTimeFrom: discoveryStart,
          commenceTimeTo: discoveryCutoff,
        },
      );
      const events = eventResponse.data || [];
      eventsBySport.set(competition.sportKey, events);

      for (const event of events) {
        let footyMatch = reconcileMatch(event, matches);
        if (!footyMatch) {
          footyMatch = {
            match_id: syntheticMatchId(competition.sportKey, event.id),
            kickoff_at: event.commence_time,
            home_team: event.home_team,
            away_team: event.away_team,
            league: competition.league,
          };
          matches.push(footyMatch);
          fixtureRows.push({
            match_id: footyMatch.match_id,
            league: competition.league,
            season: seasonCodeFor(
              event.commence_time,
              competition.calendarYear,
            ),
            kickoff_at: event.commence_time,
            home_team: event.home_team,
            away_team: event.away_team,
            status: "scheduled",
            source: "the-odds-api-events",
            retrieved_at: capturedAt,
          });
        }

        allDiscoveredEvents.push({
          ...event,
          sport_key: competition.sportKey,
          league: competition.league,
          match_id: footyMatch.match_id,
        });
      }
    } catch (error) {
      discoveryErrors.push(
        `${competition.sportKey}: ${String(error?.message || error)}`,
      );
    }
  }

  await upsert("footy_matches", fixtureRows, "match_id");

  const currentRows = [];
  const historyRows = [];
  const oddsErrors = [];
  let requestCost = 0;
  let creditsRemaining = null;
  let creditsUsed = null;
  let sportsPriced = 0;

  for (const competition of activeCompetitions) {
    const discovered = eventsBySport.get(competition.sportKey) || [];
    const hasNearTermEvent = discovered.some((event) => {
      const kickoff = new Date(event.commence_time).getTime();
      return (
        Number.isFinite(kickoff) &&
        kickoff >= new Date(discoveryStart).getTime() &&
        kickoff <= new Date(oddsCutoff).getTime()
      );
    });
    if (!hasNearTermEvent) continue;

    try {
      const oddsResponse = await oddsApi(
        `sports/${competition.sportKey}/odds/`,
        {
          regions: "uk",
          markets: "h2h",
          oddsFormat: "decimal",
          dateFormat: "iso",
          commenceTimeFrom: discoveryStart,
          commenceTimeTo: oddsCutoff,
        },
      );
      sportsPriced += 1;
      requestCost +=
        Number(oddsResponse.headers.get("x-requests-last")) || 0;
      creditsRemaining =
        Number(oddsResponse.headers.get("x-requests-remaining")) ||
        creditsRemaining;
      creditsUsed =
        Number(oddsResponse.headers.get("x-requests-used")) || creditsUsed;

      for (const event of oddsResponse.data || []) {
        let footyMatch = reconcileMatch(event, matches);
        if (!footyMatch) {
          footyMatch = {
            match_id: syntheticMatchId(competition.sportKey, event.id),
            kickoff_at: event.commence_time,
            home_team: event.home_team,
            away_team: event.away_team,
            league: competition.league,
          };
        }

        for (const bookmaker of event.bookmakers || []) {
          for (const market of bookmaker.markets || []) {
            if (market.key !== "h2h") continue;

            for (const outcome of market.outcomes || []) {
              const selection = outcomeSelection(event, outcome.name);
              const price = Number(outcome.price);
              if (!selection || !Number.isFinite(price) || price <= 1) continue;

              const priceKey = [
                PROVIDER,
                competition.sportKey,
                event.id,
                bookmaker.key,
                "1X2",
                selection,
              ].join("|");

              const before = existingMap.get(priceKey);
              const changed =
                !before ||
                Math.abs(Number(before.decimal_odds) - price) > 1e-9;

              const row = {
                price_key: priceKey,
                provider: PROVIDER,
                provider_event_id: event.id,
                match_id: footyMatch.match_id,
                sport_key: competition.sportKey,
                home_team: footyMatch.home_team || event.home_team,
                away_team: footyMatch.away_team || event.away_team,
                commence_time: event.commence_time,
                bookmaker_key: bookmaker.key,
                bookmaker_name: bookmaker.title,
                market: "1X2",
                selection,
                line: null,
                decimal_odds: price,
                previous_decimal_odds: changed
                  ? Number(before?.decimal_odds) || null
                  : Number(before?.previous_decimal_odds) || null,
                provider_last_update:
                  market.last_update || bookmaker.last_update || null,
                captured_at: capturedAt,
              };

              currentRows.push(row);

              if (changed) {
                historyRows.push({
                  price_key: priceKey,
                  provider: PROVIDER,
                  provider_event_id: event.id,
                  match_id: footyMatch.match_id,
                  bookmaker_key: bookmaker.key,
                  bookmaker_name: bookmaker.title,
                  market: "1X2",
                  selection,
                  line: null,
                  decimal_odds: price,
                  captured_at: capturedAt,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      oddsErrors.push(
        `${competition.sportKey}: ${String(error?.message || error)}`,
      );
    }
  }

  await upsert("footy_live_odds_current", currentRows, "price_key");
  await insert("footy_live_odds_history", historyRows);
  const alertsTriggered = await evaluateAlerts(currentRows, capturedAt);
  const closingCapture = await captureUserClosingLines(capturedAt);

  const partialErrors = [...discoveryErrors, ...oddsErrors];
  const fatalNoCoverage =
    activeCompetitions.length === 0 ||
    (allDiscoveredEvents.length === 0 && partialErrors.length > 0);

  await recordFeedStatus({
    last_success_at: fatalNoCoverage ? null : capturedAt,
    credits_remaining: creditsRemaining,
    credits_used: creditsUsed,
    last_request_cost: requestCost || null,
    events_received: allDiscoveredEvents.length,
    prices_received: currentRows.length,
    last_error: partialErrors.length
      ? partialErrors.slice(0, 6).join(" | ").slice(0, 1000)
      : null,
  });

  if (fatalNoCoverage) {
    throw new Error(
      `No football coverage discovered. ${partialErrors.slice(0, 3).join(" | ")}`,
    );
  }

  console.log(JSON.stringify({
    status: partialErrors.length ? "partial" : "ok",
    provider: PROVIDER,
    fixture_providers: ["openfootball", "espn", "sofascore"],
    openfootball: openFootballSync,
    espn: espnSync,
    fixtures_discovered: fixtureSync.discovered,
    fixtures_inserted: fixtureSync.inserted + freePriceSync.fixtureRows,
    free_price_provider: FLASHSCORE_PRICE_PROVIDER,
    flashscore: flashscoreSync,
    flashscore_error: flashscoreError,
    sofascore_events: freePriceSync.events,
    sofascore_prices: freePriceSync.prices,
    sofascore_changed_prices: freePriceSync.changedPrices,
    reconciled_price_rows: reconciledPriceRows,
    fixture_leagues: fixtureSync.leagues,
    active_competitions: activeCompetitions.length,
    discovered_events: allDiscoveredEvents.length,
    new_fixture_rows: fixtureRows.length,
    sports_priced: sportsPriced,
    prices: currentRows.length,
    changed_prices: historyRows.length,
    alerts_triggered: alertsTriggered,
    closing_bets_updated: closingCapture.betsUpdated,
    closing_legs_updated: closingCapture.legsUpdated,
    closing_accas_updated: closingCapture.accasUpdated,
    matched_footy_events: new Set(
      currentRows.filter((row) => row.match_id).map((row) => row.match_id),
    ).size,
    request_cost: requestCost,
    credits_remaining: creditsRemaining,
    partial_errors: partialErrors.slice(0, 10),
  }, null, 2));
}

main().catch(async (error) => {
  try {
    await recordFeedStatus({
      last_error: String(error?.message || error).slice(0, 1000),
    });
  } catch {}
  throw error;
});
