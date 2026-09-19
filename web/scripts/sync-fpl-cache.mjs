const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const endpoints = [
  ["bootstrap-static", "https://fantasy.premierleague.com/api/bootstrap-static/"],
  ["fixtures", "https://fantasy.premierleague.com/api/fixtures/"],
];

async function fetchFpl(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Referer: "https://fantasy.premierleague.com/",
      "Accept-Language": "en-GB,en;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`FPL fetch failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function upsert(snapshotKey, payload) {
  const response = await fetch(
    `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/footy_fpl_snapshots?on_conflict=snapshot_key`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        {
          snapshot_key: snapshotKey,
          payload,
          source: "fantasy.premierleague.com",
          retrieved_at: new Date().toISOString(),
        },
      ]),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Supabase upsert failed ${response.status}: ${await response.text()}`,
    );
  }
}

for (const [key, url] of endpoints) {
  const payload = await fetchFpl(url);
  await upsert(key, payload);
  console.log(`cached ${key}`);
}
