# Continuous model-quality gate

Footy is deliberately capped at ten leagues for the current betting-engine
phase:

- Premier League / Championship
- La Liga / Segunda Division
- Bundesliga / 2. Bundesliga
- Serie A / Serie B
- Ligue 1 / Ligue 2

Adding league eleven is subordinate to improving prediction quality and price
selection inside those ten leagues.

## Promotion unit

Validation is **league x market**, not league-wide. A league can therefore be
READY for totals while remaining LIMITED or BLOCKED for 1X2.

Initial expansion-critical markets are:

- 1X2
- Over/Under 2.5

Other markets can use the same gate as historical sample sizes become credible.

## Gate states

**READY** maps to production validation status `APPROVED`. Live BET/FADE
decisions may be authorized.

**LIMITED** maps to `WATCH`. Probabilities and fair prices remain visible for
research, but the market cannot authorize a live bet.

**BLOCKED** maps to `PASS`. The model/market should not be used for a live
selection until the failing quality dimensions are repaired.

## What earns READY

The default gate in `footy_data.quality_gate` requires all of the following:

- adequate out-of-sample model history;
- high data completeness;
- model log loss no worse than the benchmark;
- acceptable calibration error;
- no material regression versus the previous validated snapshot;
- enough independently priced historical selections;
- acceptable mean closing-line value;
- no material CLV regression.

Realized ROI is stored and monitored, but is deliberately **not** a hard
promotion criterion. ROI is noisy over modest samples and can reward variance.
Probability quality, calibration and CLV are harder to game and are more useful
for deciding whether a model and its price-selection layer are genuinely
improving.

## Continuous-improvement loop

For each league and market:

1. ingest and verify historical data;
2. generate strictly chronological walk-forward probabilities;
3. compare probability quality against a simple benchmark;
4. measure calibration error;
5. join historical bookmaker prices only after probabilities are frozen;
6. measure qualified-bet CLV and realized ROI;
7. compare the current validation snapshot with the previous frozen snapshot;
8. assign READY / LIMITED / BLOCKED;
9. allow the scanner to authorize BET only when the gate maps to APPROVED;
10. keep league expansion disabled until every required core-ten league/market
    pair is READY.

Thresholds are policy, not model parameters. They should be changed only from
evidence gathered in backtests, not to make a weak league pass.
