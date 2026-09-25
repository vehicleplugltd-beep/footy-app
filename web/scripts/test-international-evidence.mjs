import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/international-evidence.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports });
const { reconcileInternationalEvidence: reconcile } = module.exports;
const base = {
  providerMatchId: "fixture-1", competition: "FIFA World Cup", homeTeamId: "eng",
  awayTeamId: "fra", kickoffUtc: "2026-10-01T19:00:00Z",
  gender: "men", ageGroup: "senior", xgHome: 1.3, xgAway: 0.9,
};
const a = { ...base, source: "fifa-match-archive", xgHome: null, xgAway: null };
const b = { ...base, source: "statsbomb-open-international" };
assert.equal(reconcile([a, b]).status, "MATCH");
assert.equal(reconcile([a]).status, "INSUFFICIENT");
assert.equal(reconcile([a, { ...b, source: "unknown" }]).status, "REVIEW");
assert.equal(reconcile([a, b, { ...b, providerMatchId: "duplicate" }]).status, "REVIEW");
assert.equal(reconcile([a, { ...b, awayTeamId: "esp" }]).status, "REVIEW");
assert.equal(reconcile([a, { ...b, ageGroup: "youth" }]).status, "REVIEW");
assert.equal(reconcile([a, { ...b, kickoffUtc: "2026-10-01T21:00:00Z" }]).status, "REVIEW");
assert.equal(reconcile([a, { ...b, xgAway: null }]).status, "REVIEW");
assert.equal(reconcile([a, { ...b, xgHome: -1 }]).status, "REVIEW");
const c = { ...base, source: "fotmob", xgHome: 1.5, xgAway: 1.0 };
assert.ok(Math.abs(reconcile([b, c]).xgDisagreement - 0.2) < 1e-9);
console.log("International evidence reconciliation: 10 assertions passed");
