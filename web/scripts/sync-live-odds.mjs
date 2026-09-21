const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || "";
const PROVIDER = "the-odds-api";
const FEED_KEY = "multi-soccer";

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

async function syncEspnFixtures(capturedAt) {
  const start = new Date(new Date(capturedAt).getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(new Date(capturedAt).getTime() + 72 * 60 * 60 * 1000);
  const dates = `${yyyymmdd(start)}-${yyyymmdd(end)}`;
  const endpoint = new URL(
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard",
  );
  endpoint.searchParams.set("dates", dates);
  endpoint.searchParams.set("limit", "1000");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `ESPN fixtures ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }

  const payload = await response.json();
  const parsed = (payload.events || [])
    .map(espnFixture)
    .filter(Boolean);

  if (!parsed.length) {
    return { discovered: 0, inserted: 0, leagues: 0 };
  }

  const existingStart = new Date(start.getTime() - 8 * 60 * 60 * 1000).toISOString();
  const existingEnd = new Date(end.getTime() + 8 * 60 * 60 * 1000).toISOString();
  const existing =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(existingStart)}&kickoff_at=lte.${encodeURIComponent(existingEnd)}&limit=5000`,
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
      sport_key: "soccer-all",
      last_attempt_at: capturedAt,
      last_success_at: capturedAt,
      events_received: parsed.length,
      prices_received: 0,
      last_error: null,
      updated_at: capturedAt,
    }],
    "provider",
  );

  return {
    discovered: parsed.length,
    inserted: inserts.length,
    leagues: new Set(parsed.map((item) => item.row.league)).size,
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
  const alerts = await sb(
    "footy_price_alerts?select=id,user_id,match_id,event_name,market,selection,bookmaker,target_odds,enabled,last_triggered_at,was_above_target,last_observed_odds&enabled=eq.true",
  ) || [];

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
  const windowStart = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();

  const [pendingBets, pendingLegs, recentMatches] = await Promise.all([
    sb(
      `footy_bets?select=id,match_id,kickoff_at,market,selection,bookmaker,decimal_odds,closing_odds&closing_odds=is.null&match_id=not.is.null&limit=500`,
    ),
    sb(
      `footy_bet_legs?select=id,bet_id,match_id,market,selection,bookmaker,decimal_odds,closing_odds&closing_odds=is.null&match_id=not.is.null&limit=1000`,
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
    const kickoffAt = explicitKickoff || kickoffByMatch.get(String(item.match_id));
    if (!kickoffAt) return null;

    const kickoffMs = new Date(kickoffAt).getTime();
    if (!Number.isFinite(kickoffMs) || kickoffMs > now.getTime()) return null;
    if (now.getTime() - kickoffMs > 36 * 60 * 60 * 1000) return null;

    const searchStart = new Date(kickoffMs - 8 * 60 * 60 * 1000).toISOString();
    const match = matchById.get(String(item.match_id));
    const rawSelection = cleanText(item.selection);
    let normalizedSelection = rawSelection;
    if (match && !["home", "draw", "away"].includes(rawSelection)) {
      const candidate = canonicalTeam(item.selection);
      if (candidate === canonicalTeam(match.home_team)) normalizedSelection = "home";
      if (candidate === canonicalTeam(match.away_team)) normalizedSelection = "away";
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
      legs.some((leg) => !Number.isFinite(Number(leg.closing_odds)) || Number(leg.closing_odds) <= 1)
    ) {
      continue;
    }

    const combinedClose = legs.reduce(
      (product, leg) => product * Number(leg.closing_odds),
      1,
    );
    const taken = Number(bet.decimal_odds);
    const latestCloseAt = legs
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

async function main() {
  const now = new Date();
  const capturedAt = now.toISOString();

  let fixtureSync = { discovered: 0, inserted: 0, leagues: 0 };
  try {
    fixtureSync = await syncEspnFixtures(capturedAt);
  } catch (error) {
    await upsert(
      "footy_odds_feed_status",
      [{
        provider: "espn-fixtures",
        sport_key: "soccer-all",
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

  if (!ODDS_API_KEY) {
    await recordFeedStatus({
      last_error: "THE_ODDS_API_KEY is not configured",
    });
    console.log(JSON.stringify({
      status: "fixtures-only",
      fixture_provider: "espn",
      fixtures_discovered: fixtureSync.discovered,
      fixtures_inserted: fixtureSync.inserted,
      leagues_discovered: fixtureSync.leagues,
      odds: "skipped: THE_ODDS_API_KEY is not configured",
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
    fixture_provider: "espn",
    fixtures_discovered: fixtureSync.discovered,
    fixtures_inserted: fixtureSync.inserted,
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
