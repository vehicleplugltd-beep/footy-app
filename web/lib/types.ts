export type ValidationStatus = "APPROVED" | "WATCH" | "RESEARCH" | "PASS";

export type ModelOutput = {
  match_id: string;
  model_version: string;
  market: string;
  selection: "home" | "draw" | "away";
  model_probability: number;
  fair_odds: number;
  minimum_take_price: number;
  created_at: string;
};

export type Match = {
  match_id: string;
  kickoff_at: string;
  league: string;
  home_team: string;
  away_team: string;
};

export type Validation = {
  model_version: string;
  market: string;
  status: ValidationStatus;
  sample_size: number;
  model_log_loss: number | null;
  benchmark_log_loss: number | null;
  close_roi: number | null;
  clv_proxy: number | null;
  bookmaker_reference: string | null;
  notes: string | null;
};

export type StrategyRule = {
  strategy_id: string;
  model_version: string;
  market: string;
  selection: string;
  status: ValidationStatus;
  min_probability_edge: number | null;
  min_model_probability: number | null;
  max_decimal_odds: number | null;
  min_raw_ev: number | null;
  holdout_bets: number | null;
  holdout_roi: number | null;
};

export type BoardSelection = ModelOutput & { displaySelection: string };

export type BoardMatch = Match & {
  selections: BoardSelection[];
};
