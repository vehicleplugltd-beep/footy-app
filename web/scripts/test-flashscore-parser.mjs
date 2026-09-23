import assert from "node:assert/strict";
import {
  normalizeLeague,
  parseTodayFeed,
} from "./sync-free-flashscore.mjs";

assert.equal(
  normalizeLeague("Spain", "LaLiga EA Sports"),
  "ESP-La Liga",
);
assert.equal(
  normalizeLeague("Spain", "Segunda RFEF - Group 1"),
  "SPA-Segunda RFEF - Group 1",
);
assert.equal(
  normalizeLeague("Europe", "Champions League Women"),
  "UEFA-Womens Champions League",
);

const feed = [
  "ZA÷SPAIN: LaLiga EA Sports¬ZY÷Spain",
  "AA÷Top1234¬AD÷1790092800¬AE÷Real Madrid¬AF÷Barcelona¬AB÷1",
  "ZA÷SPAIN: Segunda RFEF - Group 1¬ZY÷Spain",
  "AA÷Low1234¬AD÷1790179200¬AE÷Amorebieta¬AF÷Ourense CF¬AB÷1",
  "ZA÷EUROPE: Champions League Women¬ZY÷Europe",
  "AA÷Women12¬AD÷1790265600¬AE÷Arsenal W¬AF÷Koge W¬AB÷1",
].join("~");

const rows = parseTodayFeed(feed);
assert.equal(rows.length, 3);
assert.deepEqual(
  rows.map((row) => row.league),
  [
    "ESP-La Liga",
    "SPA-Segunda RFEF - Group 1",
    "UEFA-Womens Champions League",
  ],
);

console.log("Flashscore parser regression checks passed.");
