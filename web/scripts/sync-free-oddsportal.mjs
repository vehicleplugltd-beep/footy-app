import { createHash } from "node:crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PROVIDER = "oddsportal-free";
const MODEL_VERSION = "v7-r16-p50-v20";

const LEAGUES = [
  ["premier-league", "ENG-Premier League"],
  ["championship", "ENG-Championship"],
  ["liga", "ESP-La Liga"],
  ["bundesliga", "GER-Bundesliga"],
  ["serie-a", "ITA-Serie A"],
  ["ligue-1", "FRA-Ligue 1"],
  ["eredivisie", "NED-Eredivisie"],
  ["liga-portugal", "POR-Primeira Liga"],
  ["belgian", "BEL-First Division A"],
  ["champions-league", "UEFA-Champions League"],
  ["europa-league", "UEFA-Europa League"],
].map(([slug, league]) => ({ slug, league }));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase server credentials");
}

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function sb(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
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

function clean(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(fc|afc|cf|sc|ac|club|football|futbol|calcio)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aliases = new Map(
  Object.entries({
    "man utd": "manchester united",
    "man united": "manchester united",
    "man city": "manchester city",
    "nottm forest": "nottingham forest",
    "wolves": "wolverhampton wanderers",
    "spurs": "tottenham",
    "tottenham hotspur": "tottenham",
    "newcastle": "newcastle united",
    "west ham": "west ham united",
    "inter milan": "inter",
    "internazionale": "inter",
    "bayern munchen": "bayern munich",
    "paris sg": "paris saint germain",
    "psg": "paris saint germain",
    "atletico de madrid": "atletico madrid",
  }),
);

function canonicalTeam(value) {
  const normalized = clean(value);
  return aliases.get(normalized) || normalized;
}

function compatibleTeam(a, b) {
  const left = canonicalTeam(a);
  const right = canonicalTeam(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const compactLeft = left.replace(/\s+/g, "");
  const compactRight = right.replace(/\s+/g, "");
  return (
    compactLeft.length >= 6 &&
    compactRight.length >= 6 &&
    (compactLeft.includes(compactRight) ||
      compactRight.includes(compactLeft))
  );
}

function bookmakerKey(value) {
  const cleaned = clean(value).replace(/\s+/g, "-");
  return cleaned || "unknown";
}

function decimal(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

function findMatch(scraped, matches, league) {
  const candidates = matches.filter(
    (match) =>
      match.league === league &&
      compatibleTeam(match.home_team, scraped.homeTeam) &&
      compatibleTeam(match.away_team, scraped.awayTeam),
  );
  if (!candidates.length) return null;

  const now = Date.now();
  return [...candidates].sort((a, b) => {
    const aTime = new Date(a.kickoff_at).getTime();
    const bTime = new Date(b.kickoff_at).getTime();
    const aFuture = aTime >= now ? 0 : 1;
    const bFuture = bTime >= now ? 0 : 1;
    return aFuture - bFuture || Math.abs(aTime - now) - Math.abs(bTime - now);
  })[0];
}

function providerEventId(leagueSlug, match) {
  return createHash("sha1")
    .update(`${leagueSlug}|${match.match_id}`)
    .digest("hex")
    .slice(0, 20);
}

function addPrice({
  rows,
  history,
  existingMap,
  match,
  leagueSlug,
  bookmaker,
  market,
  selection,
  line = null,
  price,
  capturedAt,
}) {
  const decimalOdds = decimal(price);
  if (!decimalOdds || !bookmaker) return;

  const key = bookmakerKey(bookmaker);
  const priceKey = [
    PROVIDER,
    match.match_id,
    key,
    market,
    selection,
    line ?? "",
  ].join("|");
  const before = existingMap.get(priceKey);
  const changed =
    !before ||
    Math.abs(Number(before.decimal_odds) - decimalOdds) > 1e-9;

  const row = {
    price_key: priceKey,
    provider: PROVIDER,
    provider_event_id: providerEventId(leagueSlug, match),
    match_id: match.match_id,
    sport_key: leagueSlug,
    home_team: match.home_team,
    away_team: match.away_team,
    commence_time: match.kickoff_at,
    bookmaker_key: key,
    bookmaker_name: bookmaker,
    market,
    selection,
    line,
    decimal_odds: decimalOdds,
    previous_decimal_odds: changed
      ? Number(before?.decimal_odds) || null
      : Number(before?.previous_decimal_odds) || null,
    provider_last_update: null,
    captured_at: capturedAt,
  };
  rows.push(row);

  if (changed) {
    history.push({
      price_key: priceKey,
      provider: PROVIDER,
      provider_event_id: row.provider_event_id,
      match_id: match.match_id,
      bookmaker_key: key,
      bookmaker_name: bookmaker,
      market,
      selection,
      line,
      decimal_odds: decimalOdds,
      captured_at: capturedAt,
    });
  }
}

async function main() {
  const capturedAt = new Date().toISOString();
  const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const matches =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,league,home_team,away_team&kickoff_at=gte.${encodeURIComponent(recent)}&kickoff_at=lte.${encodeURIComponent(horizon)}&order=kickoff_at.asc&limit=5000`,
    )) || [];

  const existing =
    (await sb(
      `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(PROVIDER)}&limit=20000`,
    )) || [];
  const existingMap = new Map(existing.map((row) => [row.price_key, row]));

  const validationRows =
    (await sb(
      `footy_model_market_validation?select=league,market,status,model_version&model_version=eq.${encodeURIComponent(MODEL_VERSION)}`,
    )) || [];
  const modelLeagues = new Set(validationRows.map((row) => row.league));

  const { nextMatchesScraper } = await import(
    "odds-portal-scraper/lib/scraping/nextMatches/nextMatchesScraper.js"
  );
  const { default: launchBrowser } = await import(
    "odds-portal-scraper/lib/browser.js"
  );

  const browser = await launchBrowser({
    timezoneId: "Europe/London",
    locale: "en-GB",
  });

  const scraped = [];
  const errors = [];

  try {
    for (const competition of LEAGUES) {
      if (
        !modelLeagues.has(competition.league) &&
        competition.league !== "ENG-Championship"
      ) {
        continue;
      }

      try {
        await nextMatchesScraper(
          browser,
          competition.slug,
          "eu",
          async (data) => {
            scraped.push({ competition, data });
          },
          3,
        );
      } catch (error) {
        errors.push(
          `${competition.slug}: ${String(error?.message || error)}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  const currentRows = [];
  const historyRows = [];
  let unmatched = 0;

  for (const item of scraped) {
    const match = findMatch(
      item.data,
      matches,
      item.competition.league,
    );
    if (!match) {
      unmatched += 1;
      continue;
    }

    for (const quote of item.data.mlFullTime || []) {
      const bookmaker =
        quote.bookMakerName || quote.bookmakerName || "Unknown";
      addPrice({
        rows: currentRows,
        history: historyRows,
        existingMap,
        match,
        leagueSlug: item.competition.slug,
        bookmaker,
        market: "1X2",
        selection: "home",
        price: quote.hw,
        capturedAt,
      });
      addPrice({
        rows: currentRows,
        history: historyRows,
        existingMap,
        match,
        leagueSlug: item.competition.slug,
        bookmaker,
        market: "1X2",
        selection: "draw",
        price: quote.d,
        capturedAt,
      });
      addPrice({
        rows: currentRows,
        history: historyRows,
        existingMap,
        match,
        leagueSlug: item.competition.slug,
        bookmaker,
        market: "1X2",
        selection: "away",
        price: quote.aw,
        capturedAt,
      });
    }

    for (const [field, line] of [
      ["underOver15", 1.5],
      ["underOver25", 2.5],
      ["underOver35", 3.5],
    ]) {
      for (const quote of item.data[field] || []) {
        const bookmaker =
          quote.bookMakerName || quote.bookmakerName || "Unknown";
        addPrice({
          rows: currentRows,
          history: historyRows,
          existingMap,
          match,
          leagueSlug: item.competition.slug,
          bookmaker,
          market: `TOTAL_${line}`,
          selection: "over",
          line,
          price: quote.oddsOver,
          capturedAt,
        });
        addPrice({
          rows: currentRows,
          history: historyRows,
          existingMap,
          match,
          leagueSlug: item.competition.slug,
          bookmaker,
          market: `TOTAL_${line}`,
          selection: "under",
          line,
          price: quote.oddsUnder,
          capturedAt,
        });
      }
    }
  }

  await upsert("footy_live_odds_current", currentRows, "price_key");
  await insert("footy_live_odds_history", historyRows);
  await upsert(
    "footy_odds_feed_status",
    [{
      provider: PROVIDER,
      sport_key: "football",
      last_attempt_at: capturedAt,
      last_success_at: currentRows.length ? capturedAt : null,
      events_received: scraped.length,
      prices_received: currentRows.length,
      last_error: errors.length
        ? errors.slice(0, 6).join(" | ").slice(0, 1000)
        : currentRows.length
          ? null
          : "No reconciled prices collected",
      updated_at: capturedAt,
    }],
    "provider",
  );

  console.log(
    JSON.stringify(
      {
        status: currentRows.length ? "ok" : "empty",
        provider: PROVIDER,
        scraped_matches: scraped.length,
        reconciled_prices: currentRows.length,
        changed_prices: historyRows.length,
        unmatched_matches: unmatched,
        errors: errors.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main();
