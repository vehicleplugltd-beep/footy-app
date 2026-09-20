type SnapshotRow = {
  snapshot_key: string;
  retrieved_at: string;
  payload: unknown;
};

type MatchRow = {
  match_id: string;
  kickoff_at: string;
  status: string | null;
};

type MetricRow = Record<string, unknown> & {
  match_id: string;
  team: string;
  source: string | null;
  retrieved_at: string | null;
};

type LeagueRow = {
  league_id: number;
  last_synced_at: string | null;
  last_deep_synced_at: string | null;
  sync_status: string;
};

type ManagerRow = {
  team: string;
  manager_name: string;
  appointed_at: string;
  source: string;
  retrieved_at: string;
};

type PlayerMetricHealthRow = {
  player_id: number;
  competition: string;
  kickoff_at: string | null;
  retrieved_at: string | null;
  verified: boolean;
  verification_status: string | null;
};

type PlayerPriorHealthRow = {
  player_code: number;
  minutes: number | string | null;
  retrieved_at: string | null;
  verification_status: string | null;
};

export type DataHealthStatus =
  | "LIVE"
  | "FRESH"
  | "AGING"
  | "STALE"
  | "INCOMPLETE"
  | "MISSING";

export type FootyDataHealth = {
  generatedAt: string;
  families: Array<{
    id: string;
    label: string;
    status: DataHealthStatus;
    source: string;
    retrievedAt: string | null;
    target: string;
    coverage: string;
    supports: string[];
    caveats: string[];
  }>;
  processMetrics: Array<{
    metric: string;
    status: "AVAILABLE" | "PARTIAL" | "MISSING";
    coverage: number;
    source: string;
    supports: string;
  }>;
  priorities: Array<{
    priority: "P0" | "P1" | "P2";
    item: string;
    reason: string;
  }>;
};

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";
const CURRENT_SEASON = "2627";

function config() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  return key ? { key, url } : null;
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
  if (!response.ok) return [];
  return response.json() as Promise<T[]>;
}

function ageMinutes(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ms) / 60000;
}

function newest(values: Array<string | null | undefined>) {
  const times = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  return times[0]?.value ?? null;
}

function canonicalCoverage(rows: MetricRow[], key: string) {
  if (!rows.length) return 0;
  const identities = new Map<string, boolean>();
  for (const row of rows) {
    const identity = `${row.match_id}::${row.team}`;
    const present = row[key] !== null && row[key] !== undefined;
    identities.set(identity, (identities.get(identity) ?? false) || present);
  }
  if (!identities.size) return 0;
  return (
    [...identities.values()].filter(Boolean).length /
    identities.size
  );
}

const PROCESS_METRICS = [
  ["xg", "Chance quality", "Attack strength / finishing regression"],
  ["npxg", "Non-penalty chance quality", "Attack strength without penalty noise"],
  ["xga", "Expected goals against", "Defensive process"],
  ["npxga", "Non-penalty xGA", "Defensive process without penalty noise"],
  ["shots", "Shot volume", "Chance-volume floor"],
  ["shots_on_target", "Shots on target", "Shot-quality / goalkeeper exposure"],
  ["shots_conceded", "Shots conceded", "Defensive volume"],
  ["sot_conceded", "SOT conceded", "Defensive shot-quality exposure"],
  ["set_piece_xg", "Set-piece xG", "Set-piece attacking mismatch"],
  ["set_piece_xga", "Set-piece xGA", "Set-piece defensive mismatch"],
  ["ppda", "PPDA", "Pressing intensity"],
  ["deep_completions", "Deep completions", "Territory / final-third access"],
  ["final_third_passes", "Final-third passes", "Territorial progression proxy"],
  ["territory_proxy", "Territory proxy", "Opposition-half territorial share"],
  ["big_chances", "Big chances", "High-quality chance volume"],
  ["big_chances_conceded", "Big chances conceded", "Defensive high-quality chances"],
  ["box_touches", "Box touches", "Penalty-area occupation"],
  ["key_passes", "Key passes", "Chance creation"],
  ["xa", "Expected assists", "Chance creation quality"],
  ["possession", "Possession", "Territorial control context"],
  ["field_tilt", "Field tilt", "Territorial dominance"],
  ["xgot", "xGOT / post-shot xG", "Finishing quality"],
  ["xgot_faced", "xGOT faced / post-shot xG", "Goalkeeper shot-stopping exposure"],
  ["goals_prevented", "Goals prevented", "Goalkeeper over/under-performance"],
  ["crosses", "Crosses", "Wide-play matchup"],
  ["transition_events", "Transition events", "Counterattack / rest-defence matchup"],
  ["defensive_errors", "Defensive errors", "Error-prone opponent targeting"],
] as const;

export async function getFootyDataHealth(): Promise<FootyDataHealth> {
  const [snapshots, matches, leagues, managers, playerMetrics, playerPriors] = await Promise.all([
    rest<SnapshotRow>(
      "footy_fpl_snapshots?select=snapshot_key,retrieved_at,payload&order=retrieved_at.desc",
    ),
    rest<MatchRow>(
      `footy_matches?select=match_id,kickoff_at,status&league=eq.ENG-Premier%20League&season=eq.${CURRENT_SEASON}&order=kickoff_at.asc`,
    ),
    rest<LeagueRow>(
      "footy_fpl_leagues?select=league_id,last_synced_at,last_deep_synced_at,sync_status",
    ),
    rest<ManagerRow>(
      "footy_team_managers?select=team,manager_name,appointed_at,source,retrieved_at&league=eq.ENG-Premier%20League&active=eq.true",
    ),
    rest<PlayerMetricHealthRow>(
      `footy_player_match_metrics?select=player_id,competition,kickoff_at,retrieved_at,verified,verification_status&season=eq.${CURRENT_SEASON}&verified=eq.true&order=kickoff_at.asc`,
    ),
    rest<PlayerPriorHealthRow>(
      "footy_player_season_priors?select=player_code,minutes,retrieved_at,verification_status&season=eq.2526&verified=eq.true",
    ),
  ]);

  const ids = matches.map((match) => `"${match.match_id}"`).join(",");
  const metrics = ids
    ? await rest<MetricRow>(
        `footy_match_team_metrics?select=*&verified=eq.true&match_id=in.(${encodeURIComponent(ids)})`,
      )
    : [];

  const bootstrap = snapshots.find((row) => row.snapshot_key === "bootstrap-static");
  const fixtures = snapshots.find((row) => row.snapshot_key === "fixtures");
  const events =
    bootstrap &&
    typeof bootstrap.payload === "object" &&
    bootstrap.payload &&
    "events" in bootstrap.payload &&
    Array.isArray((bootstrap.payload as { events?: unknown[] }).events)
      ? ((bootstrap.payload as { events: Array<Record<string, unknown>> }).events ?? [])
      : [];
  const currentEvent =
    events.find((event) => event.is_current === true) ??
    events
      .filter((event) => event.finished !== true)
      .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))[0] ??
    null;
  const currentEventId =
    currentEvent && Number.isFinite(Number(currentEvent.id))
      ? Number(currentEvent.id)
      : null;
  const liveSnapshot = currentEventId
    ? snapshots.find((row) => row.snapshot_key === `event-live-${currentEventId}`)
    : null;

  const fplRetrievedAt = newest([
    bootstrap?.retrieved_at,
    fixtures?.retrieved_at,
  ]);
  const fplAge = ageMinutes(fplRetrievedAt);
  const liveAge = ageMinutes(liveSnapshot?.retrieved_at);
  const processRetrievedAt = newest(metrics.map((row) => row.retrieved_at));
  const latestProcessMatchId = metrics.length
    ? metrics
        .map((row) => row.match_id)
        .filter(Boolean)
        .at(-1) ?? null
    : null;
  const coveredIds = new Set(metrics.map((row) => row.match_id));
  // Process feeds are post-match evidence. Do not mark an in-play or future
  // fixture as a data-quality failure simply because its underlying metrics
  // do not exist yet.
  const finishedMatches = matches.filter(
    (match) => String(match.status ?? "").toLowerCase() === "finished",
  );
  const uncoveredMatches = finishedMatches.filter(
    (match) => !coveredIds.has(match.match_id),
  );
  const latestLeagueSync = newest(
    leagues.flatMap((row) => [row.last_synced_at, row.last_deep_synced_at]),
  );
  const managerRetrievedAt = newest(managers.map((row) => row.retrieved_at));
  const playerProcessRetrievedAt = newest(
    playerMetrics.map((row) => row.retrieved_at),
  );
  const playerIds = new Set(playerMetrics.map((row) => row.player_id));
  const leaguePlayerRows = playerMetrics.filter(
    (row) => String(row.competition).toLowerCase() === "prem",
  );
  const nonLeaguePlayerRows = playerMetrics.filter(
    (row) => String(row.competition).toLowerCase() !== "prem",
  );
  const priorRetrievedAt = newest(
    playerPriors.map((row) => row.retrieved_at),
  );
  const establishedPriors = playerPriors.filter(
    (row) => Number(row.minutes ?? 0) >= 180,
  );

  const competitions = [
    ...new Set(
      playerMetrics
        .map((row) => String(row.competition || "").trim())
        .filter(Boolean),
    ),
  ].sort();

  const processMetrics = PROCESS_METRICS.map(([metric, label, supports]) => {
    const coverage =
      metric in (metrics[0] ?? {}) ? canonicalCoverage(metrics, metric) : 0;
    return {
      metric: label,
      status:
        coverage >= 0.95
          ? ("AVAILABLE" as const)
          : coverage > 0
            ? ("PARTIAL" as const)
            : ("MISSING" as const),
      coverage,
      source: coverage > 0 ? "Verified canonical match-team layer" : "No production source",
      supports,
    };
  });

  const missingProcess = processMetrics
    .filter((metric) => metric.status === "MISSING")
    .map((metric) => metric.metric);

  return {
    generatedAt: new Date().toISOString(),
    families: [
      {
        id: "fpl-market",
        label: "FPL player / market state",
        status:
          !fplRetrievedAt
            ? "MISSING"
            : fplAge <= 20
              ? "LIVE"
              : fplAge <= 45
                ? "AGING"
                : "STALE",
        source: "Official FPL",
        retrievedAt: fplRetrievedAt,
        target: "On-demand + 15-minute fallback cache",
        coverage:
          bootstrap && fixtures
            ? "Prices, ownership, transfers, points, minutes, starts, availability/news, xG/xA/xGI/xGC, bonus/BPS, set-piece order and fixtures"
            : "Incomplete FPL snapshot",
        supports: [
          "player value / EPA",
          "availability and minutes risk",
          "captaincy",
          "transfer timing",
          "fixture horizon",
        ],
        caveats: [
          "Official FPL does not provide all tactical/event metrics required for team-style analysis.",
        ],
      },
      {
        id: "live-gameweek",
        label: "Current Gameweek live state",
        status:
          currentEventId == null
            ? "MISSING"
            : !liveSnapshot
              ? "INCOMPLETE"
              : liveAge <= 20
                ? "LIVE"
                : liveAge <= 45
                  ? "AGING"
                  : "STALE",
        source: "Official FPL event-live",
        retrievedAt: liveSnapshot?.retrieved_at ?? null,
        target: "60-second on-demand read + 15-minute fallback cache",
        coverage: liveSnapshot
          ? "Live player points for the current Gameweek"
          : "Fallback cache not yet populated",
        supports: [
          "players already played / still to play",
          "live captain exposure",
          "settled vs swingable mini-league gap",
        ],
        caveats: [
          "In-play matches remain uncertain; Footy should not treat live returns as final.",
        ],
      },
      {
        id: "team-process",
        label: "Underlying team process",
        status:
          !metrics.length
            ? "MISSING"
            : uncoveredMatches.length
              ? "AGING"
              : ageMinutes(processRetrievedAt) > 24 * 60
                ? "STALE"
                : "FRESH",
        source: "Understat + verified FPL-Core enrichment",
        retrievedAt: processRetrievedAt,
        target: "Automatic refresh after main match windows",
        coverage: `${metrics.length} team-match rows across ${coveredIds.size} current-season matches; ${uncoveredMatches.length}/${finishedMatches.length} finished matches currently uncovered`,
        supports: [
          "attack / defence strength",
          "process-vs-results regression",
          "pressing intensity",
          "deep-territory access",
          "set-piece matchup",
          "recent trend",
        ],
        caveats: [
          missingProcess.length
            ? `Missing production metrics: ${missingProcess.join(", ")}`
            : "No major process-field gap detected.",
        ],
      },
      {
        id: "player-process",
        label: "Player process / role evidence",
        status:
          !playerMetrics.length
            ? "MISSING"
            : ageMinutes(playerProcessRetrievedAt) > 24 * 60
              ? "STALE"
              : leaguePlayerRows.length
                ? "FRESH"
                : "INCOMPLETE",
        source: "FPL-Core-Insights linked to Official FPL IDs",
        retrievedAt: playerProcessRetrievedAt,
        target: "Refresh after upstream FPL-Core updates; retain raw match-level provenance",
        coverage: playerMetrics.length
          ? `${playerMetrics.length} positive-minute player-match rows across ${playerIds.size} players and ${competitions.length} competition(s)`
          : "No player-match process rows ingested yet",
        supports: [
          "recent xG/xA/xGOT role trend",
          "chances created / box involvement",
          "goalkeeper xGOT faced and goals prevented",
          "defensive contribution context",
          "minutes and role stability",
        ],
        caveats: [
          "Recent player samples are explicitly regressed; a few matches never become a new long-run prior by themselves.",
          "FPL remains authoritative for official minutes, points, availability and price.",
        ],
      },
      {
        id: "historical",
        label: "Historical priors / calibration",
        status: establishedPriors.length ? "FRESH" : "INCOMPLETE",
        source: "Premier League process history + Official-FPL player priors + Footy backtests",
        retrievedAt: newest([processRetrievedAt, priorRetrievedAt]),
        target: "Stable historical store; completed-season player priors refreshed when a season closes",
        coverage: establishedPriors.length
          ? `Multiple Premier League team seasons plus ${establishedPriors.length} identity-matched 2025/26 player priors with 180+ minutes`
          : "Team history is available; identity-matched player priors are not loaded",
        supports: [
          "small-sample regression",
          "role-adjusted player baselines",
          "early-season priors",
          "model calibration",
          "variance control",
        ],
        caveats: [
          "Prior-season player rates are discounted after a club change and lose weight as current-season minutes accumulate.",
          "Current Club Elo production data is not current enough to be a live 2026/27 input.",
        ],
      },
      {
        id: "mini-league",
        label: "Mini-league / rival state",
        status:
          !latestLeagueSync
            ? "MISSING"
            : ageMinutes(latestLeagueSync) <= 75
              ? "FRESH"
              : ageMinutes(latestLeagueSync) <= 180
                ? "AGING"
                : "STALE",
        source: "Official/public FPL league and entry history",
        retrievedAt: latestLeagueSync,
        target: "Hourly scheduled sync + on-demand analysis",
        coverage: `${leagues.length} connected leagues`,
        supports: [
          "rank / gap above and below",
          "rival public squad",
          "captain overlap",
          "chips / hits / activity",
          "estimated free transfers",
        ],
        caveats: [
          "Private pre-deadline rival transfer intentions are unknowable.",
          "Free transfers are reconstructed estimates, not an official public field.",
        ],
      },
      {
        id: "club-manager",
        label: "Club manager identity / tenure",
        status:
          managers.length >= 20
            ? "FRESH"
            : managers.length
              ? "INCOMPLETE"
              : "MISSING",
        source: managers[0]?.source ?? "PremierLeague.com",
        retrievedAt: managerRetrievedAt,
        target: "Verified manager registry; refresh on appointment changes",
        coverage: `${managers.length}/20 active Premier League clubs`,
        supports: [
          "manager tenure",
          "new-manager uncertainty",
          "style analysis restricted to matches under current coach",
        ],
        caveats: [
          "Manager style must be inferred from measured team behaviour, not biography or reputation.",
        ],
      },
      {
        id: "multi-competition-context",
        label: "Europe / cups / travel / congestion context",
        status:
          !nonLeaguePlayerRows.length
            ? "MISSING"
            : ageMinutes(playerProcessRetrievedAt) > 24 * 60
              ? "STALE"
              : "FRESH",
        source: "FPL-Core-Insights multi-competition player-match layer",
        retrievedAt: playerProcessRetrievedAt,
        target: "Measure actual non-league workload and short turnaround; cross-check schedules independently",
        coverage: nonLeaguePlayerRows.length
          ? `${nonLeaguePlayerRows.length} non-league player appearances across ${competitions.filter((item) => item.toLowerCase() !== "prem").length} competition(s)`
          : "No verified non-league player appearances ingested yet",
        supports: [
          "rotation risk",
          "short turnaround",
          "actual cup / European minutes",
          "fixture-congestion load",
        ],
        caveats: [
          "Travel distance is not yet modelled directly.",
          "Competition importance/motivation is not inferred from the schedule alone.",
        ],
      },
    ],
    processMetrics,
    priorities: [
      {
        priority: "P0",
        item: "Complete and continuously verify player-match backfill",
        reason:
          "EPA and role calls should use match-level player process only after every completed Gameweek clears identity and score reconciliation.",
      },
      {
        priority: "P1",
        item: "Add a trustworthy transition / defensive-error event feed",
        reason:
          "Counterattack exposure and error-prone defending remain genuine matchup gaps; Footy should leave them unknown rather than infer them from possession.",
      },
      {
        priority: "P2",
        item: "Add true field tilt / defensive-line data",
        reason:
          "Footy's opposition-half territory proxy is useful context but must not be mislabeled as provider-defined field tilt or line height.",
      },
      {
        priority: "P2",
        item: "Harden schedule/result fallbacks",
        reason:
          "OpenFootball and DataHub can provide independent fixture/result resilience, while Official FPL remains the primary live FPL spine.",
      },
    ],
  };
}
