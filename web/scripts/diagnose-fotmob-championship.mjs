const HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  Referer: "https://www.fotmob.com/",
};

async function get(url) {
  const response = await fetch(url, { headers: HEADERS });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${url}: ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : {};
}

function findChampionship(value, found = []) {
  if (found.length >= 20 || value == null) return found;
  if (Array.isArray(value)) {
    for (const item of value) findChampionship(item, found);
    return found;
  }
  if (typeof value !== "object") return found;

  const name = String(value.name || value.title || value.text || "");
  if (name.toLowerCase().includes("championship")) {
    found.push({
      id: value.id ?? value.leagueId ?? value.uniqueTournamentId ?? null,
      name,
      type: value.type ?? value.suggestionType ?? null,
      country: value.country ?? value.ccode ?? value.ccode3 ?? null,
      keys: Object.keys(value).slice(0, 20),
    });
  }
  for (const child of Object.values(value)) {
    findChampionship(child, found);
  }
  return found;
}

const search = await get(
  "https://www.fotmob.com/api/data/search/suggest?hits=50&lang=en&term=Championship",
);
const found = findChampionship(search);
console.log("SEARCH_KEYS", Object.keys(search));
console.log("CHAMPIONSHIP_SUGGESTIONS", JSON.stringify(found, null, 2));

const league =
  found.find(
    (row) =>
      row.id != null &&
      /championship/i.test(row.name) &&
      !/women|u21|u23|reserve/i.test(row.name),
  ) ?? found.find((row) => row.id != null);

if (!league) throw new Error("No Championship league id found");

const payload = await get(
  `https://www.fotmob.com/api/data/leagues?id=${encodeURIComponent(league.id)}&ccode3=GBR`,
);
console.log("LEAGUE_ID", league.id);
console.log("LEAGUE_KEYS", Object.keys(payload));
console.log(
  "SEASONS",
  JSON.stringify(
    Array.isArray(payload.seasons)
      ? payload.seasons.slice(0, 8)
      : payload.seasons ?? null,
    null,
    2,
  ),
);

const matches =
  payload.matches?.allMatches ??
  payload.matches?.matches ??
  payload.fixtures?.allMatches ??
  payload.fixtures?.matches ??
  [];

console.log("MATCH_COUNT", Array.isArray(matches) ? matches.length : 0);
console.log(
  "SAMPLE_MATCH",
  JSON.stringify(Array.isArray(matches) ? matches[0] ?? null : null, null, 2)
    .slice(0, 6000),
);
