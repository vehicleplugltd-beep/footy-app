# Footy data/model architecture

## Sequential modelling rule

Footy follows:

DATA -> UNDERLYING PROCESS -> MATCHUP -> PROBABILITY -> FAIR ODDS ->
MARKET PRICE -> EDGE -> MARKET SELECTION -> ACCA

Market price must not be used to create the football probability model.

## Production data candidates

### Understat via soccerdata
Use for:
- xG / npxG
- xGA / npxGA by opponent
- PPDA
- deep completions
- shot-level xG
- shot result
- shot situation
- player xG / xA / xGChain / xGBuildup where available

### Club Elo
Use as a mild opponent-strength and schedule-strength adjustment.

### Football-Data.co.uk
Use for:
- historical scores
- historical bookmaker prices
- backtesting
- price/CLV analysis

### Sofascore / FBref
Use as secondary/augmentation sources. Because scraper availability can change,
their fields should be mapped through source-specific normalizers rather than
being assumed to exist.

### StatsBomb Open Data
Use for research and calibration of event-based features. Do not treat it as a
complete live production feed.

## Quality rules

- Every observation keeps source and retrieval timestamp.
- Missing metrics stay missing; never fabricate values.
- Team-name fuzzy matching is suggestion-only.
- Rolling features are shifted by one match to avoid target leakage.
- Home/away splits are blended back toward overall process.
- Short samples receive explicit uncertainty haircuts.
- Source outages must fail loudly rather than silently returning zeros.

## Backtesting

Evaluate out-of-sample by season/time split. Track:
- Brier score
- log loss
- probability calibration
- ROI after price threshold
- CLV
- performance by league
- performance by market
- performance by edge bucket
- performance by uncertainty bucket

A model can show positive historical ROI by variance alone. Probability
calibration and CLV are important checks alongside realized ROI.


## Multi-source canonicalisation

Footy stores provider observations separately using the unique key
`(match_id, team, source)`. The modelling layer must never count those rows
as separate matches.

Before calibration or live process modelling, provider rows are collapsed into
one canonical match/team observation:

- model-derived metrics such as xG, npxG, xA and field tilt are **not blindly
  averaged** across providers because definitions/models differ;
- the highest-priority compatible observation is selected and other providers
  are used as a cross-check;
- definition-compatible event/count metrics such as shots and shots on target
  use a robust source-weighted consensus;
- provider disagreement lowers source confidence and is retained as a conflict
  flag rather than hidden;
- missing fields remain missing.

Current production inputs are Official FPL, Understat via soccerdata,
Football-Data.co.uk and Club Elo. SofaScore and FBref adapters exist but are
not considered active production evidence until their ingestion coverage and
normalizers have passed reconciliation/quality checks. StatsBomb Open is used
for research/calibration where competition coverage exists.

Opta / Stats Perform data is **licensed-only**. Footy may use it when a
legitimate feed or licensed downstream dataset is configured; it must never
label scraped or inferred values as Opta.

### Source provenance shown to the model

Each canonical row carries:

- contributing sources,
- source count,
- per-metric selected source,
- aggregate source confidence,
- conflict flags,
- latest retrieval timestamp.

Source confidence is an uncertainty input, not an excuse to manufacture a
number. When sources disagree materially, the downstream model should increase
its uncertainty margin or decline to make a strong recommendation.
