import { NextResponse } from "next/server";

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

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

  return NextResponse.json(data, { status: response.status });
}
