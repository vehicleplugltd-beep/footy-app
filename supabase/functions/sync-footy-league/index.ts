import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function sb(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function upsert(table: string, rows: unknown[], conflict: string) {
  if (!rows.length) return;
  await sb(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function fpl(path: string) {
  const response = await fetch(`${FPL_BASE}/${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FootyLeagueEdge/0.1 (+https://web-taupe-eight-46.vercel.app)",
      Referer: "https://fantasy.premierleague.com/",
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`FPL ${response.status}: ${detail}`);
  }
  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("expected POST", { status: 405 });
  }

  let cleanLeagueId = "";

  try {
    const { leagueId, focusEntryId, focusRank } = await req.json();
    cleanLeagueId = String(leagueId || "").replace(/\D/g, "");
    if (!cleanLeagueId) {
      return new Response(JSON.stringify({ error: "A numeric classic league ID is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const existing = await sb(
      `footy_fpl_leagues?select=league_id,connect_count&league_id=eq.${cleanLeagueId}&limit=1`,
    );
    const currentCount = Number(existing?.[0]?.connect_count || 0);

    await upsert("footy_fpl_leagues", [{
      league_id: Number(cleanLeagueId),
      sync_status: "SYNCING",
      connect_count: currentCount + 1,
      last_connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    }], "league_id");

    const payload = await fpl(`leagues-classic/${cleanLeagueId}/standings/`);
    const firstPageResults = payload?.standings?.results || [];
    if (!firstPageResults.length) {
      throw new Error("No public standings returned for this classic league.");
    }

    const requestedEntryId = Number(String(focusEntryId || "").replace(/\D/g, ""));
    const byEntry = new Map<number, any>();
    for (const row of firstPageResults) {
      byEntry.set(Number(row.entry), row);
    }

    // A "full league" must really be full. The official endpoint paginates
    // classic-league standings, so walk every page instead of returning page 1
    // plus (at most) a single page around the focused manager.
    let pageNumber = 1;
    let pagePayload = payload;
    while (Boolean(pagePayload?.standings?.has_next) && pageNumber < 200) {
      pageNumber += 1;
      pagePayload = await fpl(
        `leagues-classic/${cleanLeagueId}/standings/?page_standings=${pageNumber}`,
      );
      const pageResults = pagePayload?.standings?.results || [];
      for (const row of pageResults) {
        byEntry.set(Number(row.entry), row);
      }
    }
    const results = [...byEntry.values()];

    const now = new Date().toISOString();
    const leagueName = payload?.league?.name || `League ${cleanLeagueId}`;

    await upsert("footy_fpl_leagues", [{
      league_id: Number(cleanLeagueId),
      league_name: leagueName,
      last_synced_at: now,
      sync_status: "READY",
      connect_count: currentCount + 1,
      last_connected_at: now,
      updated_at: now,
      last_error: null,
    }], "league_id");

    const entries = results.map((row: any) => ({
      league_id: Number(cleanLeagueId),
      entry_id: Number(row.entry),
      entry_name: String(row.entry_name || ""),
      player_name: row.player_name ? String(row.player_name) : null,
      rank: Number(row.rank || 0),
      last_rank: Number(row.last_rank || 0),
      event_total: Number(row.event_total || 0),
      total: Number(row.total || 0),
      synced_at: now,
    }));
    await upsert("footy_fpl_league_entries", entries, "league_id,entry_id");

    const sorted = [...entries].sort((a, b) => a.rank - b.rank);
    const leader = sorted[0];
    const second = sorted[1] || null;
    const climber = [...entries].sort(
      (a, b) => ((b.last_rank || b.rank) - b.rank) - ((a.last_rank || a.rank) - a.rank),
    )[0];
    const weekly = [...entries].sort((a, b) => b.event_total - a.event_total)[0];
    const facts = {
      leader: {
        entry_id: leader.entry_id,
        entry_name: leader.entry_name,
        player_name: leader.player_name,
        total: leader.total,
      },
      gap: second ? leader.total - second.total : 0,
      weekly: {
        entry_id: weekly.entry_id,
        entry_name: weekly.entry_name,
        event_total: weekly.event_total,
      },
      climber: {
        entry_id: climber.entry_id,
        entry_name: climber.entry_name,
        places: Math.max(0, (climber.last_rank || climber.rank) - climber.rank),
      },
    };

    return new Response(JSON.stringify({
      league: { id: Number(cleanLeagueId), name: leagueName },
      standings: {
        results: entries,
        has_next: Boolean(pagePayload?.standings?.has_next),
        fully_loaded: !Boolean(pagePayload?.standings?.has_next),
        pages_loaded: pageNumber,
        total_entries: entries.length,
        safety_page_cap: 200,
        focused_entry_id: requestedEntryId || null,
      },
      recap: facts,
      sync_status: "READY",
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      if (cleanLeagueId) {
        await upsert("footy_fpl_leagues", [{
          league_id: Number(cleanLeagueId),
          sync_status: "ERROR",
          last_error: message.slice(0, 800),
          updated_at: new Date().toISOString(),
        }], "league_id");
      }
    } catch {}

    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
});
