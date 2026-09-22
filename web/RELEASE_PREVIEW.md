# Betting preview release gate

The betting release branch must deploy to Vercel Preview independently of `main`. Before promoting release PR #26, check `/betting/api/readiness` on the current branch deployment: `ready` and a positive `forwardModelledFixtures` count are required. Confirm the Today page displays actual modelled fixtures and complete 1X2 probabilities, then test authentication, saved bets, calculator and mobile navigation. Do not promote based solely on a successful build or database row count.

Preview needs server-only `SUPABASE_SERVICE_ROLE_KEY`; do not expose it to client-side code or logs. Missing configuration, failed database reads and zero forward forecasts must fail closed. Production remains on hold until acceptance is recorded.
