-- Read-only release audit. Run before promoting a model or enabling BET.
-- Exact-ID odds are candidates only: market/selection, fixture identity and freshness
-- still require the application matcher. Never interpret a price as an edge.
WITH core AS (
  SELECT match_id, league, season, source, home_team, away_team, kickoff_at
  FROM footy_matches
  WHERE kickoff_at BETWEEN now() AND now() + interval '7 days'
    AND league IN (
      'ENG-Premier League','ENG-Championship','ESP-La Liga','ESP-La Liga 2',
      'GER-Bundesliga','GER-2. Bundesliga','ITA-Serie A','ITA-Serie B',
      'FRA-Ligue 1','FRA-Ligue 2'
    )
), model AS (
  SELECT DISTINCT match_id FROM footy_model_outputs
  WHERE model_version = 'v7-r16-p50-v20'
    AND created_at >= now() - interval '7 days'
    AND home_xg >= 0 AND away_xg >= 0
    AND model_probability > 0 AND model_probability < 1
    AND fair_odds > 1 AND minimum_take_price >= fair_odds
), price AS (
  SELECT DISTINCT match_id FROM footy_live_odds_current
  WHERE captured_at >= now() - interval '30 minutes'
    AND decimal_odds > 1 AND match_id IS NOT NULL
), validation AS (
  SELECT DISTINCT league FROM footy_model_market_validation
  WHERE model_version = 'v7-r16-p50-v20' AND status = 'APPROVED'
)
SELECT c.*, m.match_id IS NOT NULL AS current_model,
       p.match_id IS NOT NULL AS fresh_exact_id_price_candidate,
       v.league IS NOT NULL AS approved_validation,
       CASE
         WHEN v.league IS NULL THEN 'BLOCKED: model validation'
         WHEN m.match_id IS NULL THEN 'BLOCKED: model output'
         WHEN p.match_id IS NULL THEN 'BLOCKED: price candidate'
         ELSE 'REVIEW: identity, market, process and price gates'
       END AS release_gate
FROM core c
LEFT JOIN model m USING (match_id)
LEFT JOIN price p USING (match_id)
LEFT JOIN validation v USING (league)
ORDER BY c.kickoff_at, c.match_id;
