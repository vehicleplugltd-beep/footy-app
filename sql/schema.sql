-- Footy production schema for the shared Supabase project.
-- Existing VehiclePlug tables are left untouched.
-- Footy uses isolated footy_* tables with RLS and server-only grants.

create table if not exists public.footy_data_sources (
  id bigint generated always as identity primary key,
  source_name text not null,
  source_url text,
  source_version text,
  retrieved_at timestamptz not null default now()
);

create table if not exists public.footy_matches (
  match_id text primary key,
  league text not null,
  season text not null,
  kickoff_at timestamptz,
  home_team text not null,
  away_team text not null,
  status text,
  source text not null,
  retrieved_at timestamptz not null default now()
);

create table if not exists public.footy_match_team_metrics (
  id bigint generated always as identity primary key,
  match_id text not null references public.footy_matches(match_id) on delete cascade,
  team text not null,
  opponent text not null,
  home_away text not null check (home_away in ('H','A')),
  goals double precision,
  goals_conceded double precision,
  xg double precision,
  npxg double precision,
  xga double precision,
  npxga double precision,
  shots double precision,
  shots_on_target double precision,
  shots_conceded double precision,
  sot_conceded double precision,
  big_chances double precision,
  big_chances_conceded double precision,
  box_touches double precision,
  key_passes double precision,
  xa double precision,
  set_piece_xg double precision,
  set_piece_xga double precision,
  possession double precision,
  ppda double precision,
  field_tilt double precision,
  deep_completions double precision,
  source text not null,
  retrieved_at timestamptz not null default now(),
  unique (match_id, team, source)
);

create index if not exists idx_footy_metrics_team
  on public.footy_match_team_metrics(team);

create index if not exists idx_footy_metrics_match
  on public.footy_match_team_metrics(match_id);

create table if not exists public.footy_team_ratings (
  id bigint generated always as identity primary key,
  team text not null,
  rating_type text not null,
  rating_value double precision not null,
  rating_date date not null,
  source text not null,
  unique (team, rating_type, rating_date, source)
);

create table if not exists public.footy_bookmaker_prices (
  id bigint generated always as identity primary key,
  price_key text not null unique,
  match_id text not null references public.footy_matches(match_id) on delete cascade,
  bookmaker text not null,
  market text not null,
  selection text not null,
  line double precision,
  decimal_odds double precision not null check (decimal_odds > 1.0),
  price_kind text not null default 'snapshot'
    check (price_kind in ('open', 'close', 'snapshot')),
  source text not null default 'manual',
  captured_at timestamptz not null default now()
);

create index if not exists idx_footy_prices_match_market
  on public.footy_bookmaker_prices(match_id, market, selection, captured_at desc);

create table if not exists public.footy_model_outputs (
  id bigint generated always as identity primary key,
  match_id text not null references public.footy_matches(match_id) on delete cascade,
  model_version text not null,
  home_xg double precision not null check (home_xg >= 0),
  away_xg double precision not null check (away_xg >= 0),
  market text not null,
  selection text not null,
  model_probability double precision check (
    model_probability is null or (model_probability >= 0 and model_probability <= 1)
  ),
  fair_odds double precision not null check (fair_odds >= 1.0),
  uncertainty_haircut double precision not null check (
    uncertainty_haircut >= 0 and uncertainty_haircut < 1
  ),
  minimum_take_price double precision not null check (minimum_take_price >= 1.0),
  created_at timestamptz not null default now()
);

create index if not exists idx_footy_model_outputs_match
  on public.footy_model_outputs(match_id);

alter table public.footy_data_sources enable row level security;
alter table public.footy_matches enable row level security;
alter table public.footy_match_team_metrics enable row level security;
alter table public.footy_team_ratings enable row level security;
alter table public.footy_bookmaker_prices enable row level security;
alter table public.footy_model_outputs enable row level security;

revoke all on table public.footy_data_sources from public, anon, authenticated;
revoke all on table public.footy_matches from public, anon, authenticated;
revoke all on table public.footy_match_team_metrics from public, anon, authenticated;
revoke all on table public.footy_team_ratings from public, anon, authenticated;
revoke all on table public.footy_bookmaker_prices from public, anon, authenticated;
revoke all on table public.footy_model_outputs from public, anon, authenticated;

grant select, insert, update, delete on table public.footy_data_sources to service_role;
grant select, insert, update, delete on table public.footy_matches to service_role;
grant select, insert, update, delete on table public.footy_match_team_metrics to service_role;
grant select, insert, update, delete on table public.footy_team_ratings to service_role;
grant select, insert, update, delete on table public.footy_bookmaker_prices to service_role;
grant select, insert, update, delete on table public.footy_model_outputs to service_role;

revoke all on sequence public.footy_data_sources_id_seq from public, anon, authenticated;
revoke all on sequence public.footy_match_team_metrics_id_seq from public, anon, authenticated;
revoke all on sequence public.footy_team_ratings_id_seq from public, anon, authenticated;
revoke all on sequence public.footy_bookmaker_prices_id_seq from public, anon, authenticated;
revoke all on sequence public.footy_model_outputs_id_seq from public, anon, authenticated;

grant usage, select on sequence public.footy_data_sources_id_seq to service_role;
grant usage, select on sequence public.footy_match_team_metrics_id_seq to service_role;
grant usage, select on sequence public.footy_team_ratings_id_seq to service_role;
grant usage, select on sequence public.footy_bookmaker_prices_id_seq to service_role;
grant usage, select on sequence public.footy_model_outputs_id_seq to service_role;


create table if not exists public.footy_backtest_runs (
  id bigint generated always as identity primary key,
  model_version text not null,
  league text not null,
  seasons text[] not null,
  prediction_rows integer not null check (prediction_rows >= 0),
  home_win_brier double precision,
  home_win_log_loss double precision,
  over_2_5_brier double precision,
  over_2_5_log_loss double precision,
  btts_brier double precision,
  btts_log_loss double precision,
  result_1x2_log_loss double precision,
  calibration jsonb,
  created_at timestamptz not null default now()
);

alter table public.footy_backtest_runs enable row level security;
revoke all on table public.footy_backtest_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.footy_backtest_runs to service_role;
revoke all on sequence public.footy_backtest_runs_id_seq from public, anon, authenticated;
grant usage, select on sequence public.footy_backtest_runs_id_seq to service_role;


create table if not exists public.footy_historical_predictions (
  id bigint generated always as identity primary key,
  match_id text not null references public.footy_matches(match_id) on delete cascade,
  model_version text not null,
  model_home_xg double precision not null check (model_home_xg >= 0),
  model_away_xg double precision not null check (model_away_xg >= 0),
  uncertainty_haircut double precision not null check (
    uncertainty_haircut >= 0 and uncertainty_haircut < 1
  ),
  home_win_probability double precision not null check (
    home_win_probability >= 0 and home_win_probability <= 1
  ),
  draw_probability double precision not null check (
    draw_probability >= 0 and draw_probability <= 1
  ),
  away_win_probability double precision not null check (
    away_win_probability >= 0 and away_win_probability <= 1
  ),
  over_2_5_probability double precision not null check (
    over_2_5_probability >= 0 and over_2_5_probability <= 1
  ),
  btts_yes_probability double precision not null check (
    btts_yes_probability >= 0 and btts_yes_probability <= 1
  ),
  home_elo double precision,
  away_elo double precision,
  created_at timestamptz not null default now(),
  unique (match_id, model_version)
);

create index if not exists idx_footy_hist_pred_model
  on public.footy_historical_predictions(model_version, match_id);

alter table public.footy_historical_predictions enable row level security;
revoke all on table public.footy_historical_predictions from public, anon, authenticated;
grant select, insert, update, delete on table public.footy_historical_predictions to service_role;
revoke all on sequence public.footy_historical_predictions_id_seq from public, anon, authenticated;
grant usage, select on sequence public.footy_historical_predictions_id_seq to service_role;


create table if not exists public.footy_value_backtest_runs (
  id bigint generated always as identity primary key,
  model_version text not null,
  bookmaker text not null,
  price_kind text not null,
  source text,
  market text not null default '1X2',
  target_ev double precision not null,
  bets integer not null check (bets >= 0),
  strike_rate double precision,
  average_odds double precision,
  roi double precision,
  average_raw_ev double precision,
  average_probability_edge double precision,
  average_market_overround double precision,
  by_selection jsonb,
  by_edge_bucket jsonb,
  created_at timestamptz not null default now()
);

alter table public.footy_value_backtest_runs enable row level security;
revoke all on table public.footy_value_backtest_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.footy_value_backtest_runs to service_role;
revoke all on sequence public.footy_value_backtest_runs_id_seq from public, anon, authenticated;
grant usage, select on sequence public.footy_value_backtest_runs_id_seq to service_role;


create table if not exists public.footy_model_market_validation (
  model_version text not null,
  market text not null,
  status text not null check (
    status in ('APPROVED','WATCH','RESEARCH','PASS')
  ),
  sample_size integer not null check (sample_size >= 0),
  model_log_loss double precision,
  benchmark_log_loss double precision,
  close_roi double precision,
  clv_proxy double precision,
  bookmaker_reference text,
  notes text,
  evaluated_at timestamptz not null default now(),
  primary key (model_version, market)
);

alter table public.footy_model_market_validation enable row level security;
revoke all on table public.footy_model_market_validation
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.footy_model_market_validation to service_role;
