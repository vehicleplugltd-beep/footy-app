/** Source policy for international reconciliation. No source is assumed to provide xG. */
export type InternationalEvidence = "fixture" | "result" | "lineup" | "process" | "price";
export type InternationalSource = {
  id: string;
  url: string;
  evidence: readonly InternationalEvidence[];
  authority: "official" | "independent";
  access: "public-page" | "open-data" | "verify-access";
};
export const INTERNATIONAL_SOURCES: readonly InternationalSource[] = [
  { id: "fifa-match-archive", url: "https://inside.fifa.com/data-centre/matches/men", evidence: ["fixture", "result"], authority: "official", access: "public-page" },
  { id: "fifa-football-data-hub", url: "https://apiportal-fdh.fifa.org/", evidence: ["fixture", "result"], authority: "official", access: "verify-access" },
  { id: "statsbomb-open-international", url: "https://github.com/statsbomb/open-data", evidence: ["fixture", "result", "lineup", "process"], authority: "independent", access: "open-data" },
  { id: "fotmob", url: "https://www.fotmob.com/", evidence: ["fixture", "result", "lineup", "process"], authority: "independent", access: "verify-access" },
  { id: "sofascore", url: "https://www.sofascore.com/", evidence: ["fixture", "result", "lineup", "process"], authority: "independent", access: "verify-access" },
] as const;

export type MatchEvidence = {
  source: string;
  providerMatchId: string;
  competition: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
  gender: "men" | "women";
  ageGroup: "senior" | "youth";
  xgHome?: number | null;
  xgAway?: number | null;
};

export type Reconciliation =
  | { status: "MATCH"; sources: string[]; xgDisagreement: number | null }
  | { status: "REVIEW"; reason: string; sources: string[] }
  | { status: "INSUFFICIENT"; reason: string; sources: string[] };

/** Strict IDs, cohort and kickoff. Never fuzzy-match a club or youth fixture to a senior national team. */
export function reconcileInternationalEvidence(rows: readonly MatchEvidence[]): Reconciliation {
  const sources = [...new Set(rows.map((row) => row.source))];
  if (rows.length < 2 || sources.length < 2) return { status: "INSUFFICIENT", reason: "Two independent sources required", sources };
  if (sources.some((source) => !INTERNATIONAL_SOURCES.some((known) => known.id === source)))
    return { status: "REVIEW", reason: "Unregistered evidence source", sources };
  if (rows.length !== sources.length)
    return { status: "REVIEW", reason: "Multiple conflicting records from one source", sources };
  if (rows.some((row) => !row.providerMatchId || !row.homeTeamId || !row.awayTeamId || !row.competition || !Number.isFinite(Date.parse(row.kickoffUtc))))
    return { status: "REVIEW", reason: "Missing identity or invalid kickoff", sources };
  if (rows.some((row) => (row.xgHome != null || row.xgAway != null) &&
    !INTERNATIONAL_SOURCES.find((source) => source.id === row.source)?.evidence.includes("process")))
    return { status: "REVIEW", reason: "Source is not registered to provide process metrics", sources };
  const first = rows[0];
  if (rows.some((row) => row.gender !== "men" || row.ageGroup !== "senior"))
    return { status: "REVIEW", reason: "Outside the male senior international research cohort", sources };
  if (rows.some((row) => row.competition !== first.competition || row.homeTeamId !== first.homeTeamId ||
    row.awayTeamId !== first.awayTeamId || row.gender !== first.gender || row.ageGroup !== first.ageGroup ||
    Math.abs(Date.parse(row.kickoffUtc) - Date.parse(first.kickoffUtc)) > 90 * 60_000))
    return { status: "REVIEW", reason: "Competition, team, cohort or kickoff conflict", sources };
  const values = rows.flatMap((row) => [row.xgHome, row.xgAway]).filter((value): value is number => value != null);
  if (values.some((value) => !Number.isFinite(value) || value < 0))
    return { status: "REVIEW", reason: "Invalid process value", sources };
  if (rows.some((row) => (row.xgHome == null) !== (row.xgAway == null)))
    return { status: "REVIEW", reason: "Incomplete home/away process pair", sources };
  const pairs = rows.filter((row) => row.xgHome != null && row.xgAway != null);
  // Provider xG models are not interchangeable: report disagreement, never average.
  const xgDisagreement = pairs.length < 2 ? null : Math.max(
    Math.max(...pairs.map((row) => row.xgHome!)) - Math.min(...pairs.map((row) => row.xgHome!)),
    Math.max(...pairs.map((row) => row.xgAway!)) - Math.min(...pairs.map((row) => row.xgAway!)),
  );
  // A large cross-provider difference requires manual review; do not silently
  // promote contradictory process observations into model-ready evidence.
  if (xgDisagreement != null && xgDisagreement >= 0.5)
    return { status: "REVIEW", reason: "Cross-provider xG disagreement of at least 0.5", sources };
  return { status: "MATCH", sources, xgDisagreement };
}
