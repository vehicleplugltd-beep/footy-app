const FPL_BASE = "https://fantasy.premierleague.com/api";

export type FplClassicLeague = {
  id: number;
  name: string;
  short_name: string | null;
  created: string;
  closed: boolean;
  rank: number | null;
  max_entries: number | null;
  league_type: string;
  scoring: string;
  admin_entry: number | null;
  start_event: number;
  entry_rank: number | null;
  entry_last_rank: number | null;
};

type FplEntryResponse = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  player_region_name?: string | null;
  summary_overall_points: number;
  summary_overall_rank: number | null;
  summary_event_points: number | null;
  current_event: number;
  last_deadline_bank: number;
  last_deadline_value: number;
  leagues?: { classic?: FplClassicLeague[] };
};

type FplEvent = { id: number; is_current: boolean; finished: boolean };
type FplElement = {
  id: number;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  form: string;
  selected_by_percent: string;
  status: string;
  chance_of_playing_next_round: number | null;
  transfers_in_event: number;
  transfers_out_event: number;
};
type FplTeam = { id: number; name: string; short_name: string };
type FplElementType = { id: number; singular_name_short: string };
type Bootstrap = {
  events: FplEvent[];
  elements: FplElement[];
  teams: FplTeam[];
  element_types: FplElementType[];
};
type Pick = {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
};
type PicksResponse = { picks: Pick[]; active_chip: string | null };

export type FplPitchPlayer = {
  id: number;
  name: string;
  team: string;
  position: string;
  price: number;
  form: number;
  selectedBy: number;
  transfersNet: number;
  availability: number;
  status: string;
  slot: number;
  starter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type FplTeamDiscovery = {
  id: number;
  teamName: string;
  managerName: string;
  region: string | null;
  overallPoints: number;
  overallRank: number | null;
  eventPoints: number | null;
  currentEvent: number;
  squadValue: number;
  bank: number;
  activeChip: string | null;
  squad: FplPitchPlayer[];
  miniLeagues: FplClassicLeague[];
  otherClassicLeagues: FplClassicLeague[];
  retrievedAt: string;
};

function num(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fplFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${FPL_BASE}/${path}`, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Referer: "https://fantasy.premierleague.com/",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    cache: "no-store",
  });
  if (response.status === 404) throw new Error("That FPL Team ID was not found.");
  if (!response.ok) throw new Error(`FPL request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function getFplTeamDiscovery(entryId: number): Promise<FplTeamDiscovery> {
  if (!Number.isInteger(entryId) || entryId <= 0) throw new Error("A valid FPL Team ID is required.");

  const [entry, bootstrap] = await Promise.all([
    fplFetch<FplEntryResponse>(`entry/${entryId}/`),
    fplFetch<Bootstrap>("bootstrap-static/"),
  ]);

  const currentEvent =
    entry.current_event ||
    bootstrap.events.find((event) => event.is_current)?.id ||
    [...bootstrap.events].filter((event) => event.finished).sort((a, b) => b.id - a.id)[0]?.id ||
    1;

  let picks: PicksResponse = { picks: [], active_chip: null };
  try {
    picks = await fplFetch<PicksResponse>(`entry/${entryId}/event/${currentEvent}/picks/`);
  } catch {}

  const teams = new Map(bootstrap.teams.map((team) => [team.id, team]));
  const positions = new Map(bootstrap.element_types.map((position) => [position.id, position.singular_name_short]));
  const elements = new Map(bootstrap.elements.map((element) => [element.id, element]));

  const squad = picks.picks
    .map((pick) => {
      const player = elements.get(pick.element);
      if (!player) return null;
      const chance =
        player.status === "u" || player.status === "s"
          ? 0
          : player.chance_of_playing_next_round ?? 100;

      return {
        id: player.id,
        name: player.web_name,
        team: teams.get(player.team)?.short_name ?? "—",
        position: positions.get(player.element_type) ?? "—",
        price: player.now_cost / 10,
        form: num(player.form),
        selectedBy: num(player.selected_by_percent),
        transfersNet: player.transfers_in_event - player.transfers_out_event,
        availability: chance,
        status: player.status,
        slot: pick.position,
        starter: pick.position <= 11,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
      } satisfies FplPitchPlayer;
    })
    .filter((player): player is FplPitchPlayer => Boolean(player))
    .sort((a, b) => a.slot - b.slot);

  const classic = (entry.leagues?.classic ?? []).filter((league) => league.scoring === "c");
  const miniLeagues = classic
    .filter((league) => league.league_type === "x")
    .sort((a, b) => (a.entry_rank ?? 9999999) - (b.entry_rank ?? 9999999) || a.name.localeCompare(b.name));
  const otherClassicLeagues = classic
    .filter((league) => league.league_type !== "x")
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    id: entry.id,
    teamName: entry.name,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    region: entry.player_region_name ?? null,
    overallPoints: entry.summary_overall_points,
    overallRank: entry.summary_overall_rank,
    eventPoints: entry.summary_event_points,
    currentEvent,
    squadValue: entry.last_deadline_value / 10,
    bank: entry.last_deadline_bank / 10,
    activeChip: picks.active_chip ?? null,
    squad,
    miniLeagues,
    otherClassicLeagues,
    retrievedAt: new Date().toISOString(),
  };
}
