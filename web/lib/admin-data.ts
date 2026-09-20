const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

type RecentLeague = {
  league_id: number;
  league_name: string | null;
  sync_status: string;
  connect_count: number;
  last_connected_at: string | null;
  last_synced_at: string | null;
};

type RecentEvent = {
  event_name: string;
  league_id: number | null;
  created_at: string;
};

type SnapshotRow = {
  snapshot_key: string;
  retrieved_at: string;
};

export type AdminOverview = {
  counts: {
    leagues: number;
    entries: number;
    recommendations: number;
    scoredReceipts: number;
    analyticsEvents: number;
  };
  freshness: {
    bootstrap: string | null;
    fixtures: string | null;
  };
  recentLeagues: RecentLeague[];
  recentEvents: RecentEvent[];
  configured: boolean;
};

function config() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? { url, key } : null;
}

async function countRows(table: string, filter = "") {
  const cfg = config();
  if (!cfg) return 0;

  const response = await fetch(
    `${cfg.url}/rest/v1/${table}${filter ? `?${filter}` : ""}`,
    {
      method: "HEAD",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Prefer: "count=exact",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) return 0;
  const total = Number((response.headers.get("content-range") ?? "").split("/")[1] ?? 0);
  return Number.isFinite(total) ? total : 0;
}

async function rows<T>(path: string): Promise<T[]> {
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

export async function getAdminOverview(): Promise<AdminOverview> {
  if (!config()) {
    return {
      counts: {
        leagues: 0,
        entries: 0,
        recommendations: 0,
        scoredReceipts: 0,
        analyticsEvents: 0,
      },
      freshness: { bootstrap: null, fixtures: null },
      recentLeagues: [],
      recentEvents: [],
      configured: false,
    };
  }

  const [
    leagues,
    entries,
    recommendations,
    scoredReceipts,
    analyticsEvents,
    recentLeagues,
    recentEvents,
    bootstrap,
    fixtures,
  ] = await Promise.all([
    countRows("footy_fpl_leagues"),
    countRows("footy_fpl_league_entries"),
    countRows("footy_fpl_recommendation_snapshots"),
    countRows("footy_fpl_recommendation_snapshots", "scored_at=not.is.null"),
    countRows("footy_fpl_events"),
    rows<RecentLeague>(
      "footy_fpl_leagues?select=league_id,league_name,sync_status,connect_count,last_connected_at,last_synced_at&order=last_connected_at.desc.nullslast&limit=6",
    ),
    rows<RecentEvent>(
      "footy_fpl_events?select=event_name,league_id,created_at&order=created_at.desc&limit=10",
    ),
    rows<SnapshotRow>(
      "footy_fpl_snapshots?select=snapshot_key,retrieved_at&snapshot_key=eq.bootstrap-static&limit=1",
    ),
    rows<SnapshotRow>(
      "footy_fpl_snapshots?select=snapshot_key,retrieved_at&snapshot_key=eq.fixtures&limit=1",
    ),
  ]);

  return {
    counts: {
      leagues,
      entries,
      recommendations,
      scoredReceipts,
      analyticsEvents,
    },
    freshness: {
      bootstrap: bootstrap[0]?.retrieved_at ?? null,
      fixtures: fixtures[0]?.retrieved_at ?? null,
    },
    recentLeagues,
    recentEvents,
    configured: true,
  };
}
