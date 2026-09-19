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
