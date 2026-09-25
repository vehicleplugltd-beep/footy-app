-- Read-only preview of the observed Flashscore CONCACAF namespace corruption.
-- Do not update odds or fixture rows from this report. A fresh provider feed
-- must independently confirm tournament, participants and kickoff first.
WITH affected AS (
 SELECT m.match_id,m.league,m.home_team,m.away_team,m.kickoff_at,m.source,
        'CONCACAF-' || substring(m.league from 5) AS proposed_league
 FROM footy_matches m
 WHERE m.source='flashscore-feed'
   AND m.league ~ '^NOR-CONCACAF Nations League - League [ABC]$'
), dependencies AS (
 SELECT a.*,
  (SELECT count(*) FROM footy_match_team_metrics t WHERE t.match_id=a.match_id) metric_rows,
  (SELECT count(*) FROM footy_model_outputs o WHERE o.match_id=a.match_id) model_rows,
  (SELECT count(*) FROM footy_live_odds_current p WHERE p.match_id=a.match_id) price_rows
 FROM affected a
)
SELECT * FROM dependencies ORDER BY kickoff_at,match_id;
