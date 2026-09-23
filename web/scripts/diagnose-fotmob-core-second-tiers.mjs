const HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  Referer: "https://www.fotmob.com/",
};

async function get(url) {
  const response = await fetch(url, { headers: HEADERS });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

let payload;
for (const url of [
  "https://www.fotmob.com/api/data/allLeagues",
  "https://www.fotmob.com/api/allLeagues",
]) {
  try {
    payload = await get(url);
    break;
  } catch (error) {
    console.error("route failed", url, String(error));
  }
}
if (!payload) throw new Error("FotMob allLeagues unavailable");

const wanted = new Set(["England", "Spain", "Germany", "Italy", "France"]);
const countries = (payload.countries || [])
  .filter((country) => wanted.has(country.name))
  .map((country) => ({
    country: country.name,
    ccode: country.ccode ?? null,
    leagues: (country.leagues || []).map((league) => ({
      id: league.id,
      name: league.name,
      pageUrl: league.pageUrl ?? null,
    })),
  }));

console.log(JSON.stringify(countries, null, 2));
