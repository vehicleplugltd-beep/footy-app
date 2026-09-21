const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ODDS_API_KEY = process.env.THE_ODDS_API_KEY || "";
const PROVIDER = "the-odds-api";
const SPORT_KEY = "soccer_epl";

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
      sport_key: SPORT_KEY,
      last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...fields,
    }],
    "provider",
  );
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
      `footy_matches?select=match_id,kickoff_at&kickoff_at=gte.${encodeURIComponent(windowStart)}&kickoff_at=lte.${encodeURIComponent(capturedAt)}&limit=500`,
    ),
  ]);

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
    const rows =
      (await sb(
        `footy_live_odds_history?select=bookmaker_name,bookmaker_key,decimal_odds,captured_at&match_id=eq.${encodeURIComponent(item.match_id)}&market=eq.${encodeURIComponent(item.market)}&selection=eq.${encodeURIComponent(item.selection)}&captured_at=gte.${encodeURIComponent(searchStart)}&captured_at=lte.${encodeURIComponent(kickoffAt)}&order=captured_at.desc&limit=120`,
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
  if (!ODDS_API_KEY) {
    await recordFeedStatus({
      last_error: "THE_ODDS_API_KEY is not configured",
    });
    console.log("live odds sync skipped: THE_ODDS_API_KEY not configured");
    return;
  }

  const now = new Date();
  const capturedAt = now.toISOString();
  const futureCutoff = new Date(
    now.getTime() + 21 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const matches =
    (await sb(
      `footy_matches?select=match_id,kickoff_at,home_team,away_team,league&kickoff_at=gte.${encodeURIComponent(capturedAt)}&kickoff_at=lte.${encodeURIComponent(futureCutoff)}&order=kickoff_at.asc`,
    )) || [];

  const existing =
    (await sb(
      `footy_live_odds_current?select=price_key,decimal_odds,previous_decimal_odds&provider=eq.${encodeURIComponent(PROVIDER)}&sport_key=eq.${encodeURIComponent(SPORT_KEY)}`,
    )) || [];
  const existingMap = new Map(existing.map((row) => [row.price_key, row]));

  const endpoint = new URL(
    `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds/`,
  );
  endpoint.searchParams.set("apiKey", ODDS_API_KEY);
  endpoint.searchParams.set("regions", "uk");
  endpoint.searchParams.set("markets", "h2h");
  endpoint.searchParams.set("oddsFormat", "decimal");
  endpoint.searchParams.set("dateFormat", "iso");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    await recordFeedStatus({
      last_error: `Odds API ${response.status}: ${detail}`,
      credits_remaining:
        Number(response.headers.get("x-requests-remaining")) || null,
      credits_used: Number(response.headers.get("x-requests-used")) || null,
      last_request_cost: Number(response.headers.get("x-requests-last")) || null,
    });
    throw new Error(`Odds API ${response.status}: ${detail}`);
  }

  const events = await response.json();
  const currentRows = [];
  const historyRows = [];

  for (const event of events) {
    const footyMatch = reconcileMatch(event, matches);

    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        if (market.key !== "h2h") continue;

        for (const outcome of market.outcomes || []) {
          const selection = outcomeSelection(event, outcome.name);
          const price = Number(outcome.price);
          if (!selection || !Number.isFinite(price) || price <= 1) continue;

          const priceKey = [
            PROVIDER,
            event.id,
            bookmaker.key,
            "1X2",
            selection,
          ].join("|");

          const before = existingMap.get(priceKey);
          const changed =
            !before || Math.abs(Number(before.decimal_odds) - price) > 1e-9;

          const row = {
            price_key: priceKey,
            provider: PROVIDER,
            provider_event_id: event.id,
            match_id: footyMatch?.match_id || null,
            sport_key: SPORT_KEY,
            home_team: footyMatch?.home_team || event.home_team,
            away_team: footyMatch?.away_team || event.away_team,
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
              match_id: footyMatch?.match_id || null,
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

  await upsert("footy_live_odds_current", currentRows, "price_key");
  await insert("footy_live_odds_history", historyRows);
  const alertsTriggered = await evaluateAlerts(currentRows, capturedAt);
  const closingCapture = await captureUserClosingLines(capturedAt);

  await recordFeedStatus({
    last_success_at: capturedAt,
    credits_remaining:
      Number(response.headers.get("x-requests-remaining")) || null,
    credits_used: Number(response.headers.get("x-requests-used")) || null,
    last_request_cost: Number(response.headers.get("x-requests-last")) || null,
    events_received: events.length,
    prices_received: currentRows.length,
    last_error: null,
  });

  console.log(JSON.stringify({
    status: "ok",
    provider: PROVIDER,
    events: events.length,
    prices: currentRows.length,
    changed_prices: historyRows.length,
    alerts_triggered: alertsTriggered,
    closing_bets_updated: closingCapture.betsUpdated,
    closing_legs_updated: closingCapture.legsUpdated,
    closing_accas_updated: closingCapture.accasUpdated,
    matched_footy_events: new Set(
      currentRows.filter((row) => row.match_id).map((row) => row.match_id),
    ).size,
    credits_remaining: response.headers.get("x-requests-remaining"),
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
