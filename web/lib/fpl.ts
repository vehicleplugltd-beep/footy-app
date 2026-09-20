const FPL_BASE = "https://fantasy.premierleague.com/api";
const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";
const CURRENT_FOOTY_SEASON = "2627";

export type FplEvent = {
  id: number;
  name: string;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
};

type FplTeam = { id: number; name: string; short_name: string };
type ElementType = { id: number; singular_name_short: string };

type FplPlayer = {
  id: number;
  code: number;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  saves: number;
  bonus: number;
  bps: number;
  form: string;
  selected_by_percent: string;
  points_per_game: string;
  ep_next: string | null;
  chance_of_playing_next_round: number | null;
  status: string;
  minutes: number;
  expected_goal_involvements: string;
  expected_goals: string;
  expected_assists: string;
  expected_goals_conceded: string;
  starts: number;
  news: string;
  news_added: string | null;
  ict_index: string;
  influence: string;
  creativity: string;
  threat: string;
  defensive_contribution: string | number | null;
  penalties_order: number | null;
  direct_freekicks_order: number | null;
  corners_and_indirect_freekicks_order: number | null;
  transfers_in_event: number;
  transfers_out_event: number;
};

type Bootstrap = {
  events: FplEvent[];
  elements: FplPlayer[];
  teams: FplTeam[];
  element_types: ElementType[];
};

type Fixture = {
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
};

type Entry = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number | null;
  last_deadline_bank: number;
  last_deadline_value: number;
};

type Pick = {
  element: number;
  is_captain: boolean;
};

type PicksResponse = { picks: Pick[] };

type MatchRow = {
  match_id: string;
  kickoff_at: string;
  home_team: string;
  away_team: string;
};

type MetricRow = {
  match_id: string;
  team: string;
  opponent: string;
  xg: number | string | null;
  npxg: number | string | null;
  xga: number | string | null;
  npxga: number | string | null;
  shots: number | string | null;
  shots_on_target: number | string | null;
  shots_conceded: number | string | null;
  sot_conceded: number | string | null;
  big_chances: number | string | null;
  big_chances_conceded: number | string | null;
  box_touches: number | string | null;
  key_passes: number | string | null;
  xa: number | string | null;
  set_piece_xg: number | string | null;
  set_piece_xga: number | string | null;
  possession: number | string | null;
  ppda: number | string | null;
  field_tilt: number | string | null;
  deep_completions: number | string | null;
  crosses: number | string | null;
  shots_inside_box: number | string | null;
  xgot: number | string | null;
  final_third_passes: number | string | null;
  opposition_half_passes: number | string | null;
  territory_proxy: number | string | null;
  xgot_faced: number | string | null;
  goals_prevented: number | string | null;
  source: string | null;
  retrieved_at: string | null;
  source_confidence?: number;
};

export type TeamProcess = {
  team: string;
  matches: number;
  attackIndex: number;
  defenceIndex: number;
  attackTrend: number;
  defenceTrend: number;
  sourceConfidence: number;
  metrics: {
    xg: number;
    npxg: number;
    xga: number;
    npxga: number;
    shots: number;
    shotsOnTarget: number;
    shotsConceded: number;
    sotConceded: number;
    bigChances: number;
    bigChancesConceded: number;
    boxTouches: number;
    keyPasses: number;
    xa: number;
    setPieceXg: number;
    setPieceXga: number;
    possession: number;
    ppda: number;
    fieldTilt: number;
    deepCompletions: number;
    crosses: number;
    shotsInsideBox: number;
    xgot: number;
    finalThirdPasses: number;
    oppositionHalfPasses: number;
    territoryProxy: number;
    xgotFaced: number;
    goalsPrevented: number;
  };
};

export type RankedPlayer = {
  id: number;
  name: string;
  team: string;
  teamName: string;
  position: string;
  price: number;
  totalPoints: number;
  pointsPerGame: number;
  goalsScored: number;
  assists: number;
  cleanSheets: number;
  goalsConceded: number;
  saves: number;
  bonus: number;
  bps: number;
  defensiveContribution: number;
  form: number;
  expectedNext: number;
  assistantScore: number;
  fixtureDifficulty: number;
  availability: number;
  xgiPer90: number;
  xgPer90: number;
  xaPer90: number;
  xgcPer90: number;
  minutes: number;
  starts: number;
  news: string;
  newsAdded: string | null;
  setPieceRole: string | null;
  selectedBy: number;
  transfersNet: number;
  valueScore: number;
  processBoost: number;
  processFactor: number;
  fixtureFactor: number;
  trendFactor: number;
  startReliability: number;
  teamAttackIndex: number;
  teamDefenceIndex: number;
  opponent: string | null;
  opponentName: string | null;
  fixtureCount: number;
  scoreBreakdown: {
    base: number;
    processMultiplier: number;
    fixtureMultiplier: number;
    teamTrendMultiplier: number;
    availabilityMultiplier: number;
    startMultiplier: number;
  };
};

export type FutureGameweekPlan = {
  eventId: number;
  name: string;
  deadline: string;
  captain: RankedPlayer | null;
  viceCaptain: RankedPlayer | null;
  topTransfers: RankedPlayer[];
  doubleTeams: string[];
  blankTeams: string[];
};

export type ChipSignal = {
  chip: "TRIPLE CAPTAIN" | "BENCH BOOST" | "FREE HIT" | "WILDCARD";
  status: "STRONG" | "WATCH" | "HOLD";
  eventName: string | null;
  reason: string;
};

export type SquadSuggestion = {
  player: RankedPlayer;
  replacement: RankedPlayer | null;
  reason: string;
  gain: number;
  minimumGain: number;
  horizonGain: number;
  timing: "NOW" | "WAIT" | "HOLD";
};

export type TeamAnalysis = {
  entryId: number;
  teamName: string;
  managerName: string;
  overallPoints: number;
  overallRank: number | null;
  bank: number;
  squadValue: number;
  currentCaptain: RankedPlayer | null;
  recommendedCaptain: RankedPlayer | null;
  weakLinks: SquadSuggestion[];
  squad: RankedPlayer[];
};

export type ManagerFutureGameweek = {
  eventId: number;
  name: string;
  deadline: string;
  captain: RankedPlayer | null;
  transfer: {
    out: RankedPlayer;
    in: RankedPlayer;
    gain: number;
  } | null;
};

export type FplHub = {
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
  captains: RankedPlayer[];
  transfers: RankedPlayer[];
  values: RankedPlayer[];
  processTeams: number;
  teamAnalysis: TeamAnalysis | null;
  teamError: string | null;
  baseError: string | null;
  dataRetrievedAt: string | null;
  futurePlan: FutureGameweekPlan[];
  chipRadar: ChipSignal[];
};

function num(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function canonicalTeam(value: string) {
  const raw = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    mancity: "manchestercity",
    manchestercity: "manchestercity",
    manutd: "manchesterunited",
    manchesterunited: "manchesterunited",
    spurs: "tottenham",
    tottenhamhotspur: "tottenham",
    tottenham: "tottenham",
    newcastle: "newcastleunited",
    newcastleunited: "newcastleunited",
    nottmforest: "nottinghamforest",
    nottinghamforest: "nottinghamforest",
    crystalpalace: "crystalpalace",
    astonvilla: "astonvilla",
    brightonandhovealbion: "brighton",
    brighton: "brighton",
    westham: "westhamunited",
    westhamunited: "westhamunited",
    wolves: "wolverhamptonwanderers",
    wolverhamptonwanderers: "wolverhamptonwanderers",
  };
  return aliases[raw] ?? raw;
}

async function fplFetch<T>(path: string, revalidate = 900): Promise<T> {
  const response = await fetch(`${FPL_BASE}/${path}`, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Referer: "https://fantasy.premierleague.com/",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    next: { revalidate },
  });
  if (!response.ok) throw new Error(`FPL request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? { url, key } : null;
}

async function supabaseRest<T>(path: string): Promise<T[]> {
  const cfg = supabaseConfig();
  if (!cfg) return [];
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return response.json() as Promise<T[]>;
}


type FplSnapshotRow<T> = {
  snapshot_key: string;
  payload: T;
  retrieved_at: string;
};

async function cachedFpl<T>(snapshotKey: string) {
  const rows = await supabaseRest<FplSnapshotRow<T>>(
    `footy_fpl_snapshots?select=snapshot_key,payload,retrieved_at&snapshot_key=eq.${encodeURIComponent(snapshotKey)}&limit=1`,
  );
  return rows[0] ?? null;
}

function currentAndNext(events: FplEvent[]) {
  const next =
    events.find((event) => event.is_next) ??
    events.find((event) => new Date(event.deadline_time).getTime() > Date.now()) ??
    null;
  const current =
    events.find((event) => event.is_current) ??
    (next
      ? [...events]
          .filter((event) => event.id < next.id)
          .sort((a, b) => b.id - a.id)[0] ?? null
      : [...events].sort((a, b) => b.id - a.id)[0] ?? null);
  return { current, next };
}

function weightedAverage(values: number[]) {
  if (!values.length) return 0;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    const age = values.length - 1 - index;
    const weight = Math.pow(0.82, age);
    numerator += value * weight;
    denominator += weight;
  });
  return denominator ? numerator / denominator : 0;
}

const SOURCE_RELIABILITY: Record<string, number> = {
  opta: 1,
  statsbomb: 0.98,
  "statsbomb-open": 0.96,
  understat: 0.96,
  "fpl-core-insights": 0.88,
  fbref: 0.9,
  sofascore: 0.86,
  "football-data.co.uk": 0.82,
  openfootball: 0.78,
};

function metricSourceKey(value: string | null | undefined) {
  const raw = String(value ?? "unknown").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "soccerdata-understat": "understat",
    "soccerdata-sofascore": "sofascore",
    "soccerdata-fbref": "fbref",
    "statsbomb open": "statsbomb-open",
    statsbomb_open: "statsbomb-open",
  };
  return aliases[raw] ?? raw;
}

function metricSourceWeight(value: string | null | undefined) {
  return SOURCE_RELIABILITY[metricSourceKey(value)] ?? 0.7;
}

function weightedMedian(values: Array<{ value: number; weight: number }>) {
  const usable = values
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => a.value - b.value);
  if (!usable.length) return 0;
  const total = usable.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return usable[Math.floor(usable.length / 2)].value;
  let running = 0;
  for (const item of usable) {
    running += Math.max(0, item.weight);
    if (running >= total / 2) return item.value;
  }
  return usable[usable.length - 1].value;
}

function canonicaliseMetricRows(rows: MetricRow[]) {
  const groups = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const key = `${row.match_id}::${canonicalTeam(row.team)}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const modelled = new Set([
    "xg",
    "npxg",
    "xga",
    "npxga",
    "xa",
    "set_piece_xg",
    "set_piece_xga",
    "field_tilt",
  ]);
  const fields: Array<keyof MetricRow> = [
    "xg",
    "npxg",
    "xga",
    "npxga",
    "shots",
    "shots_on_target",
    "shots_conceded",
    "sot_conceded",
    "big_chances",
    "big_chances_conceded",
    "box_touches",
    "key_passes",
    "xa",
    "set_piece_xg",
    "set_piece_xga",
    "possession",
    "ppda",
    "field_tilt",
    "deep_completions",
    "crosses",
    "shots_inside_box",
    "xgot",
    "final_third_passes",
    "opposition_half_passes",
    "territory_proxy",
    "xgot_faced",
    "goals_prevented",
  ];

  return [...groups.values()].map((group) => {
    const preferred = [...group].sort(
      (a, b) => metricSourceWeight(b.source) - metricSourceWeight(a.source),
    )[0];
    const out = { ...preferred } as MetricRow;
    const confidences: number[] = [];

    for (const field of fields) {
      const observations = group
        .map((row) => ({
          value: num(row[field] as number | string | null),
          raw: row[field],
          weight: metricSourceWeight(row.source),
          source: row.source,
        }))
        .filter((item) => item.raw !== null && item.raw !== undefined);

      if (!observations.length) continue;
      let canonical = 0;
      if (modelled.has(String(field))) {
        const chosen = [...observations].sort((a, b) => b.weight - a.weight)[0];
        canonical = chosen.value;
      } else {
        canonical = weightedMedian(observations);
      }

      const scale = Math.max(
        Math.abs(canonical),
        observations.reduce((sum, item) => sum + Math.abs(item.value), 0) /
          observations.length,
        0.5,
      );
      const deviations = observations
        .map((item) => Math.abs(item.value - canonical))
        .sort((a, b) => a - b);
      const medianDeviation =
        deviations[Math.floor(deviations.length / 2)] ?? 0;
      const agreement = clamp(0.98 - (medianDeviation / scale) * 0.9, 0.35, 0.98);
      const bestReliability = Math.max(...observations.map((item) => item.weight));
      const confidence = clamp(
        agreement * 0.62 +
          bestReliability * 0.3 +
          Math.min(0.08, Math.max(0, observations.length - 1) * 0.04),
        0,
        1,
      );
      confidences.push(confidence);
      (out as unknown as Record<string, unknown>)[String(field)] = canonical;
    }

    out.source_confidence = confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0.7;
    return out;
  });
}

function buildTeamProcess(matches: MatchRow[], metrics: MetricRow[]) {
  const canonicalMetrics = canonicaliseMetricRows(metrics);
  const dateByMatch = new Map(
    matches.map((match) => [match.match_id, new Date(match.kickoff_at).getTime()]),
  );
  const usable = canonicalMetrics
    .filter((row) => dateByMatch.has(row.match_id))
    .sort((a, b) => (dateByMatch.get(a.match_id) ?? 0) - (dateByMatch.get(b.match_id) ?? 0));

  const fields = [
    "xg",
    "npxg",
    "xga",
    "npxga",
    "shots",
    "shots_on_target",
    "shots_conceded",
    "sot_conceded",
    "big_chances",
    "big_chances_conceded",
    "box_touches",
    "key_passes",
    "xa",
    "set_piece_xg",
    "set_piece_xga",
    "possession",
    "ppda",
    "field_tilt",
    "deep_completions",
    "crosses",
    "shots_inside_box",
    "xgot",
    "final_third_passes",
    "opposition_half_passes",
    "territory_proxy",
    "xgot_faced",
    "goals_prevented",
  ] as const;

  const league: Record<string, number> = {};
  const populated = new Set<string>();
  for (const field of fields) {
    const values = usable
      .map((row) => row[field])
      .filter((value) => value !== null && value !== undefined)
      .map((value) => num(value))
      .filter((value) => Number.isFinite(value));
    if (values.length) {
      league[field] =
        values.reduce((sum, value) => sum + value, 0) / values.length;
      populated.add(field);
    } else {
      league[field] = 0;
    }
  }

  const byTeam = new Map<string, MetricRow[]>();
  for (const row of usable) {
    const key = canonicalTeam(row.team);
    const list = byTeam.get(key) ?? [];
    list.push(row);
    byTeam.set(key, list);
  }

  const output = new Map<string, TeamProcess>();
  for (const [key, rows] of byTeam) {
    const last = rows.slice(-8);
    const n = last.length;
    const regression = n / (n + 6);

    const avg = (field: (typeof fields)[number]) => {
      if (!populated.has(field)) return 0;
      const values = last
        .map((row) => row[field])
        .filter((value) => value !== null && value !== undefined)
        .map((value) => num(value));
      const observed = values.length ? weightedAverage(values) : league[field];
      return observed * regression + league[field] * (1 - regression);
    };
    const ratio = (field: (typeof fields)[number]) =>
      populated.has(field) && league[field] > 0
        ? avg(field) / league[field]
        : 1;
    const inverseRatio = (field: (typeof fields)[number]) =>
      populated.has(field) && avg(field) > 0
        ? league[field] / avg(field)
        : 1;
    const weightedComposite = (
      components: Array<{ value: number; weight: number; field: string }>,
    ) => {
      const available = components.filter((item) => populated.has(item.field));
      const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
      if (!available.length || totalWeight <= 0) return 1;
      return (
        available.reduce(
          (sum, item) => sum + item.value * item.weight,
          0,
        ) / totalWeight
      );
    };

    const attack = weightedComposite([
      { field: "npxg", value: ratio("npxg"), weight: 0.20 },
      { field: "xg", value: ratio("xg"), weight: 0.15 },
      { field: "shots_on_target", value: ratio("shots_on_target"), weight: 0.10 },
      { field: "big_chances", value: ratio("big_chances"), weight: 0.09 },
      { field: "box_touches", value: ratio("box_touches"), weight: 0.07 },
      { field: "xa", value: ratio("xa"), weight: 0.07 },
      { field: "key_passes", value: ratio("key_passes"), weight: 0.05 },
      { field: "shots_inside_box", value: ratio("shots_inside_box"), weight: 0.05 },
      { field: "shots", value: ratio("shots"), weight: 0.04 },
      { field: "set_piece_xg", value: ratio("set_piece_xg"), weight: 0.04 },
      { field: "deep_completions", value: ratio("deep_completions"), weight: 0.04 },
      { field: "final_third_passes", value: ratio("final_third_passes"), weight: 0.03 },
      { field: "territory_proxy", value: ratio("territory_proxy"), weight: 0.025 },
      { field: "xgot", value: ratio("xgot"), weight: 0.025 },
      { field: "ppda", value: inverseRatio("ppda"), weight: 0.02 },
      { field: "field_tilt", value: ratio("field_tilt"), weight: 0.01 },
    ]);

    const defence = weightedComposite([
      { field: "npxga", value: inverseRatio("npxga"), weight: 0.27 },
      { field: "xga", value: inverseRatio("xga"), weight: 0.20 },
      { field: "big_chances_conceded", value: inverseRatio("big_chances_conceded"), weight: 0.13 },
      { field: "sot_conceded", value: inverseRatio("sot_conceded"), weight: 0.10 },
      { field: "shots_conceded", value: inverseRatio("shots_conceded"), weight: 0.08 },
      { field: "xgot_faced", value: inverseRatio("xgot_faced"), weight: 0.07 },
      { field: "set_piece_xga", value: inverseRatio("set_piece_xga"), weight: 0.06 },
      { field: "territory_proxy", value: ratio("territory_proxy"), weight: 0.04 },
      { field: "possession", value: ratio("possession"), weight: 0.025 },
      { field: "field_tilt", value: ratio("field_tilt"), weight: 0.025 },
    ]);

    // Recent form is useful, but three-match swings are noisy. Regress the
    // latest three toward the already-regressed eight-match process baseline.
    const recent = last.slice(-3);
    const recentRegression = recent.length / (recent.length + 5);
    const recentAvg = (field: (typeof fields)[number]) => {
      if (!populated.has(field)) return 0;
      const values = recent
        .map((row) => row[field])
        .filter((value) => value !== null && value !== undefined)
        .map((value) => num(value));
      const observed = values.length ? weightedAverage(values) : avg(field);
      return observed * recentRegression + avg(field) * (1 - recentRegression);
    };
    const safeRatio = (a: number, b: number) => (b > 0 ? a / b : 1);
    const attackTrendRaw =
      safeRatio(recentAvg("xg"), avg("xg")) * 0.55 +
      safeRatio(recentAvg("shots_on_target"), avg("shots_on_target")) * 0.25 +
      safeRatio(recentAvg("deep_completions"), avg("deep_completions")) * 0.20;
    const defenceTrendRaw =
      safeRatio(avg("xga"), recentAvg("xga")) * 0.60 +
      safeRatio(avg("sot_conceded"), recentAvg("sot_conceded")) * 0.40;

    output.set(key, {
      team: rows[rows.length - 1]?.team ?? key,
      matches: n,
      attackIndex: clamp(attack, 0.78, 1.28),
      defenceIndex: clamp(defence, 0.78, 1.28),
      attackTrend: clamp(attackTrendRaw - 1, -0.25, 0.25),
      defenceTrend: clamp(defenceTrendRaw - 1, -0.25, 0.25),
      sourceConfidence: clamp(
        weightedAverage(last.map((row) => row.source_confidence ?? 0.74)),
        0.35,
        1,
      ),
      metrics: {
        xg: avg("xg"),
        npxg: avg("npxg"),
        xga: avg("xga"),
        npxga: avg("npxga"),
        shots: avg("shots"),
        shotsOnTarget: avg("shots_on_target"),
        shotsConceded: avg("shots_conceded"),
        sotConceded: avg("sot_conceded"),
        bigChances: avg("big_chances"),
        bigChancesConceded: avg("big_chances_conceded"),
        boxTouches: avg("box_touches"),
        keyPasses: avg("key_passes"),
        xa: avg("xa"),
        setPieceXg: avg("set_piece_xg"),
        setPieceXga: avg("set_piece_xga"),
        possession: avg("possession"),
        ppda: avg("ppda"),
        fieldTilt: avg("field_tilt"),
        deepCompletions: avg("deep_completions"),
        crosses: avg("crosses"),
        shotsInsideBox: avg("shots_inside_box"),
        xgot: avg("xgot"),
        finalThirdPasses: avg("final_third_passes"),
        oppositionHalfPasses: avg("opposition_half_passes"),
        territoryProxy: avg("territory_proxy"),
        xgotFaced: avg("xgot_faced"),
        goalsPrevented: avg("goals_prevented"),
      },
    });
  }
  return output;
}

async function footyProcesses() {
  const matches = await supabaseRest<MatchRow>(
    `footy_matches?select=match_id,kickoff_at,home_team,away_team&league=eq.ENG-Premier%20League&season=eq.${CURRENT_FOOTY_SEASON}&order=kickoff_at.asc`,
  );
  if (!matches.length) return new Map<string, TeamProcess>();
  const ids = matches.map((match) => `"${match.match_id}"`).join(",");
  const metrics = await supabaseRest<MetricRow>(
    `footy_match_team_metrics?select=match_id,team,opponent,xg,npxg,xga,npxga,shots,shots_on_target,shots_conceded,sot_conceded,big_chances,big_chances_conceded,box_touches,key_passes,xa,set_piece_xg,set_piece_xga,possession,ppda,field_tilt,deep_completions,crosses,shots_inside_box,xgot,final_third_passes,opposition_half_passes,territory_proxy,xgot_faced,goals_prevented,source,retrieved_at&verified=eq.true&match_id=in.(${encodeURIComponent(ids)})`,
  );
  return buildTeamProcess(matches, metrics);
}


export type PlayerProcessEvidence = {
  premierLeagueMinutes: number;
  premierLeagueMatches: number;
  recentXgPer90: number;
  recentXaPer90: number;
  recentXgotPer90: number;
  chancesCreatedPer90: number;
  boxTouchesPer90: number;
  finalThirdPassesPer90: number;
  defensiveContributionsPer90: number;
  xgotFacedPer90: number;
  goalsPreventedPer90: number;
  attackTrend: number;
  minutes7: number;
  minutes14: number;
  nonLeagueMinutes14: number;
  matches14: number;
  daysRest: number | null;
  loadRisk: number;
  sourceConfidence: number;
  priorAvailable: boolean;
  priorMinutes: number;
  priorTeam: string | null;
  priorXgPer90: number;
  priorXaPer90: number;
  priorXgiPer90: number;
  regressedXgPer90: number;
  regressedXaPer90: number;
  regressedXgiPer90: number;
  currentEvidenceWeight: number;
  clubChangedSincePrior: boolean;
};

type PlayerMetricRow = {
  player_id: number;
  player_code: number | string | null;
  team: string | null;
  competition: string;
  kickoff_at: string | null;
  minutes: number | string | null;
  xg: number | string | null;
  xa: number | string | null;
  xgot: number | string | null;
  chances_created: number | string | null;
  box_touches: number | string | null;
  final_third_passes: number | string | null;
  defensive_contributions: number | string | null;
  xgot_faced: number | string | null;
  goals_prevented: number | string | null;
  verification_status: string | null;
};

type PlayerSeasonPriorRow = {
  player_code: number | string;
  player_name: string;
  position: string | null;
  team: string | null;
  minutes: number | string | null;
  xg_per90: number | string | null;
  xa_per90: number | string | null;
  xgi_per90: number | string | null;
  defensive_contribution_per90: number | string | null;
  saves_per90: number | string | null;
  verification_status: string | null;
};

function playerRate90(
  rows: PlayerMetricRow[],
  field: keyof PlayerMetricRow,
) {
  let numerator = 0;
  let minutes = 0;
  for (const row of rows) {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = num(raw as number | string | null);
    const played = num(row.minutes);
    if (played <= 0) continue;
    numerator += value;
    minutes += played;
  }
  return minutes > 0 ? (numerator * 90) / minutes : 0;
}

function playerMinutesInWindow(
  rows: PlayerMetricRow[],
  days: number,
  nonLeagueOnly = false,
) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.reduce((sum, row) => {
    const time = row.kickoff_at ? new Date(row.kickoff_at).getTime() : NaN;
    if (!Number.isFinite(time) || time < cutoff || time > Date.now()) return sum;
    if (nonLeagueOnly && String(row.competition).toLowerCase() === "prem") {
      return sum;
    }
    return sum + Math.max(0, num(row.minutes));
  }, 0);
}

async function footyPlayerProcesses() {
  const [rows, priors] = await Promise.all([
    supabaseRest<PlayerMetricRow>(
      `footy_player_match_metrics?select=player_id,player_code,team,competition,kickoff_at,minutes,xg,xa,xgot,chances_created,box_touches,final_third_passes,defensive_contributions,xgot_faced,goals_prevented,verification_status&season=eq.${CURRENT_FOOTY_SEASON}&verified=eq.true&order=kickoff_at.asc`,
    ),
    supabaseRest<PlayerSeasonPriorRow>(
      "footy_player_season_priors?select=player_code,player_name,position,team,minutes,xg_per90,xa_per90,xgi_per90,defensive_contribution_per90,saves_per90,verification_status&season=eq.2526&verified=eq.true",
    ),
  ]);
  const priorByCode = new Map<number, PlayerSeasonPriorRow>();
  for (const prior of priors) {
    const code = Number(prior.player_code);
    if (Number.isFinite(code)) priorByCode.set(code, prior);
  }

  // Keep the modelling identity stable across FPL seasons. Season-scoped
  // element ids can change; the Premier League player code is persistent.
  const byPlayerCode = new Map<number, PlayerMetricRow[]>();
  for (const row of rows) {
    const code = Number(row.player_code);
    if (!Number.isFinite(code)) continue;
    const group = byPlayerCode.get(code) ?? [];
    group.push(row);
    byPlayerCode.set(code, group);
  }

  const output = new Map<number, PlayerProcessEvidence>();
  const playerCodes = new Set<number>([
    ...byPlayerCode.keys(),
    ...priorByCode.keys(),
  ]);
  for (const playerCode of playerCodes) {
    const allRows = byPlayerCode.get(playerCode) ?? [];
    const played = allRows.filter((row) => num(row.minutes) > 0);
    const leagueRows = played.filter(
      (row) => String(row.competition).toLowerCase() === "prem",
    );
    const recent = leagueRows.slice(-5);
    const latestThree = leagueRows.slice(-3);
    const premierLeagueMinutes = leagueRows.reduce(
      (sum, row) => sum + Math.max(0, num(row.minutes)),
      0,
    );
    const latestRow =
      played[played.length - 1] ?? allRows[allRows.length - 1];
    const prior = priorByCode.get(playerCode) ?? null;
    const priorMinutes = prior ? Math.max(0, num(prior.minutes)) : 0;
    const currentTeam = latestRow?.team ?? null;
    const priorTeam = prior?.team ?? null;
    const clubChangedSincePrior =
      Boolean(currentTeam && priorTeam) &&
      canonicalTeam(String(currentTeam)) !== canonicalTeam(String(priorTeam));

    const currentXgPer90 = playerRate90(leagueRows, "xg");
    const currentXaPer90 = playerRate90(leagueRows, "xa");
    const priorXgPer90 = prior ? Math.max(0, num(prior.xg_per90)) : 0;
    const priorXaPer90 = prior ? Math.max(0, num(prior.xa_per90)) : 0;
    const priorXgiPer90 = prior
      ? Math.max(
          0,
          num(prior.xgi_per90) || priorXgPer90 + priorXaPer90,
        )
      : 0;
    const effectivePriorMinutes =
      prior && priorMinutes >= 180
        ? clamp(
            priorMinutes * (clubChangedSincePrior ? 0.12 : 0.22),
            180,
            clubChangedSincePrior ? 360 : 540,
          )
        : 0;
    const currentEvidenceWeight =
      effectivePriorMinutes > 0
        ? clamp(
            premierLeagueMinutes /
              (premierLeagueMinutes + effectivePriorMinutes),
            0,
            1,
          )
        : clamp(premierLeagueMinutes / 450, 0, 1);
    const regressedXgPer90 =
      effectivePriorMinutes > 0
        ? currentXgPer90 * currentEvidenceWeight +
          priorXgPer90 * (1 - currentEvidenceWeight)
        : playerRate90(recent, "xg");
    const regressedXaPer90 =
      effectivePriorMinutes > 0
        ? currentXaPer90 * currentEvidenceWeight +
          priorXaPer90 * (1 - currentEvidenceWeight)
        : playerRate90(recent, "xa");
    const regressedXgiPer90 = regressedXgPer90 + regressedXaPer90;

    const baseXgi =
      regressedXgiPer90 > 0
        ? regressedXgiPer90
        : playerRate90(recent, "xg") + playerRate90(recent, "xa");
    const recentXgi =
      playerRate90(latestThree, "xg") + playerRate90(latestThree, "xa");
    const latestThreeMinutes = latestThree.reduce(
      (sum, row) => sum + Math.max(0, num(row.minutes)),
      0,
    );
    const trendReliability = clamp(latestThreeMinutes / 270, 0, 1) * 0.45;
    const attackTrend =
      baseXgi > 0
        ? clamp((recentXgi / baseXgi - 1) * trendReliability, -0.25, 0.25)
        : 0;

    const minutes7 = playerMinutesInWindow(played, 7);
    const minutes14 = playerMinutesInWindow(played, 14);
    const nonLeagueMinutes14 = playerMinutesInWindow(played, 14, true);
    const cutoff14 = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const matches14 = played.filter((row) => {
      const time = row.kickoff_at ? new Date(row.kickoff_at).getTime() : NaN;
      return Number.isFinite(time) && time >= cutoff14 && time <= Date.now();
    }).length;
    const latestTime = played
      .map((row) => (row.kickoff_at ? new Date(row.kickoff_at).getTime() : NaN))
      .filter((value) => Number.isFinite(value) && value <= Date.now())
      .sort((a, b) => b - a)[0];
    const daysRest = Number.isFinite(latestTime)
      ? Math.max(0, (Date.now() - latestTime) / (24 * 60 * 60 * 1000))
      : null;

    let loadRisk = 0;
    if (minutes7 >= 180) loadRisk += 0.06;
    else if (minutes7 >= 120) loadRisk += 0.04;
    else if (minutes7 >= 90) loadRisk += 0.02;
    if (nonLeagueMinutes14 >= 120) loadRisk += 0.035;
    else if (nonLeagueMinutes14 >= 60) loadRisk += 0.02;
    if (daysRest != null && daysRest < 4) loadRisk += 0.035;
    else if (daysRest != null && daysRest < 5) loadRisk += 0.02;
    loadRisk = clamp(loadRisk, 0, 0.12);

    const passShare = leagueRows.length
      ? leagueRows.filter((row) => row.verification_status === "PASS").length /
        leagueRows.length
      : 0;
    const sourceConfidence = clamp(
      0.42 +
        Math.min(0.32, (premierLeagueMinutes / 900) * 0.32) +
        passShare * 0.12 +
        (prior && priorMinutes >= 180 ? 0.10 : 0),
      0.42,
      0.96,
    );

    output.set(playerCode, {
      premierLeagueMinutes,
      premierLeagueMatches: leagueRows.length,
      recentXgPer90: playerRate90(recent, "xg"),
      recentXaPer90: playerRate90(recent, "xa"),
      recentXgotPer90: playerRate90(recent, "xgot"),
      chancesCreatedPer90: playerRate90(recent, "chances_created"),
      boxTouchesPer90: playerRate90(recent, "box_touches"),
      finalThirdPassesPer90: playerRate90(recent, "final_third_passes"),
      defensiveContributionsPer90: playerRate90(
        recent,
        "defensive_contributions",
      ),
      xgotFacedPer90: playerRate90(recent, "xgot_faced"),
      goalsPreventedPer90: playerRate90(recent, "goals_prevented"),
      attackTrend,
      minutes7,
      minutes14,
      nonLeagueMinutes14,
      matches14,
      daysRest,
      loadRisk,
      sourceConfidence,
      priorAvailable: Boolean(prior && priorMinutes >= 180),
      priorMinutes,
      priorTeam,
      priorXgPer90,
      priorXaPer90,
      priorXgiPer90,
      regressedXgPer90,
      regressedXaPer90,
      regressedXgiPer90,
      currentEvidenceWeight,
      clubChangedSincePrior,
    });
  }
  return output;
}

function fixturesForTeam(
  teamId: number,
  eventId: number | null,
  fixtures: Fixture[],
) {
  if (!eventId) return [];
  return fixtures.filter(
    (fixture) =>
      fixture.event === eventId &&
      (fixture.team_h === teamId || fixture.team_a === teamId),
  );
}

function availability(player: FplPlayer) {
  if (player.status === "u" || player.status === "s") return 0;
  return player.chance_of_playing_next_round ?? 100;
}

function shrunkPer90(
  total: string | number | null | undefined,
  minutes: number,
  cap: number,
) {
  if (minutes <= 0) return 0;
  const raw = (num(total) * 90) / minutes;
  // Early-season per-90 rates are volatile. Require roughly four full matches
  // before trusting the observed rate completely.
  const reliability = clamp(minutes / 360, 0, 1);
  return clamp(raw, 0, cap) * reliability;
}

function xgiPer90(player: FplPlayer) {
  return shrunkPer90(player.expected_goal_involvements, player.minutes, 1.2);
}

function rankPlayers(
  bootstrap: Bootstrap,
  fixtures: Fixture[],
  eventId: number | null,
  process: Map<string, TeamProcess>,
  useExpectedNext = true,
  includeUnavailable = false,
): RankedPlayer[] {
  const teams = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const positions = new Map(
    bootstrap.element_types.map((item) => [item.id, item.singular_name_short]),
  );

  return bootstrap.elements
    .map((player) => {
      const team = teams.get(player.team);
      const teamFixtures = fixturesForTeam(player.team, eventId, fixtures);
      const teamProcess = team
        ? process.get(canonicalTeam(team.name))
        : undefined;
      const available = availability(player);
      const position = positions.get(player.element_type) ?? "—";
      const price = player.now_cost / 10;
      const ep = Math.max(0, num(player.ep_next));
      const form = Math.max(0, num(player.form));
      const ppg = Math.max(0, num(player.points_per_game));
      const xgi90 = Math.max(0, xgiPer90(player));
      const xg90 = Math.max(
        0,
        shrunkPer90(player.expected_goals, player.minutes, 1.0),
      );
      const xa90 = Math.max(
        0,
        shrunkPer90(player.expected_assists, player.minutes, 1.0),
      );
      const xgc90 = Math.max(
        0,
        shrunkPer90(player.expected_goals_conceded, player.minutes, 4.0),
      );
      const starts = Math.max(0, Number(player.starts || 0));
      const startReliability =
        starts >= 3 ? 1 : starts === 2 ? 0.90 : starts === 1 ? 0.76 : 0.58;

      const matchupFactors = teamFixtures.map((fixture) => {
        const isHome = fixture.team_h === player.team;
        const opponentId = isHome ? fixture.team_a : fixture.team_h;
        const opponentTeam = teams.get(opponentId);
        const opponentProcess = opponentTeam
          ? process.get(canonicalTeam(opponentTeam.name))
          : undefined;
        const attackMatchup = clamp(
          Math.sqrt(
            (teamProcess?.attackIndex ?? 1) /
              (opponentProcess?.defenceIndex ?? 1),
          ),
          0.82,
          1.20,
        );
        const defenceMatchup = clamp(
          Math.sqrt(
            (teamProcess?.defenceIndex ?? 1) /
              (opponentProcess?.attackIndex ?? 1),
          ),
          0.82,
          1.20,
        );
        if (position === "GKP") return defenceMatchup;
        if (position === "DEF") {
          // Defender value is mostly clean-sheet environment, but attacking
          // full-backs/wing-backs still deserve some attacking matchup credit.
          return defenceMatchup * 0.72 + attackMatchup * 0.28;
        }
        return attackMatchup;
      });

      const processFactor = matchupFactors.length
        ? matchupFactors.reduce((sum, value) => sum + value, 0) /
          matchupFactors.length
        : 0;
      const processBoost = processFactor - 1;

      const difficultyValues = teamFixtures.map((fixture) =>
        fixture.team_h === player.team
          ? fixture.team_h_difficulty
          : fixture.team_a_difficulty,
      );
      const difficulty = difficultyValues.length
        ? difficultyValues.reduce((sum, value) => sum + value, 0) /
          difficultyValues.length
        : 5;
      const fixtureFactors = difficultyValues.map((value) => {
        const defensive = position === "GKP" || position === "DEF";
        const step = defensive ? 0.10 : 0.06;
        return clamp(
          1 + (3 - value) * step,
          defensive ? 0.76 : 0.86,
          defensive ? 1.18 : 1.12,
        );
      });
      const fixtureFactor = fixtureFactors.length
        ? fixtureFactors.reduce((sum, value) => sum + value, 0) /
          fixtureFactors.length
        : 0;

      const opponent = teamFixtures
        .map((fixture) => {
          const opponentId =
            fixture.team_h === player.team
              ? fixture.team_a
              : fixture.team_h;
          return teams.get(opponentId)?.short_name ?? "—";
        })
        .join(" + ");
      const opponentName = teamFixtures
        .map((fixture) => {
          const opponentId =
            fixture.team_h === player.team
              ? fixture.team_a
              : fixture.team_h;
          return teams.get(opponentId)?.name ?? "—";
        })
        .join(" + ");

      // FPL ep_next is useful as a public prior but already contains some
      // fixture information, so it is deliberately not allowed to dominate.
      const officialBase = useExpectedNext
        ? ep * 0.48 +
          form * 0.16 +
          ppg * 0.16 +
          xgi90 * 0.92 +
          xg90 * 0.28 +
          xa90 * 0.28
        : form * 0.30 +
          ppg * 0.36 +
          xgi90 * 1.05 +
          xg90 * 0.24 +
          xa90 * 0.24;

      const fixtureMultiplier =
        teamFixtures.length === 0
          ? 0
          : teamFixtures.length === 1
            ? 1
            : 1 + 0.72 * (teamFixtures.length - 1);

      const teamTrend =
        position === "GKP"
          ? (teamProcess?.defenceTrend ?? 0)
          : position === "DEF"
            ? (teamProcess?.defenceTrend ?? 0) * 0.65 +
              (teamProcess?.attackTrend ?? 0) * 0.35
            : (teamProcess?.attackTrend ?? 0);
      const trendFactor = 1 + clamp(teamTrend * 0.35, -0.08, 0.08);
      const processTrust = 0.65 + 0.35 * (teamProcess?.sourceConfidence ?? 0.74);
      const processMultiplier =
        1 + (processFactor - 1) * 0.50 * processTrust;
      const availabilityMultiplier = clamp(available / 100, 0, 1);
      const startMultiplier = 0.85 + startReliability * 0.15;

      const score =
        officialBase *
        processMultiplier *
        fixtureFactor *
        trendFactor *
        fixtureMultiplier *
        availabilityMultiplier *
        startMultiplier;

      return {
        id: player.id,
        name: player.web_name,
        team: team?.short_name ?? "—",
        teamName: team?.name ?? team?.short_name ?? "—",
        position,
        price,
        totalPoints: player.total_points,
        pointsPerGame: ppg,
        goalsScored: player.goals_scored,
        assists: player.assists,
        cleanSheets: player.clean_sheets,
        goalsConceded: player.goals_conceded,
        saves: player.saves,
        bonus: player.bonus,
        bps: player.bps,
        defensiveContribution: num(player.defensive_contribution),
        form,
        expectedNext: useExpectedNext ? ep : score,
        assistantScore: score,
        fixtureDifficulty: difficulty,
        availability: available,
        xgiPer90: xgi90,
        xgPer90: xg90,
        xaPer90: xa90,
        xgcPer90: xgc90,
        minutes: player.minutes,
        starts,
        news: player.news ?? "",
        newsAdded: player.news_added ?? null,
        setPieceRole:
          player.penalties_order && player.penalties_order <= 2
            ? "Penalties"
            : player.direct_freekicks_order &&
                player.direct_freekicks_order <= 2
              ? "Direct free-kicks"
              : player.corners_and_indirect_freekicks_order &&
                  player.corners_and_indirect_freekicks_order <= 2
                ? "Corners / indirect free-kicks"
                : null,
        selectedBy: num(player.selected_by_percent),
        transfersNet:
          player.transfers_in_event - player.transfers_out_event,
        valueScore: price > 0 ? score / price : 0,
        processBoost,
        processFactor,
        fixtureFactor,
        trendFactor,
        startReliability,
        teamAttackIndex: teamProcess?.attackIndex ?? 1,
        teamDefenceIndex: teamProcess?.defenceIndex ?? 1,
        opponent: opponent || null,
        opponentName: opponentName || null,
        fixtureCount: teamFixtures.length,
        scoreBreakdown: {
          base: officialBase,
          processMultiplier,
          fixtureMultiplier: fixtureFactor * fixtureMultiplier,
          teamTrendMultiplier: trendFactor,
          availabilityMultiplier,
          startMultiplier,
        },
      } satisfies RankedPlayer;
    })
    .filter((player) => includeUnavailable || player.availability > 0)
    .sort((a, b) => b.assistantScore - a.assistantScore);
}

function buildFuturePlan(
  bootstrap: Bootstrap,
  fixtures: Fixture[],
  process: Map<string, TeamProcess>,
  nextEvent: FplEvent | null,
) {
  if (!nextEvent) {
    return {
      futurePlan: [] as FutureGameweekPlan[],
      chipRadar: [] as ChipSignal[],
    };
  }

  const upcomingEvents = bootstrap.events
    .filter((event) => event.id >= nextEvent.id && !event.finished)
    .sort((a, b) => a.id - b.id)
    .slice(0, 8);

  const teamById = new Map(bootstrap.teams.map((team) => [team.id, team]));

  const futurePlan = upcomingEvents.map((event) => {
    const ranked = rankPlayers(
      bootstrap,
      fixtures,
      event.id,
      process,
      false,
    );
    const eligible = ranked.filter(
      (player) => player.availability >= 75 && player.fixtureCount > 0,
    );
    const counts = new Map<number, number>();
    for (const fixture of fixtures.filter((item) => item.event === event.id)) {
      counts.set(fixture.team_h, (counts.get(fixture.team_h) ?? 0) + 1);
      counts.set(fixture.team_a, (counts.get(fixture.team_a) ?? 0) + 1);
    }

    const doubleTeams = bootstrap.teams
      .filter((team) => (counts.get(team.id) ?? 0) > 1)
      .map((team) => team.short_name);
    const blankTeams = bootstrap.teams
      .filter((team) => (counts.get(team.id) ?? 0) === 0)
      .map((team) => team.short_name);

    return {
      eventId: event.id,
      name: event.name,
      deadline: event.deadline_time,
      captain: eligible[0] ?? null,
      viceCaptain: eligible[1] ?? null,
      topTransfers: eligible.slice(0, 4),
      doubleTeams,
      blankTeams,
    } satisfies FutureGameweekPlan;
  });

  const tripleCandidate = [...futurePlan]
    .filter((plan) => plan.captain)
    .sort(
      (a, b) =>
        (b.captain?.assistantScore ?? 0) -
        (a.captain?.assistantScore ?? 0),
    )[0];

  const freeHitCandidate = [...futurePlan]
    .sort(
      (a, b) =>
        b.blankTeams.length + b.doubleTeams.length * 1.5 -
        (a.blankTeams.length + a.doubleTeams.length * 1.5),
    )[0];

  const benchBoostCandidate = [...futurePlan]
    .sort((a, b) => b.doubleTeams.length - a.doubleTeams.length)[0];

  const teamRunScores = bootstrap.teams.map((team) => {
    const eventScores = upcomingEvents.map((event) => {
      const fixturesForEvent = fixturesForTeam(team.id, event.id, fixtures);
      if (!fixturesForEvent.length) return 0;
      return fixturesForEvent.reduce((sum, fixture) => {
        const opponentId =
          fixture.team_h === team.id ? fixture.team_a : fixture.team_h;
        const opponent = teamById.get(opponentId);
        const ownProcess = process.get(canonicalTeam(team.name));
        const oppProcess = opponent
          ? process.get(canonicalTeam(opponent.name))
          : undefined;
        return (
          sum +
          Math.sqrt(
            (ownProcess?.attackIndex ?? 1) /
              (oppProcess?.defenceIndex ?? 1),
          )
        );
      }, 0);
    });
    return {
      team: team.short_name,
      total: eventScores.reduce((sum, value) => sum + value, 0),
    };
  }).sort((a,b)=>b.total-a.total);

  const chipRadar: ChipSignal[] = [
    {
      chip: "TRIPLE CAPTAIN",
      status:
        tripleCandidate?.captain?.fixtureCount &&
        tripleCandidate.captain.fixtureCount > 1
          ? "STRONG"
          : (tripleCandidate?.captain?.assistantScore ?? 0) >= 6
            ? "WATCH"
            : "HOLD",
      eventName: tripleCandidate?.name ?? null,
      reason: tripleCandidate?.captain
        ? `${tripleCandidate.captain.name} leads the five-Gameweek captain model with ${tripleCandidate.captain.fixtureCount} fixture(s) in ${tripleCandidate.name}.`
        : "No standout captain window yet.",
    },
    {
      chip: "BENCH BOOST",
      status:
        (benchBoostCandidate?.doubleTeams.length ?? 0) >= 4
          ? "STRONG"
          : (benchBoostCandidate?.doubleTeams.length ?? 0) >= 2
            ? "WATCH"
            : "HOLD",
      eventName: benchBoostCandidate?.name ?? null,
      reason: benchBoostCandidate
        ? `${benchBoostCandidate.name} currently has ${benchBoostCandidate.doubleTeams.length} double-fixture team(s). Bench Boost becomes more attractive as doubles accumulate.`
        : "No obvious Bench Boost window yet.",
    },
    {
      chip: "FREE HIT",
      status:
        (freeHitCandidate?.blankTeams.length ?? 0) >= 6
          ? "STRONG"
          : (freeHitCandidate?.blankTeams.length ?? 0) >= 3
            ? "WATCH"
            : "HOLD",
      eventName: freeHitCandidate?.name ?? null,
      reason: freeHitCandidate
        ? `${freeHitCandidate.name} has ${freeHitCandidate.blankTeams.length} blank team(s) and ${freeHitCandidate.doubleTeams.length} double team(s) on the current schedule.`
        : "No major blank/double disruption in the next five Gameweeks.",
    },
    {
      chip: "WILDCARD",
      status: "WATCH",
      eventName: futurePlan[0]?.name ?? null,
      reason: `Use the next five-Gameweek fixture swing rather than one bad week. Current strongest attacking runs include ${teamRunScores.slice(0,3).map((item)=>item.team).join(", ") || "no clear cluster yet"}.`,
    },
  ];

  return { futurePlan, chipRadar };
}

function weightedHorizonGain(
  outId: number,
  inId: number,
  horizonRankings: RankedPlayer[][],
) {
  const weights = [0.50, 0.25, 0.15, 0.10];
  let total = 0;
  let used = 0;
  horizonRankings.slice(0, weights.length).forEach((ranked, index) => {
    const byId = new Map(ranked.map((player) => [player.id, player]));
    const out = byId.get(outId);
    const incoming = byId.get(inId);
    if (!out || !incoming) return;
    total += (incoming.assistantScore - out.assistantScore) * weights[index];
    used += weights[index];
  });
  return used > 0 ? total / used : 0;
}

function minimumTransferGain(
  out: RankedPlayer,
  incoming: RankedPlayer,
  nextWeekGain: number | null,
) {
  // A free transfer is an asset. Small one-week edges should be banked.
  let threshold = Math.max(0.85, out.assistantScore * 0.16);

  // Spending a transfer to move into a clearly worse immediate fixture needs
  // a larger football edge, especially for clean-sheet-dependent positions.
  const difficultyGap = incoming.fixtureDifficulty - out.fixtureDifficulty;
  if (difficultyGap > 0) {
    threshold += difficultyGap * 0.45;
  }
  if (
    (incoming.position === "DEF" || incoming.position === "GKP") &&
    incoming.fixtureDifficulty >= 5
  ) {
    threshold += 0.35;
  }

  // If the same move becomes materially better next week, waiting has option
  // value and the current move must clear a higher bar.
  const currentGain = incoming.assistantScore - out.assistantScore;
  if (nextWeekGain != null && nextWeekGain > currentGain + 0.55) {
    threshold += 0.55;
  }

  if (incoming.startReliability < 0.9) threshold += 0.25;
  return threshold;
}

async function analyseTeam(
  entryId: number,
  current: FplEvent | null,
  ranked: RankedPlayer[],
  horizonRankings: RankedPlayer[][] = [ranked],
): Promise<TeamAnalysis> {
  const entry = await fplFetch<Entry>(`entry/${entryId}/`, 300);
  const eventId = current?.id ?? 1;
  const picks = await fplFetch<PicksResponse>(
    `entry/${entryId}/event/${eventId}/picks/`,
    300,
  );
  const rankedById = new Map(ranked.map((player) => [player.id, player]));
  const squad = picks.picks
    .map((pick) => rankedById.get(pick.element))
    .filter((player): player is RankedPlayer => Boolean(player));
  const squadIds = new Set(squad.map((player) => player.id));
  const currentCaptainPick = picks.picks.find((pick) => pick.is_captain);
  const currentCaptain = currentCaptainPick
    ? rankedById.get(currentCaptainPick.element) ?? null
    : null;
  const recommendedCaptain =
    [...squad]
      .filter((player) => player.availability >= 75)
      .sort((a, b) => b.assistantScore - a.assistantScore)[0] ?? null;

  const teamCounts = new Map<string, number>();
  for (const player of squad) {
    teamCounts.set(player.team, (teamCounts.get(player.team) ?? 0) + 1);
  }
  const bank = entry.last_deadline_bank / 10;
  const nextRanking = horizonRankings[1] ?? null;
  const weakLinks = [...squad]
    .sort((a, b) => a.assistantScore - b.assistantScore)
    .slice(0, 5)
    .map((player) => {
      const budget = player.price + bank;
      const candidates = ranked
        .filter((candidate) => {
          if (candidate.position !== player.position) return false;
          if (squadIds.has(candidate.id)) return false;
          if (candidate.price > budget) return false;
          if (candidate.availability < 75 || candidate.fixtureCount <= 0) {
            return false;
          }
          const afterRemoval =
            (teamCounts.get(candidate.team) ?? 0) -
            (candidate.team === player.team ? 1 : 0);
          return afterRemoval < 3;
        })
        .map((candidate) => {
          const gain = candidate.assistantScore - player.assistantScore;
          const nextById = nextRanking
            ? new Map(nextRanking.map((item) => [item.id, item]))
            : null;
          const nextOut = nextById?.get(player.id) ?? null;
          const nextIn = nextById?.get(candidate.id) ?? null;
          const nextWeekGain =
            nextOut && nextIn
              ? nextIn.assistantScore - nextOut.assistantScore
              : null;
          const horizonGain = weightedHorizonGain(
            player.id,
            candidate.id,
            horizonRankings,
          );
          const minimumGain = minimumTransferGain(
            player,
            candidate,
            nextWeekGain,
          );
          const timing =
            gain >= minimumGain && horizonGain > 0.35
              ? ("NOW" as const)
              : horizonGain > 0.75 &&
                  nextWeekGain != null &&
                  nextWeekGain > gain + 0.35
                ? ("WAIT" as const)
                : ("HOLD" as const);
          return {
            candidate,
            gain,
            horizonGain,
            minimumGain,
            nextWeekGain,
            timing,
          };
        })
        .sort((a, b) => {
          const timingRank = { NOW: 2, WAIT: 1, HOLD: 0 } as const;
          const timingDelta = timingRank[b.timing] - timingRank[a.timing];
          if (timingDelta !== 0) return timingDelta;
          return b.horizonGain - a.horizonGain || b.gain - a.gain;
        });

      const bestNow = candidates.find((item) => item.timing === "NOW") ?? null;
      const bestWait = candidates.find((item) => item.timing === "WAIT") ?? null;
      const selected = bestNow ?? bestWait;
      const replacement = bestNow?.candidate ?? null;
      const gain = selected?.gain ?? 0;
      const minimumGain = selected?.minimumGain ?? Math.max(0.85, player.assistantScore * 0.16);
      const horizonGain = selected?.horizonGain ?? 0;
      const timing = selected?.timing ?? ("HOLD" as const);

      const reason = bestNow
        ? `${bestNow.candidate.name} clears the move-now threshold: +${bestNow.gain.toFixed(1)} this Gameweek vs +${bestNow.minimumGain.toFixed(1)} required, with a +${bestNow.horizonGain.toFixed(1)} weighted four-Gameweek edge.`
        : bestWait
          ? `${bestWait.candidate.name} looks stronger over the horizon (+${bestWait.horizonGain.toFixed(1)}), but the immediate edge does not justify spending the transfer yet. Watch next Gameweek.`
          : "No same-position option clears Footy's transfer-value and timing thresholds.";

      return {
        player,
        replacement,
        reason,
        gain,
        minimumGain,
        horizonGain,
        timing,
      };
    });

  return {
    entryId,
    teamName: entry.name,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    overallPoints: entry.summary_overall_points,
    overallRank: entry.summary_overall_rank,
    bank,
    squadValue: entry.last_deadline_value / 10,
    currentCaptain,
    recommendedCaptain,
    weakLinks,
    squad: [...squad].sort((a, b) => b.assistantScore - a.assistantScore),
  };
}

function buildManagerFuturePlan(
  bootstrap: Bootstrap,
  fixtures: Fixture[],
  process: Map<string, TeamProcess>,
  manager: TeamAnalysis,
  nextEvent: FplEvent | null,
): ManagerFutureGameweek[] {
  if (!nextEvent) return [];

  const upcomingEvents = bootstrap.events
    .filter((event) => event.id >= nextEvent.id && !event.finished)
    .sort((a, b) => a.id - b.id)
    .slice(0, 4);

  const squadIds = new Set(manager.squad.map((player) => player.id));
  const currentTeamCounts = new Map<string, number>();
  for (const player of manager.squad) {
    currentTeamCounts.set(
      player.team,
      (currentTeamCounts.get(player.team) ?? 0) + 1,
    );
  }

  return upcomingEvents.map((event) => {
    const ranked = rankPlayers(
      bootstrap,
      fixtures,
      event.id,
      process,
      false,
    );
    const rankedById = new Map(ranked.map((player) => [player.id, player]));
    const squad = manager.squad
      .map((player) => rankedById.get(player.id))
      .filter((player): player is RankedPlayer => Boolean(player));

    const captain =
      [...squad]
        .filter(
          (player) =>
            player.availability >= 75 && player.fixtureCount > 0,
        )
        .sort((a, b) => b.assistantScore - a.assistantScore)[0] ?? null;

    const transferCandidates = squad
      .map((out) => {
        const budget = out.price + manager.bank;
        const incoming =
          ranked.find((candidate) => {
            if (candidate.position !== out.position) return false;
            if (squadIds.has(candidate.id)) return false;
            if (candidate.availability < 75 || candidate.fixtureCount <= 0) {
              return false;
            }
            if (candidate.price > budget) return false;

            const afterRemoval =
              (currentTeamCounts.get(candidate.team) ?? 0) -
              (candidate.team === out.team ? 1 : 0);
            if (afterRemoval >= 3) return false;

            const gain = candidate.assistantScore - out.assistantScore;
            return gain >= minimumTransferGain(out, candidate, null);
          }) ?? null;

        return incoming
          ? {
              out,
              in: incoming,
              gain: incoming.assistantScore - out.assistantScore,
            }
          : null;
      })
      .filter(
        (
          move,
        ): move is {
          out: RankedPlayer;
          in: RankedPlayer;
          gain: number;
        } => Boolean(move),
      )
      .sort((a, b) => b.gain - a.gain);

    return {
      eventId: event.id,
      name: event.name,
      deadline: event.deadline_time,
      captain,
      transfer: transferCandidates[0] ?? null,
    };
  });
}

export async function getFplHub(teamId?: number): Promise<FplHub> {
  const [bootstrapSnapshot, fixturesSnapshot, process] = await Promise.all([
    cachedFpl<Bootstrap>("bootstrap-static"),
    cachedFpl<Fixture[]>("fixtures"),
    footyProcesses(),
  ]);

  let bootstrap = bootstrapSnapshot?.payload ?? null;
  let fixtures = fixturesSnapshot?.payload ?? null;
  let baseError: string | null = null;
  let dataRetrievedAt =
    bootstrapSnapshot?.retrieved_at ?? fixturesSnapshot?.retrieved_at ?? null;

  if (!bootstrap || !fixtures) {
    try {
      const direct = await Promise.all([
        fplFetch<Bootstrap>("bootstrap-static/"),
        fplFetch<Fixture[]>("fixtures/"),
      ]);
      bootstrap = direct[0];
      fixtures = direct[1];
      dataRetrievedAt = new Date().toISOString();
    } catch {
      baseError =
        "Official FPL data is temporarily unavailable. Footy is keeping the page online and will retry through the cached feed automatically.";
    }
  }

  if (!bootstrap || !fixtures) {
    return {
      currentEvent: null,
      nextEvent: null,
      captains: [],
      transfers: [],
      values: [],
      processTeams: process.size,
      teamAnalysis: null,
      teamError: null,
      baseError,
      dataRetrievedAt,
      futurePlan: [],
      chipRadar: [],
    };
  }

  const { current, next } = currentAndNext(bootstrap.events);
  const { futurePlan, chipRadar } = buildFuturePlan(
    bootstrap,
    fixtures,
    process,
    next,
  );
  const ranked = rankPlayers(
    bootstrap,
    fixtures,
    next?.id ?? current?.id ?? null,
    process,
  );

  let teamAnalysis: TeamAnalysis | null = null;
  let teamError: string | null = null;
  if (teamId && Number.isInteger(teamId) && teamId > 0) {
    try {
      teamAnalysis = await analyseTeam(teamId, current, ranked);
    } catch {
      teamError =
        "Your public FPL squad could not be loaded right now. The main assistant is still available; personal squad analysis will retry when the FPL endpoint is reachable.";
    }
  }

  const captains = ranked
    .filter((player) => player.availability >= 75 && player.expectedNext > 0)
    .slice(0, 8);
  const transfers = [...ranked]
    .filter((player) => player.availability >= 75 && player.expectedNext > 0)
    .sort(
      (a, b) =>
        b.assistantScore + b.valueScore * 1.4 -
        (a.assistantScore + a.valueScore * 1.4),
    )
    .slice(0, 10);
  const values = [...ranked]
    .filter((player) => player.availability >= 75 && player.expectedNext > 0)
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 10);

  return {
    currentEvent: current,
    nextEvent: next,
    captains,
    transfers,
    values,
    processTeams: process.size,
    teamAnalysis,
    teamError,
    baseError,
    dataRetrievedAt,
    futurePlan,
    chipRadar,
  };
}


// League Edge on-demand manager analysis
export type LeagueManagerEdgeAnalysis = {
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
  processTeams: number;
  dataRetrievedAt: string;
  freshness: {
    source: "LIVE_FPL" | "CACHED_FALLBACK";
    nearDeadline: boolean;
  };
  manager: TeamAnalysis;
  rival: TeamAnalysis | null;
  rivals: TeamAnalysis[];
  overlap: {
    count: number;
    common: RankedPlayer[];
    managerOnly: RankedPlayer[];
    rivalOnly: RankedPlayer[];
  };
  captainOptions: RankedPlayer[];
  transferOptions: SquadSuggestion[];
  playerTrends: Array<RankedPlayer & { trendScore: number }>;
  teamTrends: TeamProcess[];
  teamProcesses: TeamProcess[];
  dataCoverage: {
    measured: string[];
    notMeasured: string[];
  };
  futurePlan: FutureGameweekPlan[];
  managerFuturePlan: ManagerFutureGameweek[];
  chipRadar: ChipSignal[];
};

export async function getLeagueManagerEdgeAnalysis(
  entryId: number,
  rivalEntryId?: number | number[] | null,
): Promise<LeagueManagerEdgeAnalysis> {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error("A valid FPL entry ID is required.");
  }

  const [bootstrapSnapshot, fixturesSnapshot, process] = await Promise.all([
    cachedFpl<Bootstrap>("bootstrap-static"),
    cachedFpl<Fixture[]>("fixtures"),
    footyProcesses(),
  ]);

  let bootstrap: Bootstrap | null = null;
  let fixtures: Fixture[] | null = null;
  let source: "LIVE_FPL" | "CACHED_FALLBACK" = "LIVE_FPL";
  let dataRetrievedAt = new Date().toISOString();

  // Manager analysis is an intentional freshness boundary. Always try the
  // official live feed first, then fall back to the automated snapshots.
  try {
    const direct = await Promise.all([
      fplFetch<Bootstrap>("bootstrap-static/", 0),
      fplFetch<Fixture[]>("fixtures/", 0),
    ]);
    bootstrap = direct[0];
    fixtures = direct[1];
  } catch {
    bootstrap = bootstrapSnapshot?.payload ?? null;
    fixtures = fixturesSnapshot?.payload ?? null;
    source = "CACHED_FALLBACK";
    dataRetrievedAt =
      bootstrapSnapshot?.retrieved_at ??
      fixturesSnapshot?.retrieved_at ??
      dataRetrievedAt;
  }

  if (!bootstrap || !fixtures) {
    throw new Error("Official FPL data and the Footy fallback cache are unavailable.");
  }

  const { current, next } = currentAndNext(bootstrap.events);
  const deadlineMs = next ? new Date(next.deadline_time).getTime() : 0;
  const nearDeadline =
    Boolean(deadlineMs) &&
    deadlineMs > Date.now() &&
    deadlineMs - Date.now() <= 90 * 60 * 1000;

  const ranked = rankPlayers(
    bootstrap,
    fixtures,
    next?.id ?? current?.id ?? null,
    process,
  );
  const { futurePlan, chipRadar } = buildFuturePlan(
    bootstrap,
    fixtures,
    process,
    next,
  );
  const upcomingEventIds = bootstrap.events
    .filter(
      (event) =>
        next && event.id >= next.id && !event.finished,
    )
    .sort((a, b) => a.id - b.id)
    .slice(0, 4)
    .map((event) => event.id);
  const horizonRankings = upcomingEventIds.length
    ? upcomingEventIds.map((eventId) =>
        rankPlayers(bootstrap!, fixtures!, eventId, process, false),
      )
    : [ranked];

  const rivalIdsInput = Array.isArray(rivalEntryId)
    ? rivalEntryId
    : rivalEntryId
      ? [rivalEntryId]
      : [];
  const uniqueRivalIds = [...new Set(
    rivalIdsInput.filter(
      (id): id is number => Number.isInteger(id) && id > 0 && id !== entryId,
    ),
  )];

  const [manager, ...rivals] = await Promise.all([
    analyseTeam(entryId, current, ranked, horizonRankings),
    ...uniqueRivalIds.map((id) =>
      analyseTeam(id, current, ranked, horizonRankings),
    ),
  ]);
  const rival = rivals[0] ?? null;

  const managerIds = new Set(manager.squad.map((player) => player.id));
  const rivalIds = new Set((rival?.squad ?? []).map((player) => player.id));

  const common = rival
    ? manager.squad
        .filter((player) => rivalIds.has(player.id))
        .sort((a, b) => b.assistantScore - a.assistantScore)
    : [];

  const managerOnly = rival
    ? manager.squad
        .filter((player) => !rivalIds.has(player.id))
        .sort((a, b) => b.assistantScore - a.assistantScore)
    : [...manager.squad];

  const rivalOnly = rival
    ? rival.squad
        .filter((player) => !managerIds.has(player.id))
        .sort((a, b) => b.assistantScore - a.assistantScore)
    : [];

  const captainOptions = [...manager.squad]
    .filter((player) => player.availability >= 75)
    .sort((a, b) => b.assistantScore - a.assistantScore)
    .slice(0, 3);

  const transferOptions = manager.weakLinks
    .filter((item) => item.replacement)
    .sort(
      (a, b) =>
        (b.replacement?.assistantScore ?? 0) -
        (a.replacement?.assistantScore ?? 0),
    )
    .slice(0, 3);

  const managerFuturePlan = buildManagerFuturePlan(
    bootstrap,
    fixtures,
    process,
    manager,
    next,
  );

  const playerTrends = [...ranked]
    .map((player) => {
      const transferMomentum =
        Math.sign(player.transfersNet) *
        Math.log1p(Math.abs(player.transfersNet)) /
        10;
      const teamProcess = process.get(canonicalTeam(
        bootstrap!.teams.find((team) => team.short_name === player.team)?.name ??
          player.team,
      ));
      const roleTrend =
        player.position === "GKP"
          ? (teamProcess?.defenceTrend ?? 0)
          : player.position === "DEF"
            ? (teamProcess?.defenceTrend ?? 0) * 0.65 +
              (teamProcess?.attackTrend ?? 0) * 0.35
            : (teamProcess?.attackTrend ?? 0);
      const trendScore =
        player.form * 0.38 +
        player.xgiPer90 * 2.2 +
        player.processBoost * 3 +
        roleTrend * 4 +
        transferMomentum * 0.45;
      return { ...player, trendScore };
    })
    .filter((player) => player.availability >= 75 && player.fixtureCount > 0)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 6);

  const teamTrends = [...process.values()]
    .sort(
      (a, b) =>
        Math.max(b.attackIndex, b.defenceIndex) -
        Math.max(a.attackIndex, a.defenceIndex),
    )
    .slice(0, 6);

  return {
    currentEvent: current,
    nextEvent: next,
    processTeams: process.size,
    dataRetrievedAt,
    freshness: {
      source,
      nearDeadline,
    },
    manager,
    rival,
    rivals,
    overlap: {
      count: common.length,
      common,
      managerOnly,
      rivalOnly,
    },
    captainOptions,
    transferOptions,
    playerTrends,
    teamTrends,
    teamProcesses: [...process.values()],
    dataCoverage: {
      measured: [
        "Official FPL expected points/form/points per game",
        "Player xG/xA/xGI per 90 with early-sample shrinkage",
        "Starts, minutes, availability and official player news",
        "Fixture difficulty and opponent-adjusted team process",
        "Team xG/xGA, shots/SOT, shots conceded",
        "Set-piece xG/xGA, PPDA, deep completions and territory/progression proxies",
        "Verified xA/chances-created, xGOT and goalkeeper goals-prevented enrichment when available",
        "Player-match process trends plus cup/Europe workload and short-rest signals",
        "Prior-season player baselines joined by stable player code and progressively discounted by current minutes",
        "Recent attack/defence process trend with regression",
        "Mini-league ownership, points gaps, chips, hits and estimated free transfers",
      ],
      notMeasured: [
        "Player chemistry",
        "Confirmed tactical role changes without reliable public data",
        "True field tilt and defensive line height when not present in a verified feed",
        "Transition/rest-defence events and defensive errors until a trustworthy event feed is configured",
        "Unconfirmed line-ups before official team news",
      ],
    },
    futurePlan,
    managerFuturePlan,
    chipRadar,
  };
}


export type PlayerDatabasePayload = {
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
  dataRetrievedAt: string;
  freshness: "LIVE_FPL" | "CACHED_FALLBACK";
  processTeams: number;
  players: RankedPlayer[];
};

export async function getPlayerDatabase(): Promise<PlayerDatabasePayload> {
  const [bootstrapSnapshot, fixturesSnapshot, process] = await Promise.all([
    cachedFpl<Bootstrap>("bootstrap-static"),
    cachedFpl<Fixture[]>("fixtures"),
    footyProcesses(),
  ]);

  let bootstrap: Bootstrap | null = null;
  let fixtures: Fixture[] | null = null;
  let freshness: "LIVE_FPL" | "CACHED_FALLBACK" = "LIVE_FPL";
  let dataRetrievedAt = new Date().toISOString();

  try {
    const direct = await Promise.all([
      fplFetch<Bootstrap>("bootstrap-static/", 0),
      fplFetch<Fixture[]>("fixtures/", 0),
    ]);
    bootstrap = direct[0];
    fixtures = direct[1];
  } catch {
    bootstrap = bootstrapSnapshot?.payload ?? null;
    fixtures = fixturesSnapshot?.payload ?? null;
    freshness = "CACHED_FALLBACK";
    dataRetrievedAt =
      bootstrapSnapshot?.retrieved_at ??
      fixturesSnapshot?.retrieved_at ??
      dataRetrievedAt;
  }

  if (!bootstrap || !fixtures) {
    throw new Error("Player database is temporarily unavailable.");
  }

  const { current, next } = currentAndNext(bootstrap.events);
  const players = rankPlayers(
    bootstrap,
    fixtures,
    next?.id ?? current?.id ?? null,
    process,
    true,
    true,
  );

  return {
    currentEvent: current,
    nextEvent: next,
    dataRetrievedAt,
    freshness,
    processTeams: process.size,
    players,
  };
}



export type EpaBreakdown = {
  expectedMinutes: number;
  appearance: number;
  attacking: number;
  cleanSheet: number;
  conceded: number;
  saves: number;
  bonus: number;
  defensiveContribution: number;
  baseXP: number;
  replacementXP: number;
  replacementSample: number;
  epa: number;
  epaPerMillion: number;
  actualAttackPointsPer90: number;
  expectedAttackPointsPer90: number;
  underperformanceGap: number;
  recentAverageMinutes: number | null;
  volumeFloorPass: boolean | null;
  undervalued: boolean;
};

export type ScoutSourceVerification = {
  source: string;
  status: "ACTIVE" | "VERIFIED_REFERENCE" | "CROSS_CHECK" | "AVAILABLE_NOT_ACTIVE" | "LICENSED_ONLY";
  provides: string;
};

export type ScoutHorizonPoint = {
  eventId: number;
  name: string;
  opponent: string | null;
  opponentName: string | null;
  homeAway: "H" | "A" | "—";
  difficulty: number;
  score: number;
  fixtureFactor: number;
  processFactor: number;
};

export type ScoutPlayerProfile = {
  player: RankedPlayer;
  horizon: ScoutHorizonPoint[];
  score3: number;
  score6: number;
  score8: number;
  bestWindow: {
    startEventId: number | null;
    startName: string;
    endName: string;
    score: number;
    index: number;
  };
  status: "BUY_NOW" | "WATCH" | "FUTURE_TARGET";
  epa: EpaBreakdown;
  reasons: string[];
  risks: string[];
  coreSources: string[];
  evidence: PlayerProcessEvidence | null;
  decisionConfidence: "HIGH" | "MEDIUM" | "LOW";
};

export type ScoutTeamProfile = {
  teamId: number;
  team: string;
  shortName: string;
  process: TeamProcess | null;
  outlook: "STRONG RUN" | "GOOD RUN" | "MIXED" | "TOUGH RUN";
  averageDifficulty: number;
  fixtures: Array<{
    eventId: number;
    name: string;
    opponent: string;
    opponentShort: string;
    homeAway: "H" | "A";
    difficulty: number;
  }>;
  topPlayers: Array<{
    id: number;
    name: string;
    position: string;
    price: number;
    score6: number;
    status: "BUY_NOW" | "WATCH" | "FUTURE_TARGET";
  }>;
};

export type ScoutIntelligencePayload = {
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
  dataRetrievedAt: string;
  freshness: "LIVE_FPL" | "CACHED_FALLBACK";
  horizonGameweeks: number;
  sourceVerification: ScoutSourceVerification[];
  picks: ScoutPlayerProfile[];
  undervalued: ScoutPlayerProfile[];
  players: ScoutPlayerProfile[];
  teams: ScoutTeamProfile[];
};

type FplElementHistory = {
  round: number;
  minutes: number;
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  saves: number;
  bonus: number;
  bps: number;
  expected_goals: string | number | null;
  expected_assists: string | number | null;
  expected_goal_involvements: string | number | null;
  expected_goals_conceded: string | number | null;
  defensive_contribution?: string | number | null;
};

type FplElementSummary = {
  history: FplElementHistory[];
};

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function bestRollingWindow(
  horizon: ScoutHorizonPoint[],
  size = 3,
) {
  if (!horizon.length) {
    return {
      startEventId: null,
      startName: "—",
      endName: "—",
      score: 0,
      index: 0,
    };
  }

  let best = {
    startEventId: horizon[0].eventId,
    startName: horizon[0].name,
    endName: horizon[Math.min(size - 1, horizon.length - 1)].name,
    score: average(horizon.slice(0, size).map((item) => item.score)),
    index: 0,
  };

  for (let index = 1; index < horizon.length; index += 1) {
    const window = horizon.slice(index, index + size);
    if (!window.length) continue;
    const score = average(window.map((item) => item.score));
    if (score > best.score) {
      best = {
        startEventId: window[0].eventId,
        startName: window[0].name,
        endName: window[window.length - 1].name,
        score,
        index,
      };
    }
  }

  return best;
}

function positionGoalPoints(position: string) {
  if (position === "GKP") return 10;
  if (position === "DEF") return 6;
  if (position === "MID") return 5;
  return 4;
}

function positionCleanSheetPoints(position: string) {
  if (position === "GKP" || position === "DEF") return 4;
  if (position === "MID") return 1;
  return 0;
}

function poissonProbability(lambda: number, goals: number) {
  let factorial = 1;
  for (let i = 2; i <= goals; i += 1) factorial *= i;
  return Math.exp(-lambda) * Math.pow(lambda, goals) / factorial;
}

function expectedGoalsConcededDeduction(lambda: number) {
  let expected = 0;
  for (let goals = 0; goals <= 10; goals += 1) {
    expected += Math.floor(goals / 2) * poissonProbability(lambda, goals);
  }
  return expected;
}

function expectedMinutesFallback(player: RankedPlayer) {
  if (player.starts > 0) {
    return clamp(
      (player.minutes / player.starts) * 0.72 +
        90 * player.startReliability * 0.28,
      25,
      90,
    );
  }
  return clamp(90 * player.startReliability, 20, 75);
}

function calculateBaseXP(
  player: RankedPlayer,
  process: Map<string, TeamProcess>,
  recentAverageMinutes: number | null,
) {
  const expectedMinutes = clamp(
    recentAverageMinutes ?? expectedMinutesFallback(player),
    0,
    90,
  );
  const minuteShare = expectedMinutes / 90;
  const probability60 = clamp((expectedMinutes - 30) / 30, 0, 1);
  const appearance = expectedMinutes <= 0 ? 0 : 1 + probability60;

  const goalPoints = positionGoalPoints(player.position);
  const expectedAttackPointsPer90 =
    player.xgPer90 * goalPoints + player.xaPer90 * 3;
  const attacking = expectedAttackPointsPer90 * minuteShare;

  const teamProcess = process.get(canonicalTeam(player.teamName));
  const opponentProcess = player.opponentName
    ? process.get(canonicalTeam(player.opponentName))
    : undefined;
  const baselineXga =
    (teamProcess?.metrics.npxga ?? 0) > 0
      ? teamProcess!.metrics.npxga
      : (teamProcess?.metrics.xga ?? 0) > 0
        ? teamProcess!.metrics.xga
        : Math.max(0.6, player.xgcPer90);
  const opponentAttack = opponentProcess?.attackIndex ?? 1;
  const ownDefence = teamProcess?.defenceIndex ?? 1;
  const fixtureXga = clamp(
    baselineXga *
      (opponentAttack / Math.max(0.72, ownDefence)) *
      (1 + (player.fixtureDifficulty - 3) * 0.10),
    0.25,
    3.5,
  );
  const cleanSheetProbability = Math.exp(-fixtureXga);
  const cleanSheet =
    positionCleanSheetPoints(player.position) *
    cleanSheetProbability *
    probability60;

  const conceded =
    player.position === "GKP" || player.position === "DEF"
      ? -expectedGoalsConcededDeduction(fixtureXga) * probability60
      : 0;

  const savesPer90 =
    player.position === "GKP" && player.minutes > 0
      ? (player.saves * 90) / player.minutes
      : 0;
  const saves =
    player.position === "GKP" ? (savesPer90 * minuteShare) / 3 : 0;

  const bonusPer90 =
    player.minutes > 0 ? (player.bonus * 90) / player.minutes : 0;
  const bonusReliability = clamp(player.minutes / 540, 0, 1);
  const bonus =
    clamp(
      bonusPer90 * bonusReliability +
        (player.xgiPer90 * 0.22 + cleanSheetProbability * 0.12) *
          (1 - bonusReliability),
      0,
      2.2,
    ) * minuteShare;

  const dcThreshold = player.position === "DEF" ? 10 : 12;
  const defensiveContribution =
    player.position === "GKP" || player.minutes <= 0
      ? 0
      : 2 /
        (1 +
          Math.exp(
            -(
              ((player.defensiveContribution * 90) / player.minutes) *
                minuteShare -
              dcThreshold
            ) /
              2.2,
          ));

  const fixtureCount = Math.max(0, player.fixtureCount);
  const singleFixtureXP =
    appearance +
    attacking +
    cleanSheet +
    conceded +
    saves +
    bonus +
    defensiveContribution;
  const baseXP = singleFixtureXP * fixtureCount;

  const actualAttackPointsPer90 =
    player.minutes > 0
      ? ((player.goalsScored * goalPoints + player.assists * 3) * 90) /
        player.minutes
      : 0;

  return {
    expectedMinutes,
    appearance,
    attacking: attacking * fixtureCount,
    cleanSheet: cleanSheet * fixtureCount,
    conceded: conceded * fixtureCount,
    saves: saves * fixtureCount,
    bonus: bonus * fixtureCount,
    defensiveContribution: defensiveContribution * fixtureCount,
    baseXP,
    actualAttackPointsPer90,
    expectedAttackPointsPer90,
    underperformanceGap:
      expectedAttackPointsPer90 - actualAttackPointsPer90,
  };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function recentMinutesForPlayers(playerIds: number[]) {
  const result = new Map<number, number | null>();
  const settled = await Promise.allSettled(
    playerIds.map(async (playerId) => {
      const summary = await fplFetch<FplElementSummary>(
        `element-summary/${playerId}/`,
        300,
      );
      const appearances = [...summary.history]
        .filter((item) => item.minutes > 0)
        .sort((a, b) => b.round - a.round)
        .slice(0, 5);
      const averageMinutes = appearances.length
        ? average(appearances.map((item) => item.minutes))
        : null;
      return [playerId, averageMinutes] as const;
    }),
  );

  settled.forEach((item, index) => {
    const playerId = playerIds[index];
    if (item.status === "fulfilled") {
      result.set(item.value[0], item.value[1]);
    } else {
      result.set(playerId, null);
    }
  });
  return result;
}

function replacementBaseline(
  profile: ScoutPlayerProfile,
  profiles: ScoutPlayerProfile[],
) {
  const player = profile.player;
  const eligible = (priceBand: number) =>
    profiles.filter(
      (candidate) =>
        candidate.player.id !== player.id &&
        candidate.player.position === player.position &&
        Math.abs(candidate.player.price - player.price) <= priceBand &&
        candidate.player.availability >= 75 &&
        candidate.player.startReliability >= 0.85 &&
        candidate.player.minutes >= 180,
    );

  let sample = eligible(0.5);
  if (sample.length < 4) sample = eligible(1.0);
  if (sample.length < 4) {
    sample = profiles.filter(
      (candidate) =>
        candidate.player.id !== player.id &&
        candidate.player.position === player.position &&
        candidate.player.availability >= 75 &&
        candidate.player.startReliability >= 0.85 &&
        candidate.player.price <= player.price + 0.5,
    );
  }

  return {
    value: median(sample.map((candidate) => candidate.epa.baseXP)),
    sample: sample.length,
  };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.ceil(sorted.length * p) - 1, 0, sorted.length - 1);
  return sorted[index];
}

function scoutReasons(
  player: RankedPlayer,
  process: TeamProcess | undefined,
  horizon: ScoutHorizonPoint[],
  bestWindow: ScoutPlayerProfile["bestWindow"],
  evidence: PlayerProcessEvidence | null,
) {
  const reasons: string[] = [];
  const firstThree = horizon.slice(0, 3);
  const firstSix = horizon.slice(0, 6);
  const avgFdr3 = average(firstThree.map((item) => item.difficulty));
  const avgFdr6 = average(firstSix.map((item) => item.difficulty));

  const involvement = evidence?.regressedXgiPer90 ?? player.xgiPer90;
  const involvementLabel = evidence?.priorAvailable
    ? "Role-adjusted underlying involvement"
    : "Underlying involvement";
  if (involvement >= 0.55) {
    reasons.push(
      `Strong ${involvementLabel.toLowerCase()}: ${involvement.toFixed(2)} xGI/90.`,
    );
  } else if (involvement >= 0.35) {
    reasons.push(
      `Useful ${involvementLabel.toLowerCase()}: ${involvement.toFixed(2)} xGI/90.`,
    );
  }

  if (player.setPieceRole) {
    reasons.push(`${player.setPieceRole} increases repeatable route-to-points.`);
  }

  if ((process?.attackTrend ?? 0) >= 0.05) {
    reasons.push(
      `${player.teamName} attacking process is improving (${(
        (process?.attackTrend ?? 0) * 100
      ).toFixed(0)}% recent trend).`,
    );
  }

  if (
    (player.position === "DEF" || player.position === "GKP") &&
    (process?.defenceTrend ?? 0) >= 0.05
  ) {
    reasons.push(
      `${player.teamName} defensive process is improving (${(
        (process?.defenceTrend ?? 0) * 100
      ).toFixed(0)}% recent trend).`,
    );
  }

  if (avgFdr3 > 0 && avgFdr3 <= 2.7) {
    reasons.push(`Strong immediate fixture run: average FDR ${avgFdr3.toFixed(1)} over 3 GWs.`);
  } else if (avgFdr6 > 0 && avgFdr6 <= 3.0) {
    reasons.push(`Good six-Gameweek runway: average FDR ${avgFdr6.toFixed(1)}.`);
  }

  if (bestWindow.index > 0) {
    reasons.push(
      `Best 3-GW window starts ${bestWindow.startName}; this is a timing opportunity, not necessarily a buy-now call.`,
    );
  }

  if (player.selectedBy < 10 && player.assistantScore > 0) {
    reasons.push(
      `Low ownership (${player.selectedBy.toFixed(1)}%) gives upside if the football case continues to hold.`,
    );
  }

  if (evidence && evidence.premierLeagueMinutes >= 180) {
    if (evidence.attackTrend >= 0.05) {
      reasons.push(
        `Recent player process is improving (${(evidence.attackTrend * 100).toFixed(0)}% regressed trend).`,
      );
    }
    if (evidence.chancesCreatedPer90 >= 2) {
      reasons.push(
        `Chance creation is holding: ${evidence.chancesCreatedPer90.toFixed(1)} chances created/90 recently.`,
      );
    }
    if (player.position === "GKP" && evidence.goalsPreventedPer90 >= 0.10) {
      reasons.push(
        `Goalkeeper shot-stopping is positive: +${evidence.goalsPreventedPer90.toFixed(2)} goals prevented/90 in the recent sample.`,
      );
    }
  }

  if (player.startReliability >= 0.95) {
    reasons.push("Strong starting reliability in the current sample.");
  }

  return reasons.slice(0, 4);
}

function scoutRisks(
  player: RankedPlayer,
  process: TeamProcess | undefined,
  horizon: ScoutHorizonPoint[],
  evidence: PlayerProcessEvidence | null,
) {
  const risks: string[] = [];
  const first = horizon[0];

  if (player.availability < 100) {
    risks.push(
      `Availability is ${player.availability}%; recheck official news before acting.`,
    );
  }
  if (player.startReliability < 0.9) {
    risks.push("Minutes/start security is not yet strong enough to treat as locked.");
  }
  if (first && first.difficulty >= 4) {
    risks.push(
      `Immediate fixture is difficult (${first.opponent ?? "opponent"}, FDR ${first.difficulty}).`,
    );
  }
  if ((process?.sourceConfidence ?? 1) < 0.7) {
    risks.push("Team-process source confidence is below Footy's preferred level.");
  }
  if (player.minutes < 270) {
    risks.push("Player per-90 data is still a small sample and is being regressed.");
  }
  if (
    evidence?.priorAvailable &&
    evidence.currentEvidenceWeight < 0.30
  ) {
    risks.push(
      `Only ${Math.round(evidence.currentEvidenceWeight * 100)}% of the role-adjusted process estimate comes from current-season evidence; the prior still carries most of the weight.`,
    );
  }
  if (evidence?.loadRisk != null && evidence.loadRisk >= 0.06) {
    risks.push(
      `Congestion/rotation watch: ${evidence.minutes7.toFixed(0)} minutes in 7 days, including ${evidence.nonLeagueMinutes14.toFixed(0)} non-league minutes in 14 days.`,
    );
  }
  if (
    evidence &&
    evidence.premierLeagueMinutes >= 180 &&
    evidence.attackTrend <= -0.08
  ) {
    risks.push(
      `Recent attacking process is cooling (${(evidence.attackTrend * 100).toFixed(0)}% regressed trend).`,
    );
  }
  if (evidence?.clubChangedSincePrior) {
    risks.push(
      "Prior-season process came at a different club, so role continuity is discounted.",
    );
  }
  if (evidence && evidence.sourceConfidence < 0.62) {
    risks.push("Player-match evidence is still too thin for a high-confidence role call.");
  }
  if (!risks.length) {
    risks.push("No major current blocker; still re-run close to deadline for news and role changes.");
  }

  return risks.slice(0, 3);
}

export async function getScoutIntelligence(): Promise<ScoutIntelligencePayload> {
  const [bootstrapSnapshot, fixturesSnapshot, process, playerProcesses] =
    await Promise.all([
      cachedFpl<Bootstrap>("bootstrap-static"),
      cachedFpl<Fixture[]>("fixtures"),
      footyProcesses(),
      footyPlayerProcesses(),
    ]);

  let bootstrap: Bootstrap | null = null;
  let fixtures: Fixture[] | null = null;
  let freshness: "LIVE_FPL" | "CACHED_FALLBACK" = "LIVE_FPL";
  let dataRetrievedAt = new Date().toISOString();

  try {
    const direct = await Promise.all([
      fplFetch<Bootstrap>("bootstrap-static/", 0),
      fplFetch<Fixture[]>("fixtures/", 0),
    ]);
    bootstrap = direct[0];
    fixtures = direct[1];
  } catch {
    bootstrap = bootstrapSnapshot?.payload ?? null;
    fixtures = fixturesSnapshot?.payload ?? null;
    freshness = "CACHED_FALLBACK";
    dataRetrievedAt =
      bootstrapSnapshot?.retrieved_at ??
      fixturesSnapshot?.retrieved_at ??
      dataRetrievedAt;
  }

  if (!bootstrap || !fixtures) {
    throw new Error("Scout intelligence is temporarily unavailable.");
  }

  const { current, next } = currentAndNext(bootstrap.events);
  const upcomingEvents = bootstrap.events
    .filter((event) => next && event.id >= next.id && !event.finished)
    .sort((a, b) => a.id - b.id)
    .slice(0, 8);

  const rankings = upcomingEvents.map((event) => ({
    event,
    players: rankPlayers(
      bootstrap!,
      fixtures!,
      event.id,
      process,
      false,
      true,
    ),
  }));
  const maps = rankings.map(({ event, players }) => ({
    event,
    byId: new Map(players.map((player) => [player.id, player])),
  }));

  const currentPlayers =
    rankings[0]?.players ??
    rankPlayers(
      bootstrap,
      fixtures,
      next?.id ?? current?.id ?? null,
      process,
      false,
      true,
    );

  const elementById = new Map(bootstrap.elements.map((item) => [item.id, item]));

  const profiles: ScoutPlayerProfile[] = currentPlayers.map((basePlayer) => {
    const teamId = elementById.get(basePlayer.id)?.team ?? 0;
    const horizon = maps.map(({ event, byId }) => {
      const ranked = byId.get(basePlayer.id) ?? basePlayer;
      const fixture = fixturesForTeam(teamId, event.id, fixtures!)[0];
      const isHome = fixture ? fixture.team_h === teamId : false;
      const opponentId = fixture
        ? isHome
          ? fixture.team_a
          : fixture.team_h
        : null;
      const opponentTeam = opponentId
        ? bootstrap!.teams.find((team) => team.id === opponentId)
        : null;

      return {
        eventId: event.id,
        name: event.name,
        opponent: ranked.opponent,
        opponentName: opponentTeam?.name ?? ranked.opponentName ?? null,
        homeAway: fixture ? (isHome ? "H" : "A") : "—",
        difficulty: ranked.fixtureDifficulty,
        score: ranked.assistantScore,
        fixtureFactor: ranked.fixtureFactor,
        processFactor: ranked.processFactor,
      } satisfies ScoutHorizonPoint;
    });

    const score3 = average(horizon.slice(0, 3).map((item) => item.score));
    const score6 = average(horizon.slice(0, 6).map((item) => item.score));
    const score8 = average(horizon.slice(0, 8).map((item) => item.score));
    const bestWindow = bestRollingWindow(horizon, 3);
    const processRow = process.get(canonicalTeam(basePlayer.teamName));
    const stableCode = elementById.get(basePlayer.id)?.code ?? null;
    const playerEvidence =
      stableCode != null ? playerProcesses.get(stableCode) ?? null : null;
    const firstDifficulty = horizon[0]?.difficulty ?? 5;

    let status: ScoutPlayerProfile["status"] = "WATCH";
    if (
      basePlayer.availability >= 75 &&
      basePlayer.startReliability >= 0.9 &&
      bestWindow.index === 0 &&
      firstDifficulty <= 3 &&
      score3 >= score6 * 0.94
    ) {
      status = "BUY_NOW";
    } else if (bestWindow.index >= 3) {
      status = "FUTURE_TARGET";
    }
    if (status === "BUY_NOW" && (playerEvidence?.loadRisk ?? 0) >= 0.08) {
      status = "WATCH";
    }

    const base = calculateBaseXP(basePlayer, process, null);
    const decisionConfidence: ScoutPlayerProfile["decisionConfidence"] =
      basePlayer.minutes < 180 ||
      (playerEvidence && playerEvidence.sourceConfidence < 0.62)
        ? "LOW"
        : basePlayer.availability >= 100 &&
            basePlayer.startReliability >= 0.9 &&
            (processRow?.sourceConfidence ?? 0.7) >= 0.7 &&
            playerEvidence != null &&
            playerEvidence.sourceConfidence >= 0.75 &&
            (
              playerEvidence.priorAvailable ||
              playerEvidence.premierLeagueMinutes >= 540
            )
          ? "HIGH"
          : "MEDIUM";

    return {
      player: basePlayer,
      horizon,
      score3,
      score6,
      score8,
      bestWindow,
      status,
      epa: {
        ...base,
        replacementXP: 0,
        replacementSample: 0,
        epa: 0,
        epaPerMillion: 0,
        recentAverageMinutes: null,
        volumeFloorPass: null,
        undervalued: false,
      },
      reasons: scoutReasons(
        basePlayer,
        processRow,
        horizon,
        bestWindow,
        playerEvidence,
      ),
      risks: scoutRisks(basePlayer, processRow, horizon, playerEvidence),
      coreSources: [
        "Official FPL live player/market data",
        "Footy canonical team-process layer (Understat + verified FPL-Core enrichment)",
        ...(playerEvidence
          ? [
              "FPL-Core player-match process and multi-competition workload",
              ...(playerEvidence.priorAvailable
                ? ["2025/26 Official-FPL player prior joined by stable player code"]
                : []),
            ]
          : []),
      ],
      evidence: playerEvidence,
      decisionConfidence,
    };
  });

  // Establish replacement-level xP by position and current price bracket.
  profiles.forEach((profile) => {
    const replacement = replacementBaseline(profile, profiles);
    profile.epa.replacementXP = replacement.value;
    profile.epa.replacementSample = replacement.sample;
    profile.epa.epa = profile.epa.baseXP - replacement.value;
    profile.epa.epaPerMillion =
      profile.player.price > 0 ? profile.epa.epa / profile.player.price : 0;
  });

  const pickScore = (profile: ScoutPlayerProfile) =>
    profile.bestWindow.score * 0.34 +
    profile.score6 * 0.30 +
    profile.score8 * 0.12 +
    profile.player.xgiPer90 * 1.25 +
    profile.player.valueScore * 0.16 +
    Math.max(-0.5, profile.epa.epa) * 0.30;

  const shortlist = profiles
    .filter(
      (profile) =>
        profile.player.availability >= 75 &&
        profile.player.startReliability >= 0.76 &&
        profile.horizon.some((item) => item.score > 0),
    )
    .sort((a, b) => pickScore(b) - pickScore(a))
    .slice(0, 36);

  // Strict undervalued classification needs real minutes from the player's
  // last five appearances. Only shortlist candidates trigger these live FPL
  // element-summary requests; the full database remains fast.
  const recentMinutes = await recentMinutesForPlayers(
    shortlist.map((profile) => profile.player.id),
  );

  shortlist.forEach((profile) => {
    const recentAverageMinutes =
      recentMinutes.get(profile.player.id) ?? null;
    const recalculated = calculateBaseXP(
      profile.player,
      process,
      recentAverageMinutes,
    );
    profile.epa = {
      ...profile.epa,
      ...recalculated,
      recentAverageMinutes,
      volumeFloorPass:
        recentAverageMinutes == null ? null : recentAverageMinutes >= 70,
    };
  });

  // Recalculate replacement levels after recent-minutes refinement.
  shortlist.forEach((profile) => {
    const replacement = replacementBaseline(profile, profiles);
    profile.epa.replacementXP = replacement.value;
    profile.epa.replacementSample = replacement.sample;
    profile.epa.epa = profile.epa.baseXP - replacement.value;
    profile.epa.epaPerMillion =
      profile.player.price > 0 ? profile.epa.epa / profile.player.price : 0;
  });

  const epaByPosition = new Map<string, number[]>();
  shortlist.forEach((profile) => {
    const group = epaByPosition.get(profile.player.position) ?? [];
    group.push(profile.epa.epaPerMillion);
    epaByPosition.set(profile.player.position, group);
  });

  shortlist.forEach((profile) => {
    const threshold = percentile(
      epaByPosition.get(profile.player.position) ?? [],
      0.65,
    );
    const processSupport =
      !profile.evidence ||
      profile.evidence.premierLeagueMinutes < 180 ||
      profile.evidence.attackTrend > -0.12;
    const workloadAcceptable =
      !profile.evidence || profile.evidence.loadRisk < 0.10;
    profile.epa.undervalued =
      profile.epa.underperformanceGap > 0.20 &&
      profile.epa.epa > 0.30 &&
      profile.epa.epaPerMillion >= threshold &&
      profile.epa.volumeFloorPass === true &&
      processSupport &&
      workloadAcceptable &&
      profile.decisionConfidence !== "LOW";
  });

  const picks = shortlist.slice(0, 24);
  const undervalued = [...shortlist]
    .filter((profile) => profile.epa.undervalued)
    .sort(
      (a, b) =>
        b.epa.epaPerMillion - a.epa.epaPerMillion ||
        b.epa.epa - a.epa.epa,
    )
    .slice(0, 16);

  const profileByTeam = new Map<string, ScoutPlayerProfile[]>();
  for (const profile of profiles) {
    const group = profileByTeam.get(profile.player.teamName) ?? [];
    group.push(profile);
    profileByTeam.set(profile.player.teamName, group);
  }

  const teams: ScoutTeamProfile[] = bootstrap.teams.map((team) => {
    const teamFixtures = upcomingEvents
      .map((event) => {
        const fixture = fixturesForTeam(team.id, event.id, fixtures!)[0];
        if (!fixture) return null;
        const isHome = fixture.team_h === team.id;
        const opponentId = isHome ? fixture.team_a : fixture.team_h;
        const opponent = bootstrap!.teams.find((item) => item.id === opponentId);
        return {
          eventId: event.id,
          name: event.name,
          opponent: opponent?.name ?? "—",
          opponentShort: opponent?.short_name ?? "—",
          homeAway: isHome ? ("H" as const) : ("A" as const),
          difficulty: isHome
            ? fixture.team_h_difficulty
            : fixture.team_a_difficulty,
        };
      })
      .filter(
        (
          item,
        ): item is {
          eventId: number;
          name: string;
          opponent: string;
          opponentShort: string;
          homeAway: "H" | "A";
          difficulty: number;
        } => Boolean(item),
      );

    const averageDifficulty = average(
      teamFixtures.slice(0, 6).map((item) => item.difficulty),
    );
    const processRow = process.get(canonicalTeam(team.name)) ?? null;
    const teamPlayers = [...(profileByTeam.get(team.name) ?? [])]
      .sort((a, b) => b.score6 - a.score6)
      .slice(0, 5)
      .map((profile) => ({
        id: profile.player.id,
        name: profile.player.name,
        position: profile.player.position,
        price: profile.player.price,
        score6: profile.score6,
        status: profile.status,
      }));

    let outlook: ScoutTeamProfile["outlook"] = "MIXED";
    if (averageDifficulty > 0 && averageDifficulty <= 2.6) {
      outlook = "STRONG RUN";
    } else if (averageDifficulty > 0 && averageDifficulty <= 3.1) {
      outlook = "GOOD RUN";
    } else if (averageDifficulty >= 3.8) {
      outlook = "TOUGH RUN";
    }

    return {
      teamId: team.id,
      team: team.name,
      shortName: team.short_name,
      process: processRow,
      outlook,
      averageDifficulty,
      fixtures: teamFixtures,
      topPlayers: teamPlayers,
    };
  });

  return {
    currentEvent: current,
    nextEvent: next,
    dataRetrievedAt,
    freshness,
    horizonGameweeks: upcomingEvents.length,
    sourceVerification: [
      {
        source: "Official FPL",
        status: "ACTIVE",
        provides:
          "Live prices, ownership, points, xG/xA/xGI/xGC, minutes, starts, availability, saves, bonus and defensive contribution.",
      },
      {
        source: "PremierLeague.com",
        status: "VERIFIED_REFERENCE",
        provides:
          "Current 2026/27 FPL scoring rules, defensive-contribution rules and official competition context.",
      },
      {
        source: "Understat via Footy canonical layer",
        status: "ACTIVE",
        provides:
          "Designated team xG/npxG and xGA/npxGA source plus PPDA, deep completions and shot-level set-piece xG.",
      },
      {
        source: "FPL-Core-Insights",
        status: "ACTIVE",
        provides:
          "Verified team enrichment plus player-match xA/xGOT, chances created, box/territory progression, goalkeeper post-shot data and cup/Europe workload.",
      },
      {
        source: "StatMuse",
        status: "CROSS_CHECK",
        provides:
          "Current-season xG/xA, shots, key passes and touches-in-box queries where available.",
      },
      {
        source: "Opta Analyst",
        status: "CROSS_CHECK",
        provides:
          "Opta-powered player projections and published advanced-data analysis; direct Opta feed remains licensed-only.",
      },
      {
        source: "SofaScore",
        status: "AVAILABLE_NOT_ACTIVE",
        provides:
          "Current matches, standings and player/team statistics; adapter exists but is not yet production consensus.",
      },
      {
        source: "Sky Sports",
        status: "CROSS_CHECK",
        provides:
          "Live league context, results, scoring tables, team news and editorial statistical context.",
      },
      {
        source: "Opta / Stats Perform direct",
        status: "LICENSED_ONLY",
        provides:
          "Granular event data only when a legitimate licensed feed is configured.",
      },
    ],
    picks,
    undervalued,
    players: profiles.sort((a, b) => b.score6 - a.score6),
    teams: teams.sort((a, b) => {
      const aStrength =
        Math.max(a.process?.attackIndex ?? 1, a.process?.defenceIndex ?? 1) -
        a.averageDifficulty * 0.03;
      const bStrength =
        Math.max(b.process?.attackIndex ?? 1, b.process?.defenceIndex ?? 1) -
        b.averageDifficulty * 0.03;
      return bStrength - aStrength;
    }),
  };
}

type EntryHistoryGameweek = {
  event: number;
  points: number;
  total_points: number;
  overall_rank: number | null;
  bank: number;
  value: number;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

type EntryChipUse = {
  name: string;
  event: number;
  time: string;
};

type EntryHistoryResponse = {
  current: EntryHistoryGameweek[];
  chips: EntryChipUse[];
};

type EntryTransfer = {
  element_in: number;
  element_out: number;
  element_in_cost: number;
  element_out_cost: number;
  event: number;
  time: string;
};

export type RivalResourceHistory = {
  entryId: number;
  currentEvent: number;
  chips: Array<{
    code: string;
    label: string;
    event: number;
    half: 1 | 2;
    time: string;
  }>;
  currentHalf: 1 | 2;
  currentHalfRemaining: string[];
  secondHalfRemaining: string[];
  totalTransfers: number;
  totalHitCost: number;
  hitGameweeks: number;
  recentTransfers: number;
  recentHitCost: number;
  activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT";
  estimatedFreeTransfers: number;
  freeTransferEstimateEvent: number;
  freeTransferConfidence: "HIGH" | "MEDIUM";
  transferLog: EntryTransfer[];
  gameweeks: EntryHistoryGameweek[];
};

function estimateFreeTransfers(
  gameweeks: EntryHistoryGameweek[],
  chips: EntryChipUse[],
) {
  const sorted = [...gameweeks].sort((a, b) => a.event - b.event);
  if (!sorted.length) {
    return { freeTransfers: 1, event: 1, confidence: "MEDIUM" as const };
  }

  // Before a manager's first deadline transfers are unlimited. The following
  // Gameweek starts with one FT. We then replay completed public history.
  let available = 1;
  const firstEvent = sorted[0].event;
  const chipByEvent = new Map(
    chips.map((chip) => [chip.event, chip.name]),
  );

  for (const gw of sorted) {
    if (gw.event === firstEvent) continue;

    const chip = chipByEvent.get(gw.event);
    if (chip === "wildcard" || chip === "freehit") {
      // Current FPL rules preserve the pre-existing FT bank across WC/FH.
      // The newly granted FT for that chip Gameweek is consumed by the chip,
      // leaving the next Gameweek with the same available count.
      available = Math.max(1, Math.min(5, available));
      continue;
    }

    const paidTransfers = Math.max(
      0,
      Math.floor(Number(gw.event_transfers_cost || 0) / 4),
    );
    const freeUsed = Math.max(
      0,
      Number(gw.event_transfers || 0) - paidTransfers,
    );
    available = Math.min(
      5,
      Math.max(0, available - Math.min(available, freeUsed)) + 1,
    );
  }

  return {
    freeTransfers: available,
    event: (sorted.at(-1)?.event ?? firstEvent) + 1,
    confidence: "HIGH" as const,
  };
}

const CHIP_LABELS: Record<string, string> = {
  wildcard: "Wildcard",
  bboost: "Bench Boost",
  freehit: "Free Hit",
  "3xc": "Triple Captain",
};

export async function getRivalResourceHistory(
  entryId: number,
): Promise<RivalResourceHistory> {
  const [history, transfers] = await Promise.all([
    fplFetch<EntryHistoryResponse>(`entry/${entryId}/history/`, 300),
    fplFetch<EntryTransfer[]>(`entry/${entryId}/transfers/`, 300),
  ]);

  const gameweeks = [...(history.current ?? [])].sort(
    (a, b) => a.event - b.event,
  );
  const currentEvent = gameweeks.at(-1)?.event ?? 1;
  const currentHalf: 1 | 2 = currentEvent <= 19 ? 1 : 2;

  const chips = (history.chips ?? [])
    .map((chip) => ({
      code: chip.name,
      label: CHIP_LABELS[chip.name] ?? chip.name,
      event: chip.event,
      half: (chip.event <= 19 ? 1 : 2) as 1 | 2,
      time: chip.time,
    }))
    .sort((a, b) => a.event - b.event);

  const allChipLabels = [
    "Wildcard",
    "Free Hit",
    "Triple Captain",
    "Bench Boost",
  ];
  const usedCurrentHalf = new Set(
    chips.filter((chip) => chip.half === currentHalf).map((chip) => chip.label),
  );
  const usedSecondHalf = new Set(
    chips.filter((chip) => chip.half === 2).map((chip) => chip.label),
  );

  const recentGameweeks = gameweeks.slice(-4);
  const totalTransfers = gameweeks.reduce(
    (sum, item) => sum + Number(item.event_transfers || 0),
    0,
  );
  const totalHitCost = gameweeks.reduce(
    (sum, item) => sum + Number(item.event_transfers_cost || 0),
    0,
  );
  const hitGameweeks = gameweeks.filter(
    (item) => Number(item.event_transfers_cost || 0) > 0,
  ).length;
  const recentTransfers = recentGameweeks.reduce(
    (sum, item) => sum + Number(item.event_transfers || 0),
    0,
  );
  const recentHitCost = recentGameweeks.reduce(
    (sum, item) => sum + Number(item.event_transfers_cost || 0),
    0,
  );

  const freeTransferEstimate = estimateFreeTransfers(
    gameweeks,
    history.chips ?? [],
  );

  const activity =
    recentHitCost >= 8 || recentTransfers >= 7
      ? "AGGRESSIVE"
      : recentTransfers >= 4
        ? "ACTIVE"
        : "PATIENT";

  return {
    entryId,
    currentEvent,
    chips,
    currentHalf,
    currentHalfRemaining: allChipLabels.filter(
      (label) => !usedCurrentHalf.has(label),
    ),
    secondHalfRemaining: allChipLabels.filter(
      (label) => !usedSecondHalf.has(label),
    ),
    totalTransfers,
    totalHitCost,
    hitGameweeks,
    recentTransfers,
    recentHitCost,
    activity,
    estimatedFreeTransfers: freeTransferEstimate.freeTransfers,
    freeTransferEstimateEvent: freeTransferEstimate.event,
    freeTransferConfidence: freeTransferEstimate.confidence,
    transferLog: [...(transfers ?? [])]
      .filter((transfer) => Number(transfer.event) <= currentEvent)
      .sort(
        (a, b) =>
          new Date(b.time).getTime() - new Date(a.time).getTime(),
      )
      .slice(0, 12),
    gameweeks,
  };
}
