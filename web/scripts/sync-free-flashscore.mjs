import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PROVIDER = "flashscore-free";
const MODEL_VERSION = "v7-r16-p50-v20";

function feedUrls(dayOffset) {
  return [
    `https://2.flashscore.ninja/2/x/feed/f_1_${dayOffset}_3_en_1`,
    `https://local-global.flashscore.ninja/2/x/feed/f_1_${dayOffset}_3_en_1`,
    `https://global.flashscore.ninja/2/x/feed/f_1_${dayOffset}_3_en_1`,
    // Legacy fallback only. The _3 feed carries tournament/country context
    // more reliably and is therefore always preferred for fixture identity.
    `https://2.flashscore.ninja/2/x/feed/f_1_${dayOffset}_2_en_1`,
  ];
}

const PRICE_LEAGUES = new Set([
  "ENG-Premier League",
  "ENG-Championship",
  "ESP-La Liga",
  "ESP-La Liga 2",
  "GER-Bundesliga",
  "GER-2. Bundesliga",
  "ITA-Serie A",
  "ITA-Serie B",
  "FRA-Ligue 1",
  "FRA-Ligue 2",
]);
const ODDS_URLS = [
  "https://global.ds.lsapp.eu/odds/pq_graphql",
  "https://2.ds.lsapp.eu/pq_graphql",
];

function assertSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase server credentials");
  }
}

const supabaseHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const flashHeaders = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  Accept: "*/*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://www.flashscore.com/",
  Origin: "https://www.flashscore.com",
  "x-fsign": "SW9D1eZo",
  Connection: "keep-alive",
  Pragma: "no-cache",
  "Cache-Control": "no-cache",
};

async function sb(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders, ...(init.headers || {}) },
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
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const teamAliases = new Map(
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
    "ath madrid": "atletico madrid",
    "ath bilbao": "athletic club",
  }),
);

function canonicalTeam(value) {
  const normalized = clean(value)
    .replace(/\b(fc|afc|cf|sc|ac|calcio|club|football|futbol)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return teamAliases.get(normalized) || normalized;
}

function teamMatches(a, b) {
  const left = canonicalTeam(a);
  const right = canonicalTeam(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const aCompact = left.replace(/\s+/g, "");
  const bCompact = right.replace(/\s+/g, "");
  return (
    aCompact.length >= 6 &&
    bCompact.length >= 6 &&
    (aCompact.includes(bCompact) || bCompact.includes(aCompact))
  );
}

function parseRecord(raw) {
  const row = {};
  for (const piece of String(raw || "").split("¬")) {
    if (!piece) continue;
    let splitAt = piece.indexOf("÷");
    if (splitAt < 0) splitAt = piece.indexOf("·");
    if (splitAt < 0) continue;
    const key = piece.slice(0, splitAt);
    const value = piece.slice(splitAt + 1);
    if (!key) continue;
    if (row[key] == null) row[key] = value;
    else row[`${key}_2`] = value;
  }
  return row;
}

function normalizeLeague(country, league) {
  const c = clean(country);
  const l = clean(league);
  const key = `${c}|${l}`;
  const aliases = new Map([
    ["england|premier league", "ENG-Premier League"],
    ["england|championship", "ENG-Championship"],
    ["england|league one", "ENG-League One"],
    ["england|league two", "ENG-League Two"],
    ["scotland|premiership", "SCO-Premiership"],
    ["spain|laliga", "ESP-La Liga"],
    ["spain|la liga", "ESP-La Liga"],
    ["spain|laliga2", "ESP-La Liga 2"],
    ["germany|bundesliga", "GER-Bundesliga"],
    ["germany|2 bundesliga", "GER-2. Bundesliga"],
    ["italy|serie a", "ITA-Serie A"],
    ["italy|serie b", "ITA-Serie B"],
    ["france|ligue 1", "FRA-Ligue 1"],
    ["france|ligue 2", "FRA-Ligue 2"],
    ["netherlands|eredivisie", "NED-Eredivisie"],
    ["portugal|liga portugal", "POR-Primeira Liga"],
    ["portugal|primeira liga", "POR-Primeira Liga"],
    ["belgium|jupiler pro league", "BEL-First Division A"],
    ["turkey|super lig", "TUR-Super Lig"],
    ["greece|super league", "GRE-Super League"],
    ["europe|champions league", "UEFA-Champions League"],
    ["europe|europa league", "UEFA-Europa League"],
    ["europe|conference league", "UEFA-Conference League"],
    ["usa|mls", "USA-MLS"],
    ["brazil|serie a", "BRA-Serie A"],
    ["argentina|liga profesional", "ARG-Primera Division"],
    ["mexico|liga mx", "MEX-Liga MX"],
  ]);
  if (aliases.has(key)) return aliases.get(key);

  const womensCompetition =
    l.includes("women") ||
    l.includes("wsl") ||
    l.includes("femin") ||
    l.includes("frauen");

  // Never promote youth, reserve, or age-group competitions into senior
  // leagues merely because their names contain "Premier League", etc.
  const ageGroup = /(?:^|[^a-z0-9])u(?:1[5-9]|2[0-3])(?:[^a-z0-9]|$)|under[ -]?(?:1[5-9]|2[0-3])|youth|reserve|development|academy/.test(l);
  if (ageGroup) {
    const prefix = c ? c.slice(0, 3).toUpperCase() : "INT";
    return `${prefix}-${league || "Youth Football"}`;
  }

  if (!womensCompetition) {
    if (c === "england" && l.includes("premier league")) return "ENG-Premier League";
    if (c === "england" && l.includes("championship")) return "ENG-Championship";
    if (c === "england" && l.includes("league one")) return "ENG-League One";
    if (c === "england" && l.includes("league two")) return "ENG-League Two";
    if (c === "scotland" && l.includes("premiership")) return "SCO-Premiership";

    if (
      c === "spain" &&
      (
        l.includes("laliga2") ||
        l.includes("la liga 2") ||
        l.includes("laliga hypermotion") ||
        l.includes("la liga hypermotion") ||
        l === "segunda division" ||
        l.startsWith("segunda division ")
      )
    ) {
      return "ESP-La Liga 2";
    }
    if (c === "spain" && (l.includes("laliga") || l.includes("la liga"))) {
      return "ESP-La Liga";
    }

    if (
      c === "germany" &&
      (l.includes("2 bundesliga") || l.includes("2. bundesliga"))
    ) {
      return "GER-2. Bundesliga";
    }
    if (c === "germany" && l.includes("bundesliga")) return "GER-Bundesliga";

    if (c === "italy" && l.includes("serie b")) return "ITA-Serie B";
    if (c === "italy" && l.includes("serie a")) return "ITA-Serie A";

    if (c === "france" && l.includes("ligue 2")) return "FRA-Ligue 2";
    if (c === "france" && l.includes("ligue 1")) return "FRA-Ligue 1";

    if (c === "netherlands" && l.includes("eredivisie")) return "NED-Eredivisie";
    if (
      c === "portugal" &&
      (l.includes("liga portugal") || l.includes("primeira liga"))
    ) {
      return "POR-Primeira Liga";
    }
    if (
      c === "belgium" &&
      (l.includes("jupiler") || l.includes("pro league"))
    ) {
      return "BEL-First Division A";
    }
    if (c === "turkey" && l.includes("super lig")) return "TUR-Super Lig";
    if (c === "greece" && l.includes("super league")) return "GRE-Super League";
  }

  if (womensCompetition && l.includes("champions league")) {
    return "UEFA-Womens Champions League";
  }
  if (womensCompetition && l.includes("europa")) {
    return "UEFA-Womens Europa Cup";
  }
  if (l.includes("champions league")) return "UEFA-Champions League";
  if (l.includes("europa league")) return "UEFA-Europa League";
  if (l.includes("conference league")) return "UEFA-Conference League";

  const prefix = c ? c.slice(0, 3).toUpperCase() : "INT";
  return `${prefix}-${league || "Football"}`;
}

function parseTodayFeed(raw) {
  const events = [];
  let context = {
    country: "",
    league: "",
  };

  for (const rawRecord of String(raw || "").split("~")) {
    const row = parseRecord(rawRecord);
    if (!Object.keys(row).length) continue;

    if (row.ZA || row.ZE || row.ZY || row.ZC) {
      const tournament = row.ZA || row.ZE || "";
      const separator = tournament.indexOf(":");
      // A new tournament header must not inherit the previous country's
      // identity. Prefer explicit country; otherwise use this header's prefix.
      const headerCountry = separator >= 0 ? tournament.slice(0, separator).trim() : "";
      context = {
        country: row.ZY || row.ZC || headerCountry,
        league: separator >= 0 ? tournament.slice(separator + 1).trim() : tournament,
      };
    }

    if (!row.AA || !row.AD || !row.AE || !row.AF) continue;

    const timestamp = Number(row.AD);
    if (!Number.isFinite(timestamp)) continue;
    events.push({
      eventId: String(row.AA),
      kickoffAt: new Date(timestamp * 1000).toISOString(),
      homeTeam: String(row.AE),
      awayTeam: String(row.AF),
      league: /(?:^|[^a-z0-9])u(?:1[5-9]|2[0-3])(?:[^a-z0-9]|$)|under[ -]?(?:1[5-9]|2[0-3])|youth|reserves?|academy/i.test(
        `${row.AE} ${row.AF}`
      )
        ? `${clean(context.country).slice(0, 3).toUpperCase() || "INT"}-Youth Football`
        : normalizeLeague(context.country, context.league),
      country: context.country,
      providerLeague: context.league,
      status: String(row.AB || "1"),
    });
  }

  return events;
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: { ...flashHeaders, ...headers },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} from ${url}: ${body.slice(0, 200)}`);
  }
  return body;
}

async function fetchDayFeed(dayOffset) {
  const errors = [];
  for (const url of feedUrls(dayOffset)) {
    try {
      const body = await fetchText(url);
      const events = parseTodayFeed(body);
      if (events.length) return { events, url };
      errors.push(`${url}: empty parsed feed`);
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }
  throw new Error(errors.join(" | ").slice(0, 1200));
}

async function fetchUpcomingFeeds(days = 21) {
  const results = await Promise.allSettled(
    Array.from({ length: days }, (_, dayOffset) => fetchDayFeed(dayOffset)),
  );
  const errors = [];
  const sources = [];
  const eventMap = new Map();

  for (const result of results) {
    if (result.status === "rejected") {
      errors.push(String(result.reason?.message || result.reason));
      continue;
    }
    sources.push(result.value.url);
    for (const event of result.value.events) {
      eventMap.set(event.eventId, event);
    }
  }

  if (!eventMap.size) {
    throw new Error(errors.join(" | ").slice(0, 1200));
  }

  return {
    events: [...eventMap.values()],
    sources,
    errors,
  };
}

function bookmakerMap(root) {
  const map = new Map();
  const entries = Array.isArray(root?.settings?.bookmakers)
    ? root.settings.bookmakers
    : [];
  for (const entry of entries) {
    const id = entry?.bookmaker?.id;
    const name = entry?.bookmaker?.name;
    if (id != null && name) map.set(String(id), String(name));
  }
  return map;
}

async function fetchEventOdds(eventId) {
  const attempts = [
    { hash: "oce", projectId: "2020", geo: "GB", subdivision: "GBENG" },
    { hash: "oce", projectId: "5", geo: "GB", subdivision: "GBENG" },
    { hash: "oce", projectId: "5", geo: "US", subdivision: "USCA" },
    { hash: "ope", projectId: "2", geo: "GB", subdivision: "GBENG" },
  ];
  const errors = [];

  for (const base of ODDS_URLS) {
    for (const config of attempts) {
      const url = new URL(base);
      url.searchParams.set("_hash", config.hash);
      url.searchParams.set("eventId", eventId);
      url.searchParams.set("projectId", config.projectId);
      url.searchParams.set("geoIpCode", config.geo);
      url.searchParams.set("geoIpSubdivisionCode", config.subdivision);

      try {
        const response = await fetch(url, {
          headers: {
            ...flashHeaders,
            Accept: "application/json,text/plain,*/*",
          },
          signal: AbortSignal.timeout(15000),
        });
        const body = await response.text();
        if (!response.ok) {
          errors.push(`${base} ${response.status}`);
          continue;
        }
        const payload = body ? JSON.parse(body) : {};
        const root = payload?.data?.findOddsByEventId;
        if (root && Array.isArray(root.odds)) return root;
        errors.push(`${base}: no odds root`);
      } catch (error) {
        errors.push(String(error?.message || error));
      }
    }
  }

  throw new Error(errors.slice(0, 8).join(" | "));
}

function londonDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const row = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${row.year}-${row.month}-${row.day}`;
}

function seasonCode(kickoffAt) {
  const date = new Date(kickoffAt);
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 6 ? year : year - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

function findMatch(event, matches) {
  const eventTime = new Date(event.kickoffAt).getTime();
  if (!Number.isFinite(eventTime)) return null;
  const candidates = matches.filter((match) =>
    match.league === event.league &&
    teamMatches(match.home_team, event.homeTeam) &&
    teamMatches(match.away_team, event.awayTeam) &&
    Math.abs(new Date(match.kickoff_at).getTime() - eventTime) <= 90 * 60 * 1000,
  );
  // Never attach an odds event to an arbitrary nearest fixture.
  return candidates.length === 1 ? candidates[0] : null;
}

function priceNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
}

function marketParticipantOrder(items) {
  const ids = [];
  for (const item of items || []) {
    const id = item?.eventParticipantId;
    if (id == null) continue;
    const key = String(id);
    if (!ids.includes(key)) ids.push(key);
  }
  return ids;
}

function normalizeMarket(entry) {
  const type = String(entry?.bettingType || "").toUpperCase();
  const scope = String(entry?.bettingScope || "FULL_TIME").toUpperCase();
  if (scope !== "FULL_TIME") return [];

  const items = Array.isArray(entry?.odds)
    ? entry.odds.filter((item) => item?.active !== false)
    : [];
  if (!items.length) return [];

  if (type === "HOME_DRAW_AWAY") {
    const participants = marketParticipantOrder(items);
    return items.flatMap((item) => {
      const id =
        item?.eventParticipantId == null
          ? null
          : String(item.eventParticipantId);
      const selection =
        id == null
          ? "draw"
          : id === participants[0]
            ? "home"
            : id === participants[1]
              ? "away"
              : null;
      const price = priceNumber(item?.value);
      return selection && price
        ? [{ market: "1X2", selection, line: null, price }]
        : [];
    });
  }

  if (type === "OVER_UNDER") {
    return items.flatMap((item) => {
      const line = Number(item?.handicap?.value);
      const selection = clean(item?.selection);
      const price = priceNumber(item?.value);
      if (
        !Number.isFinite(line) ||
        !["over", "under"].includes(selection) ||
        !price
      ) {
        return [];
      }
      return [
        {
          market: `TOTAL_${line}`,
          selection,
          line,
          price,
        },
      ];
    });
  }

  if (type === "ASIAN_HANDICAP") {
    const participants = marketParticipantOrder(items);
    return items.flatMap((item) => {
      const id =
        item?.eventParticipantId == null
          ? null
          : String(item.eventParticipantId);
      const selection =
        id === participants[0]
          ? "home"
          : id === participants[1]
            ? "away"
            : null;
      const rawLine = Number(item?.handicap?.value);
      const price = priceNumber(item?.value);
      if (!selection || !Number.isFinite(rawLine) || !price) return [];

      // Flashscore's feed expresses the handicap from the home-side
      // perspective for paired Asian handicap entries. Store the line from
      // the selected team's perspective so home -0.5 and away +0.5 are
      // represented consistently.
      const line =
        selection === "away" && rawLine !== 0
          ? -rawLine
          : rawLine;

      return [{
        market: "AH",
        selection,
        line,
        price,
      }];
    });
  }

  if (type === "BOTH_TEAMS_TO_SCORE") {
    return items.flatMap((item) => {
      const flag = item?.bothTeamsToScore;
      const price = priceNumber(item?.value);
      if (typeof flag !== "boolean" || !price) return [];
      return [
        {
          market: "BTTS",
          selection: flag ? "yes" : "no",
          line: null,
          price,
        },
      ];
    });
  }

  if (type === "DRAW_NO_BET") {
    const participants = marketParticipantOrder(items);
    return items.flatMap((item) => {
      const id =
        item?.eventParticipantId == null
          ? null
          : String(item.eventParticipantId);
      const selection =
        id === participants[0]
          ? "home"
          : id === participants[1]
            ? "away"
            : null;
      const price = priceNumber(item?.value);
      return selection && price
        ? [{ market: "DNB", selection, line: 0, price }]
        : [];
    });
  }

  if (type === "DOUBLE_CHANCE") {
    const participants = marketParticipantOrder(items);
    return items.flatMap((item) => {
      const id =
        item?.eventParticipantId == null
          ? null
          : String(item.eventParticipantId);
      const selection =
        id == null
          ? "X2"
          : id === participants[0]
            ? "1X"
            : id === participants[1]
              ? "12"
              : null;
      const price = priceNumber(item?.value);
      return selection && price
        ? [{ market: "DC", selection, line: null, price }]
        : [];
    });
  }

  return [];
}

function priceKey(eventId, bookmakerId, market, selection, line) {
  return [
    PROVIDER,
    eventId,
    bookmakerId,
    market,
    selection,
    line ?? "",
  ].join("|");
}

async function main() {
  assertSupabaseConfig();
  const capturedAt = new Date().toISOString();
  const { events, sources: feedUrlsUsed, errors: feedErrors } =
    await fetchUpcomingFeeds();

  const validation =
    (await sb(
      `footy_model_market_validation?select=league,market,status,model_version&model_version=eq.${encodeURIComponent(MODEL_VERSION)}`,
    )) || [];
  const modelLeagues = new Set(validation.map((row) => row.league));

  const start = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
  const matches =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,league,home_team,away_team,source&kickoff_at=gte.${encodeURIComponent(start)}&kickoff_at=lte.${encodeURIComponent(end)}&limit=10000`,
    )) || [];

  const existing =
    (await sb(
      `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(PROVIDER)}&limit=30000`,
    )) || [];
  const existingMap = new Map(existing.map((row) => [row.price_key, row]));

  const nowMs = Date.now();
  const fixtureCutoff = nowMs + 21 * 24 * 60 * 60 * 1000;
  const generalPriceCutoff = nowMs + 48 * 60 * 60 * 1000;
  // Research fixtures span 21 days; do not expand paid/expensive odds requests.
  const modelPriceCutoff = nowMs + 8 * 24 * 60 * 60 * 1000;

  const fixtureEvents = events
    .filter((event) => {
      const kickoff = new Date(event.kickoffAt).getTime();
      return (
        event.status === "1" &&
        Number.isFinite(kickoff) &&
        kickoff >= nowMs - 5 * 60 * 1000 &&
        kickoff <= fixtureCutoff
      );
    })
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

  const todayKey = londonDateKey(nowMs);
  const targetEvents = fixtureEvents.filter((event) => {
    const kickoff = new Date(event.kickoffAt).getTime();
    const isToday = londonDateKey(event.kickoffAt) === todayKey;
    return (
      (isToday || modelLeagues.has(event.league) || PRICE_LEAGUES.has(event.league)) &&
      kickoff <= (modelLeagues.has(event.league) || PRICE_LEAGUES.has(event.league)
        ? modelPriceCutoff
        : generalPriceCutoff)
    );
  });

  const fixtureRows = [];
  const currentRows = [];
  const historyRows = [];
  const errors = [...feedErrors];

  // Persist the near-term fixture spine independently of whether an odds
  // request succeeds. The model must never depend on a bookmaker response
  // to know that a match exists.
  for (const event of fixtureEvents) {
    let match = findMatch(event, matches);
    const status =
      event.status === "3"
        ? "finished"
        : event.status === "2"
          ? "in_progress"
          : "scheduled";

    if (match) {
      // Flashscore-owned fixture identities should self-heal when parser
      // normalization improves. Do not overwrite official/Understat rows.
      if (
        String(match.match_id || "").startsWith("flashscore:") ||
        match.source === "flashscore-feed"
      ) {
        const refreshed = {
          match_id: match.match_id,
          league: event.league,
          season: seasonCode(event.kickoffAt),
          kickoff_at: event.kickoffAt,
          home_team: event.homeTeam,
          away_team: event.awayTeam,
          status,
          source: "flashscore-feed",
          retrieved_at: capturedAt,
        };
        fixtureRows.push(refreshed);
        Object.assign(match, refreshed);
      }
      continue;
    }

    match = {
      match_id: `flashscore:${event.eventId}`,
      kickoff_at: event.kickoffAt,
      league: event.league,
      home_team: event.homeTeam,
      away_team: event.awayTeam,
      source: "flashscore-feed",
    };
    matches.push(match);
    fixtureRows.push({
      match_id: match.match_id,
      league: event.league,
      season: seasonCode(event.kickoffAt),
      kickoff_at: event.kickoffAt,
      home_team: event.homeTeam,
      away_team: event.awayTeam,
      status,
      source: "flashscore-feed",
      retrieved_at: capturedAt,
    });
  }

  let oddsResponses = 0;
  let marketEntries = 0;

  for (let index = 0; index < targetEvents.length; index += 4) {
    const batch = targetEvents.slice(index, index + 4);
    const results = await Promise.allSettled(
      batch.map(async (event) => ({
        event,
        oddsRoot: await fetchEventOdds(event.eventId),
      })),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(String(result.reason?.message || result.reason));
        continue;
      }

      const { event, oddsRoot } = result.value;
      oddsResponses += 1;
      marketEntries += Array.isArray(oddsRoot?.odds)
        ? oddsRoot.odds.length
        : 0;
      const match = findMatch(event, matches);
      if (!match) {
        errors.push(
          `No stored fixture identity after fixture pass: ${event.homeTeam} vs ${event.awayTeam}`,
        );
        continue;
      }

      const books = bookmakerMap(oddsRoot);
      for (const entry of oddsRoot.odds || []) {
        const bookmakerId = String(entry?.bookmakerId ?? "");
        if (!bookmakerId) continue;
        const bookmakerName =
          books.get(bookmakerId) || `Bookmaker ${bookmakerId}`;

        const deepMarketCoverage =
          modelLeagues.has(event.league) || PRICE_LEAGUES.has(event.league);

        for (const quote of normalizeMarket(entry)) {
          if (!deepMarketCoverage && quote.market !== "1X2") continue;

          const key = priceKey(
            event.eventId,
            bookmakerId,
            quote.market,
            quote.selection,
            quote.line,
          );
          const before = existingMap.get(key);
          const changed =
            !before ||
            Math.abs(Number(before.decimal_odds) - quote.price) > 1e-9;

          const row = {
            price_key: key,
            provider: PROVIDER,
            provider_event_id: event.eventId,
            match_id: match.match_id,
            sport_key: "football",
            home_team: match.home_team,
            away_team: match.away_team,
            commence_time: match.kickoff_at,
            bookmaker_key: `flashscore:${bookmakerId}`,
            bookmaker_name: bookmakerName,
            market: quote.market,
            selection: quote.selection,
            line: quote.line,
            decimal_odds: quote.price,
            previous_decimal_odds: changed
              ? Number(before?.decimal_odds) || null
              : Number(before?.previous_decimal_odds) || null,
            provider_last_update: null,
            captured_at: capturedAt,
          };
          currentRows.push(row);

          if (changed) {
            historyRows.push({
              price_key: key,
              provider: PROVIDER,
              provider_event_id: event.eventId,
              match_id: match.match_id,
              bookmaker_key: row.bookmaker_key,
              bookmaker_name: bookmakerName,
              market: quote.market,
              selection: quote.selection,
              line: quote.line,
              decimal_odds: quote.price,
              captured_at: capturedAt,
            });
          }
        }
      }
    }
  }

  const uniqueFixtureRows = [
    ...new Map(fixtureRows.map((row) => [row.match_id, row])).values(),
  ];
  const uniqueCurrentRows = [
    ...new Map(currentRows.map((row) => [row.price_key, row])).values(),
  ];
  const uniqueHistoryRows = [
    ...new Map(historyRows.map((row) => [row.price_key, row])).values(),
  ];

  await upsert("footy_matches", uniqueFixtureRows, "match_id");
  await upsert("footy_live_odds_current", uniqueCurrentRows, "price_key");
  await insert("footy_live_odds_history", uniqueHistoryRows);
  await upsert(
    "footy_odds_feed_status",
    [{
      provider: PROVIDER,
      sport_key: "football",
      last_attempt_at: capturedAt,
      last_success_at: currentRows.length ? capturedAt : null,
      events_received: events.length,
      prices_received: uniqueCurrentRows.length,
      last_error: errors.length
        ? [
            `events=${events.length}`,
            `targets=${targetEvents.length}`,
            `oddsResponses=${oddsResponses}`,
            `marketEntries=${marketEntries}`,
            ...errors.slice(0, 4),
          ].join(" | ").slice(0, 1000)
        : currentRows.length
          ? null
          : [
              "Feed worked but no supported-league prices were returned",
              `events=${events.length}`,
              `fixtures=${fixtureEvents.length}`,
              `targets=${targetEvents.length}`,
              `oddsResponses=${oddsResponses}`,
              `marketEntries=${marketEntries}`,
              `sampleLeagues=${[...new Set(events.map((event) => event.league))].slice(0, 12).join(",")}`,
            ].join(" | ").slice(0, 1000),
      updated_at: capturedAt,
    }],
    "provider",
  );

  console.log(
    JSON.stringify(
      {
        status: currentRows.length ? "ok" : "empty",
        provider: PROVIDER,
        feeds: feedUrlsUsed,
        events_discovered: events.length,
        fixture_events: fixtureEvents.length,
        priced_events: targetEvents.length,
        today_events_priced: targetEvents.filter(
          (event) => londonDateKey(event.kickoffAt) === todayKey,
        ).length,
        odds_responses: oddsResponses,
        market_entries: marketEntries,
        new_fixture_rows: uniqueFixtureRows.length,
        fixture_rows_deduped: fixtureRows.length - uniqueFixtureRows.length,
        prices: uniqueCurrentRows.length,
        changed_prices: uniqueHistoryRows.length,
        price_rows_deduped: currentRows.length - uniqueCurrentRows.length,
        bookmakers: new Set(currentRows.map((row) => row.bookmaker_name)).size,
        markets: [...new Set(currentRows.map((row) => row.market))].sort(),
        errors: errors.slice(0, 10),
      },
      null,
      2,
    ),
  );

  if (!uniqueCurrentRows.length) {
    throw new Error("Odds refresh returned zero usable prices; inspect footy_odds_feed_status before treating the feed as healthy.");
  }
}

export { normalizeLeague, parseTodayFeed };

const directRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (directRun) {
  main().catch(async (error) => {
    const capturedAt = new Date().toISOString();
    try {
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        await upsert(
          "footy_odds_feed_status",
          [{
            provider: PROVIDER,
            sport_key: "football",
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
    } catch {}
    throw error;
  });
}
