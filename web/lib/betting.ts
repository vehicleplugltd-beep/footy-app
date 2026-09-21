const MODEL_VERSION = "v7-r16-p50-v20";
const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

export type BettingVerdict = "BET" | "WATCH" | "PASS" | "FADE";

type MatchRow = {
  match_id: string;
  kickoff_at: string;
  league: string;
  home_team: string;
  away_team: string;
  source?: string;
};

type ModelRow = {
  match_id: string;
  model_version: string;
  home_xg: number | null;
  away_xg: number | null;
  market: string;
  selection: string;
  model_probability: number;
  fair_odds: number;
  uncertainty_haircut: number | null;
  minimum_take_price: number;
  created_at: string;
};

type ValidationRow = {
  model_version: string;
  league: string;
  market: string;
  status: "APPROVED" | "WATCH" | "RESEARCH" | "PASS";
  sample_size: number;
  model_log_loss: number | null;
  benchmark_log_loss: number | null;
  close_roi: number | null;
  clv_proxy: number | null;
  bookmaker_reference: string | null;
  notes: string | null;
  evaluated_at: string;
};

type LivePriceRow = {
  match_id: string | null;
  bookmaker_key: string;
  bookmaker_name: string;
  market: string;
  selection: string;
  line: number | null;
  decimal_odds: number;
  previous_decimal_odds: number | null;
  captured_at: string;
};

type FeedRow = {
  provider: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  events_received: number | null;
  prices_received: number | null;
  last_error: string | null;
};

type QualityRow = {
  source: string;
  league: string;
  season: string;
  status: "PASS" | "WARN" | "BLOCKED";
  checked_at: string;
};

export type LeagueReadiness = {
  league: string;
  fixtures: number;
  modelledFixtures: number;
  processStatus: "PASS" | "WARN" | "MISSING";
  latestProcessAt: string | null;
  validationStatus: ValidationRow["status"] | "MISSING";
  freshPricedSelections: number;
  stage:
    | "BETTING_READY"
    | "PRICE_WATCH"
    | "MODEL_RESEARCH"
    | "PROCESS_READY"
    | "FIXTURES_ONLY";
};

type MetricRow = {
  match_id: string;
  team: string;
  goals: number | null;
  goals_conceded: number | null;
  xg: number | null;
  npxg: number | null;
  xga: number | null;
  npxga: number | null;
  shots: number | null;
  shots_on_target: number | null;
  big_chances: number | null;
  big_chances_conceded: number | null;
  box_touches: number | null;
  xa: number | null;
  set_piece_xg: number | null;
  possession: number | null;
  ppda: number | null;
  field_tilt: number | null;
  xgot: number | null;
  goals_prevented: number | null;
  verified: boolean | null;
};

export type ProcessProfile = {
  sample: number;
  xg: number | null;
  npxg: number | null;
  xga: number | null;
  npxga: number | null;
  goals: number | null;
  goalsConceded: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  bigChances: number | null;
  bigChancesConceded: number | null;
  boxTouches: number | null;
  xa: number | null;
  setPieceXg: number | null;
  possession: number | null;
  ppda: number | null;
  fieldTilt: number | null;
  xgot: number | null;
  goalsPrevented: number | null;
  verifiedShare: number;
};

export type BookmakerQuote = {
  bookmakerKey: string;
  bookmakerName: string;
  decimalOdds: number;
  previousDecimalOdds: number | null;
  capturedAt: string;
};

export type BettingSelection = {
  matchId: string;
  kickoffAt: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  selection: string;
  displaySelection: string;
  modelVersion: string;
  modelProbability: number;
  previousModelProbability: number | null;
  modelProbabilityDelta: number | null;
  fairOdds: number;
  minimumTakePrice: number;
  uncertaintyHaircut: number | null;
  homeXg: number | null;
  awayXg: number | null;
  williamHillPrice: LivePriceRow | null;
  bestPrice: LivePriceRow | null;
  bookmakerQuotes: BookmakerQuote[];
  marketPrice: number | null;
  edge: number | null;
  validationStatus: ValidationRow["status"];
  verdict: BettingVerdict;
  verdictReason: string;
  modelCreatedAt: string;
  homeProcess: ProcessProfile | null;
  awayProcess: ProcessProfile | null;
};

export type AccaCandidate = {
  id: string;
  label: string;
  legCount: number;
  legs: BettingSelection[];
  modelProbability: number;
  fairOdds: number;
  minimumTakePrice: number;
  williamHillOdds: number;
  edge: number;
  verdict: "BET";
};

export type DailyGamePrediction = {
  matchId: string;
  kickoffAt: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeXg: number | null;
  awayXg: number | null;
  outcomes: BettingSelection[];
  modelPick: BettingSelection | null;
};

type PublicCallRow = {
  call_key: string;
  source_kind: string;
  match_id: string;
  model_version: string;
  market: string;
  selection: string;
  model_probability: number;
  fair_odds: number;
  minimum_take_price: number | null;
  validation_status: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  published_at: string;
  quoted_bookmaker: string | null;
  quoted_odds: number | null;
  price_captured_at: string | null;
  closing_odds: number | null;
  home_goals: number | null;
  away_goals: number | null;
  result_status: "OPEN" | "WON" | "LOST" | "VOID";
  unit_profit: number | null;
  clv: number | null;
  settled_at: string | null;
};

export type PredictionReceipt = {
  callKey: string;
  matchId: string;
  modelVersion: string;
  market: string;
  selection: string;
  displaySelection: string;
  modelProbability: number;
  fairOdds: number;
  minimumTakePrice: number | null;
  validationStatus: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  publishedAt: string;
  quotedBookmaker: string | null;
  quotedOdds: number | null;
  closingOdds: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  resultStatus: PublicCallRow["result_status"];
  unitProfit: number | null;
  clv: number | null;
  settledAt: string | null;
};

export type PredictionResultsData = {
  receipts: PredictionReceipt[];
  summary: {
    predictions: number;
    correct: number;
    incorrect: number;
    accuracy: number | null;
    pricedBets: number;
    units: number | null;
    roi: number | null;
    averageClv: number | null;
  };
};

function canonicalFixtureTeam(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|afc|cf|sc|ac|calcio|club|football|futbol|deportivo)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function sameFixture(a: MatchRow, b: MatchRow) {
  if (
    canonicalFixtureTeam(a.home_team) !== canonicalFixtureTeam(b.home_team) ||
    canonicalFixtureTeam(a.away_team) !== canonicalFixtureTeam(b.away_team)
  ) {
    return false;
  }
  const aTime = new Date(a.kickoff_at).getTime();
  const bTime = new Date(b.kickoff_at).getTime();
  return (
    Number.isFinite(aTime) &&
    Number.isFinite(bTime) &&
    Math.abs(aTime - bTime) <= 6 * 60 * 60 * 1000
  );
}

function fotMobLeagueName(name: string, countryCode?: string | null) {
  const raw = String(name || "").trim();
  const key = raw.toLowerCase();
  const aliases: Record<string, string> = {
    "premier league": "ENG-Premier League",
    "championship": "ENG-Championship",
    "league one": "ENG-League One",
    "league two": "ENG-League Two",
    "premiership": countryCode === "SCO" ? "SCO-Premiership" : raw,
    "la liga": "ESP-La Liga",
    "laliga": "ESP-La Liga",
    "serie a": countryCode === "ITA" ? "ITA-Serie A" : raw,
    "serie b": countryCode === "ITA" ? "ITA-Serie B" : raw,
    "bundesliga": countryCode === "GER" ? "GER-Bundesliga" : raw,
    "2. bundesliga": "GER-2. Bundesliga",
    "ligue 1": "FRA-Ligue 1",
    "ligue 2": "FRA-Ligue 2",
    "eredivisie": "NED-Eredivisie",
    "primeira liga": "POR-Primeira Liga",
    "super lig": "TUR-Super Lig",
    "super league": countryCode === "GRE" ? "GRE-Super League" : raw,
    "major league soccer": "USA-MLS",
  };
  if (aliases[key]) return aliases[key];
  return countryCode ? `${countryCode}-${raw}` : raw || "Football";
}

async function fetchFotMobFixtures(nowDate: Date): Promise<MatchRow[]> {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(nowDate)
    .replaceAll("-", "");

  const endpoints = [
    `https://www.fotmob.com/api/data/matches?date=${date}&timezone=Europe%2FLondon&ccode3=GBR`,
    `https://www.fotmob.com/api/matches?date=${date}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
          Referer: "https://www.fotmob.com/",
        },
        next: { revalidate: 300 },
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const leagues = Array.isArray(payload?.leagues) ? payload.leagues : [];
      const rows: MatchRow[] = [];

      for (const league of leagues) {
        for (const match of league?.matches ?? []) {
          if (match?.status?.cancelled) continue;
          const kickoff =
            match?.status?.utcTime ??
            (Number.isFinite(Number(match?.timeTS))
              ? new Date(Number(match.timeTS)).toISOString()
              : null);
          const home = match?.home?.name;
          const away = match?.away?.name;
          if (!match?.id || !kickoff || !home || !away) continue;

          rows.push({
            match_id: `fotmob:${match.id}`,
            kickoff_at: kickoff,
            league: fotMobLeagueName(
              league?.name ?? match?.league?.name ?? "Football",
              league?.ccode ?? match?.league?.ccode ?? null,
            ),
            home_team: home,
            away_team: away,
            source: "fotmob",
          });
        }
      }

      if (rows.length) return rows;
    } catch {
      // Fall through to the next verified FotMob route.
    }
  }

  return [];
}

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

function latestRows<T extends { match_id: string; market: string; selection: string; created_at: string }>(
  rows: T[],
) {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.match_id}:${row.market}:${row.selection}`;
    const current = latest.get(key);
    if (!current || current.created_at < row.created_at) latest.set(key, row);
  }
  return [...latest.values()];
}

function avg(rows: MetricRow[], key: keyof MetricRow) {
  const values = rows
    .map((row) => row[key])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function processProfile(rows: MetricRow[]): ProcessProfile | null {
  if (!rows.length) return null;
  return {
    sample: rows.length,
    xg: avg(rows, "xg"),
    npxg: avg(rows, "npxg"),
    xga: avg(rows, "xga"),
    npxga: avg(rows, "npxga"),
    goals: avg(rows, "goals"),
    goalsConceded: avg(rows, "goals_conceded"),
    shots: avg(rows, "shots"),
    shotsOnTarget: avg(rows, "shots_on_target"),
    bigChances: avg(rows, "big_chances"),
    bigChancesConceded: avg(rows, "big_chances_conceded"),
    boxTouches: avg(rows, "box_touches"),
    xa: avg(rows, "xa"),
    setPieceXg: avg(rows, "set_piece_xg"),
    possession: avg(rows, "possession"),
    ppda: avg(rows, "ppda"),
    fieldTilt: avg(rows, "field_tilt"),
    xgot: avg(rows, "xgot"),
    goalsPrevented: avg(rows, "goals_prevented"),
    verifiedShare: rows.filter((row) => row.verified).length / rows.length,
  };
}

function displaySelection(match: MatchRow, selection: string) {
  if (selection === "home") return match.home_team;
  if (selection === "away") return match.away_team;
  if (selection === "draw") return "Draw";
  return selection.replaceAll("_", " ");
}

function londonDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function buildDailyGames(
  matches: MatchRow[],
  selections: BettingSelection[],
  nowDate: Date,
): DailyGamePrediction[] {
  const today = londonDateKey(nowDate);
  const byMatch = new Map<string, BettingSelection[]>();
  for (const selection of selections) {
    if (londonDateKey(selection.kickoffAt) !== today) continue;
    const rows = byMatch.get(selection.matchId) ?? [];
    rows.push(selection);
    byMatch.set(selection.matchId, rows);
  }

  return matches
    .filter((match) => londonDateKey(match.kickoff_at) === today)
    .map((match) => {
      const outcomes = [...(byMatch.get(match.match_id) ?? [])].sort(
        (a, b) => b.modelProbability - a.modelProbability,
      );
      const modelPick = outcomes[0] ?? null;
      return {
        matchId: match.match_id,
        kickoffAt: match.kickoff_at,
        league: match.league,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        homeXg: modelPick?.homeXg ?? null,
        awayXg: modelPick?.awayXg ?? null,
        outcomes,
        modelPick,
      };
    })
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

function verdictFor(
  model: ModelRow,
  validation: ValidationRow | null,
  williamHill: LivePriceRow | null,
  best: LivePriceRow | null,
): { verdict: BettingVerdict; reason: string; price: number | null; edge: number | null } {
  const wh = williamHill ? Number(williamHill.decimal_odds) : null;
  const bestPrice = best ? Number(best.decimal_odds) : null;
  const comparison = wh ?? bestPrice;
  const edge =
    comparison && comparison > 1
      ? Number(model.model_probability) * comparison - 1
      : null;

  if (!comparison) {
    return {
      verdict: "WATCH",
      reason: "Model price exists, but no fresh bookmaker price is verified.",
      price: null,
      edge: null,
    };
  }

  if (validation?.status !== "APPROVED") {
    return {
      verdict: comparison >= Number(model.minimum_take_price) ? "WATCH" : "PASS",
      reason: `Market validation is ${validation?.status ?? "UNVERIFIED"}; no production BET label.`,
      price: comparison,
      edge,
    };
  }

  if (!wh) {
    return {
      verdict: comparison >= Number(model.minimum_take_price) ? "WATCH" : "PASS",
      reason:
        comparison >= Number(model.minimum_take_price)
          ? "Wider market clears the take price, but William Hill is not verified."
          : "Current wider-market price is below the take threshold.",
      price: comparison,
      edge,
    };
  }

  if (wh >= Number(model.minimum_take_price)) {
    return {
      verdict: "BET",
      reason: "William Hill price clears the uncertainty-adjusted minimum take price.",
      price: wh,
      edge,
    };
  }

  if (wh < Number(model.fair_odds) * 0.92) {
    return {
      verdict: "FADE",
      reason: "William Hill price is materially shorter than the model fair price.",
      price: wh,
      edge,
    };
  }

  return {
    verdict: "PASS",
    reason: "Likely outcome is not enough; the available price does not clear the take threshold.",
    price: wh,
    edge,
  };
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, picked: T[]) => {
    if (picked.length === size) {
      result.push(picked);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      walk(index + 1, [...picked, items[index]]);
    }
  };
  walk(0, []);
  return result;
}

function buildAccas(selections: BettingSelection[]): AccaCandidate[] {
  const bestPerMatch = new Map<string, BettingSelection>();
  for (const selection of selections.filter((row) => row.verdict === "BET")) {
    const current = bestPerMatch.get(selection.matchId);
    if (!current || (selection.edge ?? -1) > (current.edge ?? -1)) {
      bestPerMatch.set(selection.matchId, selection);
    }
  }

  const pool = [...bestPerMatch.values()]
    .filter((row) => row.williamHillPrice)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0))
    .slice(0, 8);

  const accas: AccaCandidate[] = [];
  for (const size of [2, 3, 4, 5]) {
    for (const legs of combinations(pool, size)) {
      const rawProbability = legs.reduce(
        (product, leg) => product * leg.modelProbability,
        1,
      );
      const probability = rawProbability * Math.pow(0.985, size - 1);
      const fairOdds = 1 / probability;
      const baseTake = legs.reduce(
        (product, leg) => product * leg.minimumTakePrice,
        1,
      );
      const minimumTakePrice = baseTake * Math.pow(1.015, size - 1);
      const williamHillOdds = legs.reduce(
        (product, leg) => product * Number(leg.williamHillPrice?.decimal_odds ?? 1),
        1,
      );
      const edge = probability * williamHillOdds - 1;

      if (williamHillOdds < minimumTakePrice || edge <= 0) continue;

      accas.push({
        id: legs.map((leg) => `${leg.matchId}:${leg.selection}`).join("|"),
        label:
          size === 2
            ? "Double"
            : size === 3
              ? "Treble"
              : `${size}-fold`,
        legCount: size,
        legs,
        modelProbability: probability,
        fairOdds,
        minimumTakePrice,
        williamHillOdds,
        edge,
        verdict: "BET",
      });
    }
  }

  return accas
    .sort((a, b) => b.edge / Math.sqrt(b.legCount) - a.edge / Math.sqrt(a.legCount))
    .slice(0, 12);
}

export async function getBettingWorkspaceData() {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const horizon = new Date(nowDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const scopeStart = new Date(nowDate.getTime() - 30 * 60 * 60 * 1000).toISOString();
  const priceCutoff = new Date(nowDate.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const [dbScopeMatches, outputs, validations, liveOdds, feedRows, recentMatches, discoveredMatches, qualityRows] =
    await Promise.all([
      rest<MatchRow>(
        `footy_matches?select=match_id,kickoff_at,league,home_team,away_team&kickoff_at=gte.${encodeURIComponent(scopeStart)}&kickoff_at=lte.${encodeURIComponent(horizon)}&order=kickoff_at.asc&limit=1200`,
      ),
      rest<ModelRow>(
        `footy_model_outputs?select=match_id,model_version,home_xg,away_xg,market,selection,model_probability,fair_odds,uncertainty_haircut,minimum_take_price,created_at&model_version=eq.${MODEL_VERSION}&order=created_at.desc&limit=2000`,
      ),
      rest<ValidationRow>(
        `footy_model_market_validation?select=model_version,league,market,status,sample_size,model_log_loss,benchmark_log_loss,close_roi,clv_proxy,bookmaker_reference,notes,evaluated_at&model_version=eq.${MODEL_VERSION}`,
      ),
      rest<LivePriceRow>(
        `footy_live_odds_current?select=match_id,bookmaker_key,bookmaker_name,market,selection,line,decimal_odds,previous_decimal_odds,captured_at&captured_at=gte.${encodeURIComponent(priceCutoff)}&limit=5000`,
      ),
      rest<FeedRow>(
        "footy_odds_feed_status?select=provider,last_success_at,last_attempt_at,events_received,prices_received,last_error&order=last_attempt_at.desc&limit=1",
      ),
      rest<MatchRow>(
        `footy_matches?select=match_id,kickoff_at,league,home_team,away_team&kickoff_at=lt.${encodeURIComponent(now)}&order=kickoff_at.desc&limit=240`,
      ),
      fetchFotMobFixtures(nowDate),
      rest<QualityRow>(
        "footy_data_quality_runs?select=source,league,season,status,checked_at&order=checked_at.desc&limit=1000",
      ),
    ]);

  const scopeMatches = [...dbScopeMatches];
  for (const discovered of discoveredMatches) {
    if (scopeMatches.some((existing) => sameFixture(existing, discovered))) continue;
    scopeMatches.push(discovered);
  }
  scopeMatches.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));

  const recentIds = recentMatches.map((match) => match.match_id);
  const metricRows = recentIds.length
    ? await rest<MetricRow>(
        `footy_match_team_metrics?select=match_id,team,goals,goals_conceded,xg,npxg,xga,npxga,shots,shots_on_target,big_chances,big_chances_conceded,box_touches,xa,set_piece_xg,possession,ppda,field_tilt,xgot,goals_prevented,verified&match_id=in.(${recentIds.map(encodeURIComponent).join(",")})&limit=500`,
      )
    : [];

  const kickoffById = new Map(recentMatches.map((match) => [match.match_id, match.kickoff_at]));
  const metricsByTeam = new Map<string, MetricRow[]>();
  for (const row of metricRows) {
    const list = metricsByTeam.get(row.team) ?? [];
    list.push(row);
    metricsByTeam.set(row.team, list);
  }

  const profiles = new Map<string, ProcessProfile>();
  for (const [team, rows] of metricsByTeam) {
    const recent = [...rows]
      .sort(
        (a, b) =>
          String(kickoffById.get(b.match_id) ?? "").localeCompare(
            String(kickoffById.get(a.match_id) ?? ""),
          ),
      )
      .slice(0, 6);
    const profile = processProfile(recent);
    if (profile) profiles.set(team, profile);
  }

  const validationByMarket = new Map(
    validations.map((row) => [`${row.league}:${row.market}`, row]),
  );
  const modelHistoryByKey = new Map<string, ModelRow[]>();
  for (const row of outputs) {
    const key = `${row.match_id}:${row.market}:${row.selection}`;
    const history = modelHistoryByKey.get(key) ?? [];
    history.push(row);
    modelHistoryByKey.set(key, history);
  }
  for (const history of modelHistoryByKey.values()) {
    history.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const pricesByKey = new Map<string, LivePriceRow[]>();
  for (const row of liveOdds) {
    if (!row.match_id) continue;
    const key = `${row.match_id}:${row.market}:${row.selection}`;
    const list = pricesByKey.get(key) ?? [];
    list.push(row);
    pricesByKey.set(key, list);
  }

  const scopedIds = new Set(scopeMatches.map((match) => match.match_id));
  const modelsByMatch = new Map<string, ModelRow[]>();
  for (const row of latestRows(outputs)) {
    if (!scopedIds.has(row.match_id)) continue;
    const list = modelsByMatch.get(row.match_id) ?? [];
    list.push(row);
    modelsByMatch.set(row.match_id, list);
  }

  const selections: BettingSelection[] = [];
  for (const match of scopeMatches) {
    for (const model of modelsByMatch.get(match.match_id) ?? []) {
      const key = `${match.match_id}:${model.market}:${model.selection}`;
      const prices = pricesByKey.get(key) ?? [];
      const williamHill =
        prices.find(
          (row) =>
            row.bookmaker_key.toLowerCase() === "williamhill" ||
            row.bookmaker_name.toLowerCase().includes("william hill"),
        ) ?? null;
      const sortedPrices = [...prices].sort(
        (a, b) => Number(b.decimal_odds) - Number(a.decimal_odds),
      );
      const best = sortedPrices[0] ?? null;
      const historyKey = `${match.match_id}:${model.market}:${model.selection}`;
      const modelHistory = modelHistoryByKey.get(historyKey) ?? [];
      const previousModel =
        modelHistory.find((row) => row.created_at < model.created_at) ?? null;
      const validation =
        validationByMarket.get(`${match.league}:${model.market}`) ?? null;
      const state = verdictFor(model, validation, williamHill, best);

      selections.push({
        matchId: match.match_id,
        kickoffAt: match.kickoff_at,
        league: match.league,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        market: model.market,
        selection: model.selection,
        displaySelection: displaySelection(match, model.selection),
        modelVersion: model.model_version,
        modelProbability: Number(model.model_probability),
        previousModelProbability:
          previousModel == null ? null : Number(previousModel.model_probability),
        modelProbabilityDelta:
          previousModel == null
            ? null
            : Number(model.model_probability) - Number(previousModel.model_probability),
        fairOdds: Number(model.fair_odds),
        minimumTakePrice: Number(model.minimum_take_price),
        uncertaintyHaircut:
          model.uncertainty_haircut == null
            ? null
            : Number(model.uncertainty_haircut),
        homeXg: model.home_xg == null ? null : Number(model.home_xg),
        awayXg: model.away_xg == null ? null : Number(model.away_xg),
        williamHillPrice: williamHill,
        bestPrice: best,
        bookmakerQuotes: sortedPrices.slice(0, 6).map((row) => ({
          bookmakerKey: row.bookmaker_key,
          bookmakerName: row.bookmaker_name,
          decimalOdds: Number(row.decimal_odds),
          previousDecimalOdds:
            row.previous_decimal_odds == null
              ? null
              : Number(row.previous_decimal_odds),
          capturedAt: row.captured_at,
        })),
        marketPrice: state.price,
        edge: state.edge,
        validationStatus: validation?.status ?? "RESEARCH",
        verdict: state.verdict,
        verdictReason: state.reason,
        modelCreatedAt: model.created_at,
        homeProcess: profiles.get(match.home_team) ?? null,
        awayProcess: profiles.get(match.away_team) ?? null,
      });
    }
  }

  const futureMatches = scopeMatches.filter(
    (match) => new Date(match.kickoff_at).getTime() > nowDate.getTime(),
  );
  const futureSelections = selections.filter(
    (selection) => new Date(selection.kickoffAt).getTime() > nowDate.getTime(),
  );
  const todayGames = buildDailyGames(scopeMatches, selections, nowDate);

  const latestQualityByLeague = new Map<string, QualityRow>();
  for (const row of qualityRows) {
    if (!latestQualityByLeague.has(row.league)) {
      latestQualityByLeague.set(row.league, row);
    }
  }

  const leagueReadiness: LeagueReadiness[] = [...new Set(
    todayGames.map((game) => game.league),
  )].map<LeagueReadiness>((league) => {
    const leagueGames = todayGames.filter((game) => game.league === league);
    const leagueSelections = selections.filter(
      (selection) =>
        selection.league === league &&
        londonDateKey(selection.kickoffAt) === londonDateKey(nowDate),
    );
    const modelledFixtures = new Set(
      leagueSelections.map((selection) => selection.matchId),
    ).size;
    const freshPricedSelections = leagueSelections.filter(
      (selection) => selection.bestPrice != null,
    ).length;
    const quality = latestQualityByLeague.get(league) ?? null;
    const validation =
      validations.find(
        (row) => row.league === league && row.market === "1X2",
      ) ?? null;

    let stage: LeagueReadiness["stage"] = "FIXTURES_ONLY";
    if (quality) stage = "PROCESS_READY";
    if (modelledFixtures > 0) stage = "MODEL_RESEARCH";
    if (modelledFixtures > 0 && freshPricedSelections > 0) {
      stage = "PRICE_WATCH";
    }
    if (
      modelledFixtures > 0 &&
      freshPricedSelections > 0 &&
      validation?.status === "APPROVED"
    ) {
      stage = "BETTING_READY";
    }

    return {
      league,
      fixtures: leagueGames.length,
      modelledFixtures,
      processStatus:
        quality?.status === "PASS"
          ? "PASS"
          : quality?.status === "WARN"
            ? "WARN"
            : "MISSING",
      latestProcessAt: quality?.checked_at ?? null,
      validationStatus: validation?.status ?? "MISSING",
      freshPricedSelections,
      stage,
    };
  }).sort((a, b) => {
    const rank = {
      BETTING_READY: 0,
      PRICE_WATCH: 1,
      MODEL_RESEARCH: 2,
      PROCESS_READY: 3,
      FIXTURES_ONLY: 4,
    };
    return (
      rank[a.stage] - rank[b.stage] ||
      b.fixtures - a.fixtures ||
      a.league.localeCompare(b.league)
    );
  });
  const latestModelAt =
    outputs.map((row) => row.created_at).sort().at(-1) ?? null;
  const latestFixtureAt =
    futureMatches.map((row) => row.kickoff_at).sort().at(-1) ??
    recentMatches.map((row) => row.kickoff_at).sort().at(-1) ??
    null;
  const feed = feedRows[0] ?? null;
  const accas = buildAccas(futureSelections);

  return {
    configured: Boolean(config()),
    modelVersion: MODEL_VERSION,
    matches: futureMatches,
    todayGames,
    leagueReadiness,
    selections: futureSelections.sort((a, b) => {
      const verdictOrder = { BET: 0, WATCH: 1, PASS: 2, FADE: 3 };
      return (
        verdictOrder[a.verdict] - verdictOrder[b.verdict] ||
        (b.edge ?? -99) - (a.edge ?? -99) ||
        a.kickoffAt.localeCompare(b.kickoffAt)
      );
    }),
    accas,
    validations,
    feed,
    latestModelAt,
    latestFixtureAt,
    livePrices: liveOdds.length,
    discoveredFixtures: discoveredMatches.length,
    dataState:
      futureMatches.length === 0
        ? "NO_UPCOMING_FIXTURES"
        : futureSelections.length === 0
          ? "NO_CURRENT_MODEL"
          : liveOdds.length === 0
            ? "NO_FRESH_PRICES"
            : "LIVE",
  } as const;
}


export async function getPredictionResultsData(
  limit = 60,
): Promise<PredictionResultsData> {
  const rows = await rest<PublicCallRow>(
    `footy_public_calls?select=call_key,source_kind,match_id,model_version,market,selection,model_probability,fair_odds,minimum_take_price,validation_status,home_team,away_team,kickoff_at,published_at,quoted_bookmaker,quoted_odds,price_captured_at,closing_odds,home_goals,away_goals,result_status,unit_profit,clv,settled_at&result_status=neq.OPEN&order=kickoff_at.desc&limit=${Math.max(1, Math.min(limit, 200))}`,
  );

  const receipts = rows.map((row): PredictionReceipt => ({
    callKey: row.call_key,
    matchId: row.match_id,
    modelVersion: row.model_version,
    market: row.market,
    selection: row.selection,
    displaySelection:
      row.selection === "home"
        ? row.home_team
        : row.selection === "away"
          ? row.away_team
          : row.selection === "draw"
            ? "Draw"
            : row.selection.replaceAll("_", " "),
    modelProbability: Number(row.model_probability),
    fairOdds: Number(row.fair_odds),
    minimumTakePrice:
      row.minimum_take_price == null ? null : Number(row.minimum_take_price),
    validationStatus: row.validation_status,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    kickoffAt: row.kickoff_at,
    publishedAt: row.published_at,
    quotedBookmaker: row.quoted_bookmaker,
    quotedOdds: row.quoted_odds == null ? null : Number(row.quoted_odds),
    closingOdds: row.closing_odds == null ? null : Number(row.closing_odds),
    homeGoals: row.home_goals == null ? null : Number(row.home_goals),
    awayGoals: row.away_goals == null ? null : Number(row.away_goals),
    resultStatus: row.result_status,
    unitProfit: row.unit_profit == null ? null : Number(row.unit_profit),
    clv: row.clv == null ? null : Number(row.clv),
    settledAt: row.settled_at,
  }));

  const graded = receipts.filter(
    (row) => row.resultStatus === "WON" || row.resultStatus === "LOST",
  );
  const correct = graded.filter((row) => row.resultStatus === "WON").length;
  const priced = receipts.filter(
    (row) => row.quotedOdds != null && row.unitProfit != null,
  );
  const units = priced.length
    ? priced.reduce((sum, row) => sum + Number(row.unitProfit), 0)
    : null;
  const clvRows = priced.filter((row) => row.clv != null);
  const averageClv = clvRows.length
    ? clvRows.reduce((sum, row) => sum + Number(row.clv), 0) / clvRows.length
    : null;

  return {
    receipts,
    summary: {
      predictions: graded.length,
      correct,
      incorrect: graded.length - correct,
      accuracy: graded.length ? correct / graded.length : null,
      pricedBets: priced.length,
      units,
      roi: priced.length && units != null ? units / priced.length : null,
      averageClv,
    },
  };
}
