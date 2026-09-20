const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FPL_BASE = "https://fantasy.premierleague.com/api";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase credentials");
}

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function sb(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders, ...(init.headers || {}) },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function upsert(table, rows, conflict) {
  if (!rows.length) return;
  await sb(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
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

async function fpl(path) {
  const response = await fetch(`${FPL_BASE}/${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FootyLeagueEdge/0.1 contact@footy.local",
      Referer: "https://fantasy.premierleague.com/",
    },
  });
  if (!response.ok) {
    throw new Error(`FPL ${response.status} ${path}: ${(await response.text()).slice(0, 250)}`);
  }
  return response.json();
}

async function bootstrap() {
  try {
    return await fpl("bootstrap-static/");
  } catch {
    const cached = await sb(
      "footy_fpl_snapshots?select=payload&snapshot_key=eq.bootstrap-static&limit=1",
    );
    if (!cached?.[0]?.payload) throw new Error("No bootstrap data available");
    return cached[0].payload;
  }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function recapFacts(entries) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const leader = sorted[0];
  const second = sorted[1] || null;
  const weekly = [...entries].sort((a, b) => b.event_total - a.event_total)[0];
  const climber = [...entries].sort(
    (a, b) => ((b.last_rank || b.rank) - b.rank) - ((a.last_rank || a.rank) - a.rank),
  )[0];

  return {
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
}

function recapCopy(name, facts) {
  const gapText = facts.gap === 1 ? "1 point" : `${facts.gap} points`;
  const climb =
    facts.climber.places > 0
      ? `${facts.climber.entry_name} climbed ${facts.climber.places} place${facts.climber.places === 1 ? "" : "s"}.`
      : `${facts.climber.entry_name} held position.`;

  return `${facts.leader.entry_name} leads ${name} by ${gapText}. ${facts.weekly.entry_name} top-scored the Gameweek with ${facts.weekly.event_total}. ${climb}`;
}

async function syncLeague(league, eventId) {
  const leagueId = Number(league.league_id);
  const now = new Date().toISOString();

  await patch(
    "footy_fpl_leagues",
    `league_id=eq.${leagueId}`,
    { sync_status: "SYNCING", updated_at: now, last_error: null },
  );

  try {
    const payload = await fpl(`leagues-classic/${leagueId}/standings/`);
    const results = (payload?.standings?.results || []).slice(0, 50);
    if (!results.length) throw new Error("No standings returned");

    const leagueName = payload?.league?.name || league.league_name || `League ${leagueId}`;
    const entries = results.map((row) => ({
      league_id: leagueId,
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

    const snapshots = [];
    for (const group of chunk(entries, 5)) {
      const rows = await Promise.all(
        group.map(async (entry) => {
          try {
            const picks = await fpl(
              `entry/${entry.entry_id}/event/${eventId}/picks/`,
            );
            return {
              league_id: leagueId,
              entry_id: entry.entry_id,
              event: eventId,
              picks: picks?.picks || [],
              active_chip: picks?.active_chip || null,
              automatic_subs: picks?.automatic_subs || [],
              entry_history: picks?.entry_history || {},
              synced_at: now,
            };
          } catch (error) {
            console.warn(
              `snapshot failed league=${leagueId} entry=${entry.entry_id}: ${error.message}`,
            );
            return null;
          }
        }),
      );
      snapshots.push(...rows.filter(Boolean));
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await upsert(
      "footy_fpl_entry_snapshots",
      snapshots,
      "league_id,entry_id,event",
    );

    const facts = recapFacts(entries);
    await upsert("footy_fpl_league_recaps", [{
      league_id: leagueId,
      event: eventId,
      facts,
      recap_copy: recapCopy(leagueName, facts),
      updated_at: now,
    }], "league_id,event");

    await patch(
      "footy_fpl_leagues",
      `league_id=eq.${leagueId}`,
      {
        league_name: leagueName,
        current_event: eventId,
        last_synced_at: now,
        last_deep_synced_at: now,
        sync_status: "READY",
        last_error: null,
        updated_at: now,
      },
    );

    return {
      league_id: leagueId,
      entries: entries.length,
      snapshots: snapshots.length,
    };
  } catch (error) {
    await patch(
      "footy_fpl_leagues",
      `league_id=eq.${leagueId}`,
      {
        sync_status: "ERROR",
        last_error: String(error?.message || error).slice(0, 800),
        updated_at: new Date().toISOString(),
      },
    );
    return { league_id: leagueId, error: String(error?.message || error) };
  }
}

async function main() {
  const base = await bootstrap();
  const events = base?.events || [];
  const current =
    events.find((event) => event.is_current) ||
    events.find((event) => event.is_next) ||
    [...events].reverse().find((event) => event.finished);

  if (!current?.id) throw new Error("No active FPL event found");

  const activeSince = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const leagues =
    (await sb(
      `footy_fpl_leagues?select=league_id,league_name,last_connected_at&last_connected_at=gte.${encodeURIComponent(activeSince)}&order=last_connected_at.desc&limit=250`,
    )) || [];

  const output = [];
  for (const league of leagues) {
    output.push(await syncLeague(league, Number(current.id)));
  }

  console.log(JSON.stringify({
    status: "ok",
    event: current.id,
    active_leagues: leagues.length,
    leagues: output,
  }, null, 2));
}

main();
