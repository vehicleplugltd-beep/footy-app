const MODEL_VERSION = "v7-r16-p50-v20";
const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

export type BettingVerdict = "BET" | "WATCH" | "PASS" | "FADE";

type MatchRow = {
  match_id: string;
  kickoff_at: string;
  league: string;
  home_team: string;
  away_team: string;
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
  fairOdds: number;
  minimumTakePrice: number;
  uncertaintyHaircut: number | null;
  homeXg: number | null;
  awayXg: number | null;
  williamHillPrice: LivePriceRow | null;
  bestPrice: LivePriceRow | null;
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
    .map((row) => Number(row[key]))
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
  const priceCutoff = new Date(nowDate.getTime() - 2 * 60 * 60 * 1000).toISOString();

  const [matches, outputs, validations, liveOdds, feedRows, recentMatches] =
    await Promise.all([
      rest<MatchRow>(
        `footy_matches?select=match_id,kickoff_at,league,home_team,away_team&kickoff_at=gte.${encodeURIComponent(now)}&kickoff_at=lte.${encodeURIComponent(horizon)}&order=kickoff_at.asc&limit=100`,
      ),
      rest<ModelRow>(
        `footy_model_outputs?select=match_id,model_version,home_xg,away_xg,market,selection,model_probability,fair_odds,uncertainty_haircut,minimum_take_price,created_at&model_version=eq.${MODEL_VERSION}&order=created_at.desc&limit=2000`,
      ),
      rest<ValidationRow>(
        `footy_model_market_validation?select=model_version,market,status,sample_size,model_log_loss,benchmark_log_loss,close_roi,clv_proxy,bookmaker_reference,notes,evaluated_at&model_version=eq.${MODEL_VERSION}`,
      ),
      rest<LivePriceRow>(
        `footy_live_odds_current?select=match_id,bookmaker_key,bookmaker_name,market,selection,line,decimal_odds,previous_decimal_odds,captured_at&captured_at=gte.${encodeURIComponent(priceCutoff)}&limit=5000`,
      ),
      rest<FeedRow>(
        "footy_odds_feed_status?select=provider,last_success_at,last_attempt_at,events_received,prices_received,last_error&order=last_attempt_at.desc&limit=1",
      ),
      rest<MatchRow>(
        `footy_matches?select=match_id,kickoff_at,league,home_team,away_team&kickoff_at=lt.${encodeURIComponent(now)}&order=kickoff_at.desc&limit=120`,
      ),
    ]);

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

  const validationByMarket = new Map(validations.map((row) => [row.market, row]));
  const pricesByKey = new Map<string, LivePriceRow[]>();
  for (const row of liveOdds) {
    if (!row.match_id) continue;
    const key = `${row.match_id}:${row.market}:${row.selection}`;
    const list = pricesByKey.get(key) ?? [];
    list.push(row);
    pricesByKey.set(key, list);
  }

  const futureIds = new Set(matches.map((match) => match.match_id));
  const modelsByMatch = new Map<string, ModelRow[]>();
  for (const row of latestRows(outputs)) {
    if (!futureIds.has(row.match_id)) continue;
    const list = modelsByMatch.get(row.match_id) ?? [];
    list.push(row);
    modelsByMatch.set(row.match_id, list);
  }

  const selections: BettingSelection[] = [];
  for (const match of matches) {
    for (const model of modelsByMatch.get(match.match_id) ?? []) {
      const key = `${match.match_id}:${model.market}:${model.selection}`;
      const prices = pricesByKey.get(key) ?? [];
      const williamHill =
        prices.find(
          (row) =>
            row.bookmaker_key.toLowerCase() === "williamhill" ||
            row.bookmaker_name.toLowerCase().includes("william hill"),
        ) ?? null;
      const best =
        [...prices].sort(
          (a, b) => Number(b.decimal_odds) - Number(a.decimal_odds),
        )[0] ?? null;
      const validation = validationByMarket.get(model.market) ?? null;
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

  const latestModelAt =
    outputs.map((row) => row.created_at).sort().at(-1) ?? null;
  const latestFixtureAt =
    matches.map((row) => row.kickoff_at).sort().at(-1) ??
    recentMatches.map((row) => row.kickoff_at).sort().at(-1) ??
    null;
  const feed = feedRows[0] ?? null;
  const accas = buildAccas(selections);

  return {
    configured: Boolean(config()),
    modelVersion: MODEL_VERSION,
    matches,
    selections: selections.sort((a, b) => {
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
    dataState:
      matches.length === 0
        ? "NO_UPCOMING_FIXTURES"
        : selections.length === 0
          ? "NO_CURRENT_MODEL"
          : liveOdds.length === 0
            ? "NO_FRESH_PRICES"
            : "LIVE",
  } as const;
}
