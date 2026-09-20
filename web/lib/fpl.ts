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
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  form: string;
  selected_by_percent: string;
  points_per_game: string;
  ep_next: string | null;
  chance_of_playing_next_round: number | null;
  status: string;
  minutes: number;
  expected_goal_involvements: string;
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
  xga: number | string | null;
  shots: number | string | null;
  shots_on_target: number | string | null;
  shots_conceded: number | string | null;
  sot_conceded: number | string | null;
  set_piece_xg: number | string | null;
  set_piece_xga: number | string | null;
  ppda: number | string | null;
  deep_completions: number | string | null;
};

export type TeamProcess = {
  team: string;
  matches: number;
  attackIndex: number;
  defenceIndex: number;
};

export type RankedPlayer = {
  id: number;
  name: string;
  team: string;
  position: string;
  price: number;
  form: number;
  expectedNext: number;
  assistantScore: number;
  fixtureDifficulty: number;
  availability: number;
  xgiPer90: number;
  selectedBy: number;
  transfersNet: number;
  valueScore: number;
  processBoost: number;
  teamAttackIndex: number;
  teamDefenceIndex: number;
  opponent: string | null;
  fixtureCount: number;
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

function buildTeamProcess(matches: MatchRow[], metrics: MetricRow[]) {
  const dateByMatch = new Map(
    matches.map((match) => [match.match_id, new Date(match.kickoff_at).getTime()]),
  );
  const usable = metrics
    .filter((row) => dateByMatch.has(row.match_id))
    .sort((a, b) => (dateByMatch.get(a.match_id) ?? 0) - (dateByMatch.get(b.match_id) ?? 0));

  const fields = [
    "xg",
    "xga",
    "shots",
    "shots_on_target",
    "shots_conceded",
    "sot_conceded",
    "set_piece_xg",
    "set_piece_xga",
    "ppda",
    "deep_completions",
  ] as const;

  const league: Record<string, number> = {};
  for (const field of fields) {
    const values = usable.map((row) => num(row[field])).filter((value) => value > 0);
    league[field] = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 1;
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
      const observed = weightedAverage(last.map((row) => num(row[field])));
      return observed * regression + league[field] * (1 - regression);
    };
    const ratio = (field: (typeof fields)[number]) =>
      league[field] > 0 ? avg(field) / league[field] : 1;
    const inverseRatio = (field: (typeof fields)[number]) =>
      avg(field) > 0 ? league[field] / avg(field) : 1;

    const attack =
      ratio("xg") * 0.42 +
      ratio("shots_on_target") * 0.18 +
      ratio("shots") * 0.10 +
      ratio("set_piece_xg") * 0.10 +
      ratio("deep_completions") * 0.10 +
      inverseRatio("ppda") * 0.10;

    const defence =
      inverseRatio("xga") * 0.50 +
      inverseRatio("sot_conceded") * 0.20 +
      inverseRatio("shots_conceded") * 0.15 +
      inverseRatio("set_piece_xga") * 0.15;

    output.set(key, {
      team: rows[rows.length - 1]?.team ?? key,
      matches: n,
      attackIndex: clamp(attack, 0.78, 1.28),
      defenceIndex: clamp(defence, 0.78, 1.28),
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
    `footy_match_team_metrics?select=match_id,team,opponent,xg,xga,shots,shots_on_target,shots_conceded,sot_conceded,set_piece_xg,set_piece_xga,ppda,deep_completions&match_id=in.(${encodeURIComponent(ids)})`,
  );
  return buildTeamProcess(matches, metrics);
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

function xgiPer90(player: FplPlayer) {
  if (player.minutes <= 0) return 0;
  const raw = (num(player.expected_goal_involvements) * 90) / player.minutes;
  // Per-90 rates are unstable in tiny samples. Shrink toward zero until
  // roughly four full matches of minutes and cap extreme early-season rates.
  const reliability = clamp(player.minutes / 360, 0, 1);
  return clamp(raw, 0, 1.2) * reliability;
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
        return position === "GKP" || position === "DEF"
          ? defenceMatchup
          : attackMatchup;
      });

      const processFactor = matchupFactors.length
        ? matchupFactors.reduce((sum, value) => sum + value, 0) /
          matchupFactors.length
        : 0.72;
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

      const opponent = teamFixtures
        .map((fixture) => {
          const opponentId =
            fixture.team_h === player.team
              ? fixture.team_a
              : fixture.team_h;
          return teams.get(opponentId)?.short_name ?? "—";
        })
        .join(" + ");

      const officialBase = useExpectedNext
        ? ep * 0.68 + form * 0.16 + ppg * 0.10 + xgi90 * 0.60
        : form * 0.34 + ppg * 0.46 + xgi90 * 0.85;

      const fixtureMultiplier =
        teamFixtures.length === 0
          ? 0
          : teamFixtures.length === 1
            ? 1
            : 1 + 0.72 * (teamFixtures.length - 1);

      const score =
        officialBase *
        (1 + processBoost * 0.32) *
        fixtureMultiplier *
        clamp(available / 100, 0, 1);

      return {
        id: player.id,
        name: player.web_name,
        team: team?.short_name ?? "—",
        position,
        price,
        form,
        expectedNext: useExpectedNext ? ep : score,
        assistantScore: score,
        fixtureDifficulty: difficulty,
        availability: available,
        xgiPer90: xgi90,
        selectedBy: num(player.selected_by_percent),
        transfersNet:
          player.transfers_in_event - player.transfers_out_event,
        valueScore: price > 0 ? score / price : 0,
        processBoost,
        teamAttackIndex: teamProcess?.attackIndex ?? 1,
        teamDefenceIndex: teamProcess?.defenceIndex ?? 1,
        opponent: opponent || null,
        fixtureCount: teamFixtures.length,
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

async function analyseTeam(
  entryId: number,
  current: FplEvent | null,
  ranked: RankedPlayer[],
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
  const weakLinks = [...squad]
    .sort((a, b) => a.assistantScore - b.assistantScore)
    .slice(0, 4)
    .map((player) => {
      const budget = player.price + bank;
      const replacement =
        ranked.find((candidate) => {
          if (candidate.position !== player.position) return false;
          if (squadIds.has(candidate.id)) return false;
          if (candidate.price > budget) return false;
          if (candidate.assistantScore <= player.assistantScore * 1.08) return false;
          const afterRemoval =
            (teamCounts.get(candidate.team) ?? 0) -
            (candidate.team === player.team ? 1 : 0);
          return afterRemoval < 3;
        }) ?? null;

      const reason = replacement
        ? `${replacement.name} has a ${((replacement.assistantScore / Math.max(player.assistantScore, 0.01) - 1) * 100).toFixed(0)}% higher assistant score and fits the £${budget.toFixed(1)}m budget.`
        : "No clear same-position upgrade clears the current model threshold.";

      return { player, replacement, reason };
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
};

export async function getLeagueManagerEdgeAnalysis(
  entryId: number,
  rivalEntryId?: number | null,
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

  const [manager, rival] = await Promise.all([
    analyseTeam(entryId, current, ranked),
    rivalEntryId && Number.isInteger(rivalEntryId) && rivalEntryId > 0
      ? analyseTeam(rivalEntryId, current, ranked)
      : Promise.resolve(null),
  ]);

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

  const playerTrends = [...ranked]
    .map((player) => {
      const transferMomentum =
        Math.sign(player.transfersNet) *
        Math.log1p(Math.abs(player.transfersNet)) /
        10;
      const trendScore =
        player.form * 0.5 +
        player.xgiPer90 * 2 +
        player.processBoost * 4 +
        transferMomentum * 0.6;
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
  transferLog: EntryTransfer[];
  gameweeks: EntryHistoryGameweek[];
};

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
    transferLog: [...(transfers ?? [])]
      .sort(
        (a, b) =>
          new Date(b.time).getTime() - new Date(a.time).getTime(),
      )
      .slice(0, 12),
    gameweeks,
  };
}
