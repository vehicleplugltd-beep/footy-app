import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Footy League Edge weekly mini-league recap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

async function getLeague(id: string) {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const [leagueRes, entriesRes] = await Promise.all([
    fetch(
      `${url}/rest/v1/footy_fpl_leagues?select=league_id,league_name&league_id=eq.${encodeURIComponent(id)}&limit=1`,
      { headers, cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/footy_fpl_league_entries?select=entry_name,player_name,rank,total,event_total,last_rank&league_id=eq.${encodeURIComponent(id)}&order=rank.asc&limit=5`,
      { headers, cache: "no-store" },
    ),
  ]);

  if (!leagueRes.ok || !entriesRes.ok) return null;
  const league = (await leagueRes.json())?.[0];
  const entries = await entriesRes.json();
  if (!league || !entries?.length) return null;
  return { league, entries };
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLeague(id);
  const leagueName = data?.league?.league_name || `League ${id}`;
  const entries = data?.entries || [];
  const leader = entries[0];
  const second = entries[1];
  const gap =
    leader && second ? Number(leader.total || 0) - Number(second.total || 0) : null;
  const weekly = [...entries].sort(
    (a, b) => Number(b.event_total || 0) - Number(a.event_total || 0),
  )[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 90% 0%, rgba(114,245,158,.2), transparent 34%), linear-gradient(135deg, #0d2418, #06100b)",
          color: "#eef8f1",
          padding: "54px 62px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#72f59e",
                color: "#06100b",
                fontWeight: 900,
                fontSize: 30,
              }}
            >
              F
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 17, color: "#72f59e", letterSpacing: 2 }}>
                FOOTY · LEAGUE EDGE
              </span>
              <strong style={{ fontSize: 28 }}>{leagueName}</strong>
            </div>
          </div>
          <span style={{ color: "#9ab4a4", fontSize: 18 }}>WEEKLY RECAP</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ color: "#9ab4a4", fontSize: 22 }}>TOP OF THE PILE</span>
          <strong style={{ fontSize: 66, letterSpacing: -3 }}>
            {leader?.entry_name || "Connect your league"}
          </strong>
          <span style={{ fontSize: 28, color: "#d6e8dc" }}>
            {leader
              ? gap === null
                ? `${leader.total} points`
                : `${leader.total} points · leads by ${gap}`
              : "See who is winning, why, and what to do next."}
          </span>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 18,
              padding: "20px 22px",
              background: "rgba(0,0,0,.16)",
            }}
          >
            <span style={{ color: "#9ab4a4", fontSize: 16 }}>GAMEWEEK SCORER</span>
            <strong style={{ fontSize: 26 }}>
              {weekly?.entry_name || "—"}
            </strong>
            <span style={{ color: "#72f59e", fontSize: 20 }}>
              {weekly ? `${weekly.event_total} pts` : "—"}
            </span>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 18,
              padding: "20px 22px",
              background: "rgba(0,0,0,.16)",
            }}
          >
            <span style={{ color: "#9ab4a4", fontSize: 16 }}>NEXT</span>
            <strong style={{ fontSize: 26 }}>Beat your mini-league.</strong>
            <span style={{ color: "#c6d9cd", fontSize: 18 }}>
              Connect once. Footy does the rest.
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
