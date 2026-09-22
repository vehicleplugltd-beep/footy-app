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
const sampleMatch = Array.isArray(matches)
  ? matches.find((match) => match?.status?.finished && match?.id) ?? matches[0] ?? null
  : null;

console.log(
  "SAMPLE_MATCH",
  JSON.stringify(sampleMatch, null, 2).slice(0, 6000),
);

if (sampleMatch?.id) {
  const details = await get(
    `https://www.fotmob.com/api/data/matchDetails?matchId=${encodeURIComponent(sampleMatch.id)}`,
  );
  console.log("MATCH_DETAIL_KEYS", Object.keys(details));

  const processStats = [];
  function collectProcessStats(value, path = "") {
    if (processStats.length >= 50 || value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        collectProcessStats(item, `${path}[${index}]`),
      );
      return;
    }
    if (typeof value !== "object") return;

    const label = String(
      value.title ||
        value.header ||
        value.name ||
        value.key ||
        value.stat ||
        "",
    );
    if (/expected|\bxg\b|xg|shots on target|big chances/i.test(label)) {
      processStats.push({
        path,
        label,
        value: value.stats ?? value.value ?? value.statValue ?? null,
        keys: Object.keys(value).slice(0, 20),
      });
    }
    for (const [key, child] of Object.entries(value)) {
      if (/expected|xg|bigchance|shot/i.test(key)) {
        processStats.push({
          path: path ? `${path}.${key}` : key,
          label: key,
          value:
            child && typeof child === "object"
              ? JSON.stringify(child).slice(0, 800)
              : child,
          keys:
            child && typeof child === "object"
              ? Object.keys(child).slice(0, 20)
              : [],
        });
      }
      collectProcessStats(
        child,
        path ? `${path}.${key}` : key,
      );
      if (processStats.length >= 50) break;
    }
  }
  collectProcessStats(details);
  console.log("PROCESS_STATS", JSON.stringify(processStats.slice(0, 50), null, 2));

  const shotArrays = [];
  function collectShotArrays(value, path = "") {
    if (shotArrays.length >= 20 || value == null) return;
    if (Array.isArray(value)) {
      const shotLike = value.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          item.expectedGoals != null &&
          item.teamId != null,
      );
      if (shotLike.length) {
        shotArrays.push({
          path,
          length: value.length,
          shotLike: shotLike.length,
          first: shotLike[0],
        });
      }
      value.forEach((item, index) =>
        collectShotArrays(item, `${path}[${index}]`),
      );
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      collectShotArrays(child, path ? `${path}.${key}` : key);
      if (shotArrays.length >= 20) break;
    }
  }
  collectShotArrays(details);
  console.log("SHOT_ARRAYS", JSON.stringify(shotArrays, null, 2).slice(0, 16000));
  console.log(
    "TEAM_STATS_BLOCK",
    JSON.stringify(details?.content?.stats ?? null, null, 2).slice(0, 16000),
  );
}
