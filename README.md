# Footy App

Open-source football data ingestion, probability modelling and value-betting research engine.

## Core rule

Footy follows:

DATA -> UNDERLYING PROCESS -> MATCHUP -> PROBABILITY -> FAIR ODDS ->
MARKET PRICE -> EDGE -> MARKET SELECTION -> ACCA

The model is built **before** bookmaker prices are checked.

## What is implemented

### Data sources

- Understat through `soccerdata`
  - xG / xGA
  - npxG / npxGA
  - PPDA
  - deep completions
  - shot-level xG
  - shot results
  - set-piece shot xG
- Club Elo
- Football-Data.co.uk
- FBref
- Sofascore
- StatsBomb Open Data
- OpenFootball fallback

Not every source is treated equally. Scraper-backed sources may break when
provider websites change, so adapters are isolated and all successful pulls
should be cached.

### Process modelling

- leakage-safe pre-match rolling metrics
- small-sample regression
- home/away split regression
- opponent-Elo adjustment hook
- finishing residual: goals minus xG
- defensive residual: goals conceded minus xGA
- uncertainty haircut based on sample size

### Pricing

- expected-goals estimates
- Poisson score distribution
- 1X2
- Asian Handicap
- quarter-line Asian Handicap
- Asian Totals
- quarter-line Asian Totals
- Team Totals
- BTTS
- Double Chance
- fair odds
- expected value
- uncertainty-adjusted minimum take price
- BET / WATCH / PASS / FADE classification

Asian pushes, half-wins and half-losses are settled explicitly rather than
being approximated as ordinary binary outcomes.

### Backtesting

- Brier score
- log loss
- calibration tables
- ROI
- model EV
- closing-line value

## Install

Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest -q
```

## CLI

List configured data sources:

```bash
footy-data sources
```

Smoke-test Understat ingestion:

```bash
footy-data understat-smoke \
  --league "ENG-Premier League" \
  --season "2026"
```

Include shot-level aggregation:

```bash
footy-data understat-smoke \
  --league "ENG-Premier League" \
  --season "2026" \
  --with-shots
```

## Data integrity

Footy never fabricates missing metrics.

Provider-specific raw data is normalised into one row per team per match. Every
normalised observation records its source and retrieval timestamp. Team-name
fuzzy matching is suggestion-only: ambiguous clubs must be resolved explicitly.

The SQL starter schema is in `sql/schema.sql`.

## Repository layout

```text
src/footy_data/
  sources/           source adapters
  normalizers/       provider -> canonical schema
  features.py        pre-match process features
  xg_engine.py       expected-goals baseline
  model.py           score distribution
  markets.py         Asian/total settlement and pricing
  scanner.py         price/EV decision layer
  backtest.py        calibration, ROI and CLV
sql/
  schema.sql
tests/
docs/
  data-model.md
```

## Next build stage

1. Persist normalised history in PostgreSQL/Supabase.
2. Pull several historical seasons.
3. Join historical bookmaker prices.
4. Run strictly time-split out-of-sample backtests.
5. Calibrate league scoring environments and uncertainty haircuts.
6. Add lineup/injury/context inputs.
7. Build a daily match scanner that checks market prices only after the
   football probability model is frozen.
