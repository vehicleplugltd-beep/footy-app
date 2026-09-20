type ReceiptRow = {
  id: string;
  league_id: number;
  entry_id: number;
  event: number;
  deadline_time: string;
  generated_at: string;
  data_retrieved_at: string;
  model_version: string;
  matched_top3: boolean | null;
  matched_captain_top3: boolean | null;
  matched_transfer_top3: boolean | null;
  scored_at: string | null;
};

export type LeagueReceiptSummary = {
  officialCalls: number;
  scoredCalls: number;
  actedTop3: number;
  captainTop3: number;
  transferTop3: number;
  adherenceRate: number | null;
  latest: ReceiptRow[];
};

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";

export async function getLeagueReceiptSummary(): Promise<LeagueReceiptSummary> {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    return {
      officialCalls: 0,
      scoredCalls: 0,
      actedTop3: 0,
      captainTop3: 0,
      transferTop3: 0,
      adherenceRate: null,
      latest: [],
    };
  }

  const response = await fetch(
    `${url}/rest/v1/footy_fpl_recommendation_snapshots?select=id,league_id,entry_id,event,deadline_time,generated_at,data_retrieved_at,model_version,matched_top3,matched_captain_top3,matched_transfer_top3,scored_at&is_pre_deadline=eq.true&order=generated_at.desc&limit=1000`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return {
      officialCalls: 0,
      scoredCalls: 0,
      actedTop3: 0,
      captainTop3: 0,
      transferTop3: 0,
      adherenceRate: null,
      latest: [],
    };
  }

  const rows = (await response.json()) as ReceiptRow[];
  const official: ReceiptRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (new Date(row.generated_at).getTime() >= new Date(row.deadline_time).getTime()) {
      continue;
    }
    const keyName = `${row.league_id}:${row.entry_id}:${row.event}`;
    if (seen.has(keyName)) continue;
    seen.add(keyName);
    official.push(row);
  }

  const scored = official.filter((row) => Boolean(row.scored_at));
  const actedTop3 = scored.filter((row) => row.matched_top3 === true).length;
  const captainTop3 = scored.filter((row) => row.matched_captain_top3 === true).length;
  const transferTop3 = scored.filter((row) => row.matched_transfer_top3 === true).length;

  return {
    officialCalls: official.length,
    scoredCalls: scored.length,
    actedTop3,
    captainTop3,
    transferTop3,
    adherenceRate: scored.length ? actedTop3 / scored.length : null,
    latest: official.slice(0, 8),
  };
}
