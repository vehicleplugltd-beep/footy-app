const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = (process.env.FOOTY_APP_URL || "https://web-taupe-eight-46.vercel.app").replace(/\/$/, "");
const FPL_BASE = "https://fantasy.premierleague.com/api";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase credentials");
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function sb(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function patch(table, filter, body) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Supabase PATCH ${response.status}: ${await response.text()}`,
    );
  }
}

async function bootstrap() {
  try {
    const response = await fetch(`${FPL_BASE}/bootstrap-static/`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FootyDecisionAudit/1.0 contact@footy.local",
        Referer: "https://fantasy.premierleague.com/",
      },
    });
    if (!response.ok) throw new Error(`FPL ${response.status}`);
    return response.json();
  } catch {
    const rows = await sb(
      "footy_fpl_snapshots?select=payload&snapshot_key=eq.bootstrap-static&limit=1",
    );
    if (!rows?.[0]?.payload) throw new Error("No bootstrap data available");
    return rows[0].payload;
  }
}

function receiptStage(hoursToDeadline) {
  if (hoursToDeadline >= 18 && hoursToDeadline <= 30) return "AUTO_24H";
  if (hoursToDeadline >= 0.5 && hoursToDeadline <= 4) return "AUTO_2H";
  return null;
}

async function freezeReceipt(leagueId, entryId, eventId, source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const url = new URL(
      `${APP_URL}/api/league/${leagueId}/manager/${entryId}`,
    );
    const startedAt = new Date(Date.now() - 5000).toISOString();
    const response = await fetch(url, {
      headers: { "User-Agent": "FootyDecisionAudit/1.0" },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `Footy API ${response.status} league=${leagueId} entry=${entryId}: ${body.slice(0, 250)}`,
      );
    }

    const receipts = await sb(
      `footy_fpl_recommendation_snapshots?select=id,decision_receipt,generated_at&league_id=eq.${leagueId}&entry_id=eq.${entryId}&event=eq.${eventId}&model_version=eq.league-edge-v5-decision-quality&generated_at=gte.${encodeURIComponent(startedAt)}&order=generated_at.desc&limit=1`,
    );
    const receipt = receipts?.[0];
    if (!receipt?.id) {
      throw new Error(
        `Decision receipt not found after API freeze league=${leagueId} entry=${entryId}`,
      );
    }
    await patch(
      "footy_fpl_recommendation_snapshots",
      `id=eq.${receipt.id}`,
      {
        receipt_source: source,
        decision_receipt: {
          ...(receipt.decision_receipt || {}),
          receipt_source: source,
        },
      },
    );

    return {
      league_id: leagueId,
      entry_id: entryId,
      receipt_id: receipt.id,
      status: "frozen",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await fn(items[index]);
      } catch (error) {
        results[index] = {
          ...items[index],
          status: "error",
          error: String(error?.message || error),
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function main() {
  const base = await bootstrap();
  const next = (base?.events || []).find((event) => event.is_next);
  if (!next?.id || !next?.deadline_time) {
    throw new Error("No next FPL deadline available");
  }

  const deadline = new Date(next.deadline_time);
  const hoursToDeadline = (deadline.getTime() - Date.now()) / 3600000;
  const source = receiptStage(hoursToDeadline);
  if (!source) {
    console.log(
      JSON.stringify(
        {
          status: "noop",
          event: next.id,
          deadline: next.deadline_time,
          hours_to_deadline: Number(hoursToDeadline.toFixed(2)),
          reason: "outside Decision Quality freeze windows",
        },
        null,
        2,
      ),
    );
    return;
  }

  const activeSince = new Date(
    Date.now() - 45 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const leagues =
    (await sb(
      `footy_fpl_leagues?select=league_id,league_name,last_connected_at&last_connected_at=gte.${encodeURIComponent(activeSince)}&order=last_connected_at.desc&limit=250`,
    )) || [];

  const jobs = [];
  for (const league of leagues) {
    const leagueId = Number(league.league_id);
    const [entries, existing] = await Promise.all([
      sb(
        `footy_fpl_league_entries?select=entry_id&league_id=eq.${leagueId}&order=rank.asc&limit=50`,
      ),
      sb(
        `footy_fpl_recommendation_snapshots?select=entry_id&league_id=eq.${leagueId}&event=eq.${next.id}&receipt_source=eq.${source}&is_pre_deadline=eq.true`,
      ),
    ]);
    const frozen = new Set(
      (existing || []).map((row) => Number(row.entry_id)),
    );
    for (const entry of entries || []) {
      const entryId = Number(entry.entry_id);
      if (!entryId || frozen.has(entryId)) continue;
      jobs.push({ league_id: leagueId, entry_id: entryId });
    }
  }

  const results = await mapLimit(jobs, 3, (job) =>
    freezeReceipt(job.league_id, job.entry_id, next.id, source),
  );
  const frozen = results.filter((row) => row.status === "frozen").length;
  const errors = results.filter((row) => row.status === "error");

  console.log(
    JSON.stringify(
      {
        status: errors.length ? "partial" : "ok",
        event: next.id,
        deadline: next.deadline_time,
        receipt_source: source,
        hours_to_deadline: Number(hoursToDeadline.toFixed(2)),
        active_leagues: leagues.length,
        requested: jobs.length,
        frozen,
        errors,
      },
      null,
      2,
    ),
  );

  if (errors.length) process.exitCode = 1;
}

main();
