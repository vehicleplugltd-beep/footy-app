-- Research-only international process coverage and time-safe calibration cohorts.
-- Never convert this audit into a BET approval or infer future form from old tournaments.
WITH paired AS (
 SELECT m.match_id,m.league,m.kickoff_at,m.home_team,m.away_team,
        h.xg home_xg,h.xga home_xga,h.npxg home_npxg,h.goals home_goals,
        a.xg away_xg,a.xga away_xga,a.npxg away_npxg,a.goals away_goals
 FROM footy_matches m
 JOIN footy_match_team_metrics h ON h.match_id=m.match_id
   AND h.team=m.home_team AND h.home_away='H'
   AND h.source='statsbomb-open-international' AND h.verified=true
 JOIN footy_match_team_metrics a ON a.match_id=m.match_id
   AND a.team=m.away_team AND a.home_away='A'
   AND a.source='statsbomb-open-international' AND a.verified=true
 WHERE m.source='statsbomb-open-international'
   AND m.kickoff_at < now()
   AND abs(h.xg-a.xga)<0.000002 AND abs(a.xg-h.xga)<0.000002
), team_history AS (
 SELECT home_team team,kickoff_at,xg,xga,npxg FROM paired
 CROSS JOIN LATERAL (SELECT home_xg xg,home_xga xga,home_npxg npxg) v
 UNION ALL
 SELECT away_team team,kickoff_at,away_xg,away_xga,away_npxg FROM paired
)
SELECT team,count(*) historical_team_games,
 count(*) FILTER (WHERE kickoff_at >= now()-interval '730 days') games_last_2y,
 max(kickoff_at) latest_game,
 round(avg(xg)::numeric,3) historical_xg_per_game,
 round(avg(xga)::numeric,3) historical_xga_per_game
FROM team_history GROUP BY team ORDER BY historical_team_games DESC,team;

-- Calibration design: split by kickoff timestamp, never random rows.
-- Fit ONLY on records before each evaluation kickoff; exclude shootouts;
-- report log loss/Brier versus a predeclared baseline on held-out fixtures.
-- This SQL is descriptive only: no fitted or held-out probabilities exist yet.
