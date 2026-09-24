-- Read-only, source-isolated international research audit.
-- Run in Supabase SQL editor; do not promote market validation from this output.
WITH research AS (
  SELECT m.match_id, m.league, m.kickoff_at, m.home_team, m.away_team,
         h.xg home_xg, h.xga home_xga, h.npxg home_npxg,
         a.xg away_xg, a.xga away_xga, a.npxg away_npxg,
         h.verified home_verified, a.verified away_verified
  FROM footy_matches m
  LEFT JOIN footy_match_team_metrics h
    ON h.match_id=m.match_id AND h.team=m.home_team
    AND h.source='statsbomb-open-international'
  LEFT JOIN footy_match_team_metrics a
    ON a.match_id=m.match_id AND a.team=m.away_team
    AND a.source='statsbomb-open-international'
  WHERE m.source='statsbomb-open-international'
)
SELECT league, count(*) fixtures,
       count(*) FILTER (WHERE home_verified IS TRUE AND away_verified IS TRUE
         AND home_xg >= 0 AND away_xg >= 0 AND home_npxg >= 0 AND away_npxg >= 0
         AND abs(home_xg-away_xga) < 0.000002
         AND abs(away_xg-home_xga) < 0.000002) fully_reconciled,
       min(kickoff_at) earliest, max(kickoff_at) latest
FROM research GROUP BY league ORDER BY league;

-- Never use broad '%Qualif%' matching alone: it captures club qualifying
-- competitions. Match competition identifiers AND national-team identities.
-- Identity joins must use an audited alias table; fuzzy matching is research
-- discovery only, never an automatic fixture-to-model or fixture-to-odds join.
