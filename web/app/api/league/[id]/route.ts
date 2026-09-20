import { NextResponse } from "next/server";

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

async function recordEvent(
  url: string,
  key: string,
  leagueId: string,
  eventName: string,
  properties: Record<string, unknown> = {},
) {
  await fetch(`${url}/rest/v1/footy_fpl_events`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      league_id: Number(leagueId),
      event_name: eventName,
      properties,
    }),
    cache: "no-store",
  }).catch(() => null);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leagueId = id.replace(/\D/g, "");

  if (!leagueId) {
    return NextResponse.json(
      { error: "A numeric classic league ID is required." },
      { status: 400 },
    );
  }

  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    return NextResponse.json(
      { error: "Footy league sync is not configured." },
      { status: 503 },
    );
  }

  await recordEvent(url, key, leagueId, "league_connect_start");

  const startedAt = Date.now();
  const response = await fetch(
    `${url}/functions/v1/sync-footy-league`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leagueId }),
      cache: "no-store",
    },
  );

  const body = await response.text();
  const data = body ? JSON.parse(body) : {};

  await recordEvent(
    url,
    key,
    leagueId,
    response.ok ? "league_connect_success" : "league_connect_fail",
    {
      status: response.status,
      duration_ms: Date.now() - startedAt,
      error: response.ok ? null : String(data?.error || "unknown").slice(0, 180),
    },
  );

  return NextResponse.json(data, { status: response.status });
}
