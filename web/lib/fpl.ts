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
    headers: { Accept: "application/json", "User-Agent": "Footy-FPL/1.0" },
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

function fixtureForTeam(teamId: number, eventId: number | null, fixtures: Fixture[]) {
  if (!eventId) return null;
  return (
    fixtures.find(
      (fixture) =>
        fixture.event === eventId &&
        (fixture.team_h === teamId || fixture.team_a === teamId),
    ) ?? null
  );
}

function availability(player: FplPlayer) {
  if (player.status === "u" || player.status === "s") return 0;
  return player.chance_of_playing_next_round ?? 100;
}

function xgiPer90(player: FplPlayer) {
  return player.minutes > 0
    ? (num(player.expected_goal_involvements) * 90) / player.minutes
    : 0;
}

function rankPlayers(
  bootstrap: Bootstrap,
  fixtures: Fixture[],
  eventId: number | null,
  process: Map<string, TeamProcess>,
): RankedPlayer[] {
  const teams = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const positions = new Map(
    bootstrap.element_types.map((item) => [item.id, item.singular_name_short]),
  );

  return bootstrap.elements
    .map((player) => {
      const team = teams.get(player.team);
      const fixture = fixtureForTeam(player.team, eventId, fixtures);
      const isHome = fixture ? fixture.team_h === player.team : false;
      const opponentId = fixture
        ? isHome
          ? fixture.team_a
          : fixture.team_h
        : null;
      const opponentTeam = opponentId ? teams.get(opponentId) : null;
      const teamProcess = team ? process.get(canonicalTeam(team.name)) : undefined;
      const opponentProcess = opponentTeam
        ? process.get(canonicalTeam(opponentTeam.name))
        : undefined;

      const difficulty = fixture
        ? isHome
          ? fixture.team_h_difficulty
          : fixture.team_a_difficulty
        : 3;
      const available = availability(player);
      const position = positions.get(player.element_type) ?? "—";
      const price = player.now_cost / 10;
      const ep = Math.max(0, num(player.ep_next));
      const form = Math.max(0, num(player.form));
      const xgi90 = Math.max(0, xgiPer90(player));

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
      const processFactor =
        position === "GKP" || position === "DEF"
          ? defenceMatchup
          : attackMatchup;
      const processBoost = processFactor - 1;

      // Official FPL expected points remain the anchor. Footy's process layer
      // is deliberately a modest modifier to avoid double-counting FDR.
      const officialBase = ep * 0.74 + form * 0.18 + xgi90 * 1.05;
      const score =
        officialBase *
        (1 + processBoost * 0.32) *
        clamp(available / 100, 0, 1);

      return {
        id: player.id,
        name: player.web_name,
        team: team?.short_name ?? "—",
        position,
        price,
        form,
        expectedNext: ep,
        assistantScore: score,
        fixtureDifficulty: difficulty,
        availability: available,
        xgiPer90: xgi90,
        selectedBy: num(player.selected_by_percent),
        transfersNet: player.transfers_in_event - player.transfers_out_event,
        valueScore: price > 0 ? score / price : 0,
        processBoost,
        teamAttackIndex: teamProcess?.attackIndex ?? 1,
        teamDefenceIndex: teamProcess?.defenceIndex ?? 1,
        opponent: opponentTeam?.short_name ?? null,
      } satisfies RankedPlayer;
    })
    .filter((player) => player.availability > 0)
    .sort((a, b) => b.assistantScore - a.assistantScore);
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
  const [bootstrap, fixtures, process] = await Promise.all([
    fplFetch<Bootstrap>("bootstrap-static/"),
    fplFetch<Fixture[]>("fixtures/"),
    footyProcesses(),
  ]);
  const { current, next } = currentAndNext(bootstrap.events);
  const ranked = rankPlayers(bootstrap, fixtures, next?.id ?? current?.id ?? null, process);

  let teamAnalysis: TeamAnalysis | null = null;
  let teamError: string | null = null;
  if (teamId && Number.isInteger(teamId) && teamId > 0) {
    try {
      teamAnalysis = await analyseTeam(teamId, current, ranked);
    } catch {
      teamError =
        "We could not load that FPL Team ID. Check the number from your public FPL team URL and try again.";
    }
  }

  const captains = ranked
    .filter((player) => player.availability >= 75 && player.expectedNext > 0)
    .slice(0, 8);
  const transfers = [...ranked]
    .filter((player) => player.availability >= 75 && player.expectedNext > 0)
    .sort(
      (a, b) =>
        b.assistantScore + b.valueScore * 1.4 - (a.assistantScore + a.valueScore * 1.4),
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
  };
}
