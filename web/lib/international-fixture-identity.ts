/** Quarantine provider-ID collisions; duplicate identical observations are harmless. */
export type IdentifiedFixture = {
  match_id: string;
  source?: string;
  league: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
};
export function uniqueHistoricalFixtures<T extends IdentifiedFixture>(rows: readonly T[]): T[] {
  const byId = new Map<string, T>();
  const conflicts = new Set<string>();
  for (const row of rows) {
    if (!row.match_id || !row.source || !row.home_team || !row.away_team ||
        !row.league || !Number.isFinite(Date.parse(row.kickoff_at))) {
      if (row.match_id) conflicts.add(row.match_id);
      continue;
    }
    const prior = byId.get(row.match_id);
    if (prior && (prior.source !== row.source || prior.league !== row.league ||
      prior.home_team !== row.home_team || prior.away_team !== row.away_team ||
      Date.parse(prior.kickoff_at) !== Date.parse(row.kickoff_at))) conflicts.add(row.match_id);
    else if (!prior) byId.set(row.match_id, row);
  }
  return [...byId.values()].filter((row) => !conflicts.has(row.match_id));
}
