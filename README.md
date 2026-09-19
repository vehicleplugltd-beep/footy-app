# Footy App

Open-source football data ingestion and value-betting model.

Core principles:

- Build the model before checking bookmaker prices.
- Use underlying process (xG/xGA, shot quality, opponent strength) rather than scorelines alone.
- Regress small samples and finishing/goalkeeper overperformance.
- Price markets from model probability distributions.
- Require an uncertainty-adjusted minimum take price before classifying a market as BET.

The data/model package lives under `src/footy_data`.
