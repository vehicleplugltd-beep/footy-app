-- Footy production schema for Supabase/PostgreSQL.
-- Internal model tables are server-side only by default.
-- RLS is enabled and anon/authenticated privileges are revoked.

create table if not exists public.data_sources (
  id bigint generated always as identity primary key,
  source_name text not null,
  source_url text,
  source_version text,
  retrieved_at timestamptz not null default now()
);

create table if not exists public.matches (
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

create table if not exists public.match_team_metrics (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(match_id) on delete cascade,
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

create index if not exists idx_match_team_metrics_team
  on public.match_team_metrics(team);

create index if not exists idx_match_team_metrics_match
  on public.match_team_metrics(match_id);

create table if not exists public.team_ratings (
  id bigint generated always as identity primary key,
  team text not null,
  rating_type text not null,
  rating_value double precision not null,
  rating_date date not null,
  source text not null,
  unique (team, rating_type, rating_date, source)
);

create table if not exists public.bookmaker_prices (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(match_id) on delete cascade,
  bookmaker text not null,
  market text not null,
  selection text not null,
  line double precision,
  decimal_odds double precision not null check (decimal_odds > 1.0),
  captured_at timestamptz not null default now()
);

create index if not exists idx_prices_match_market
  on public.bookmaker_prices(match_id, market, selection, captured_at desc);

create table if not exists public.model_outputs (
  id bigint generated always as identity primary key,
  match_id text not null references public.matches(match_id) on delete cascade,
  model_version text not null,
  home_xg double precision not null check (home_xg >= 0),
  away_xg double precision not null check (away_xg >= 0),
  market text not null,
  selection text not null,
  model_probability double precision check (
    model_probability is null
    or (model_probability >= 0 and model_probability <= 1)
  ),
  fair_odds double precision not null check (fair_odds >= 1.0),
  uncertainty_haircut double precision not null check (
    uncertainty_haircut >= 0 and uncertainty_haircut < 1
  ),
  minimum_take_price double precision not null check (minimum_take_price >= 1.0),
  created_at timestamptz not null default now()
);

-- Public is an exposed Supabase schema. Lock all model tables down by default.
alter table public.data_sources enable row level security;
alter table public.matches enable row level security;
alter table public.match_team_metrics enable row level security;
alter table public.team_ratings enable row level security;
alter table public.bookmaker_prices enable row level security;
alter table public.model_outputs enable row level security;

revoke all on table public.data_sources from public, anon, authenticated;
revoke all on table public.matches from public, anon, authenticated;
revoke all on table public.match_team_metrics from public, anon, authenticated;
revoke all on table public.team_ratings from public, anon, authenticated;
revoke all on table public.bookmaker_prices from public, anon, authenticated;
revoke all on table public.model_outputs from public, anon, authenticated;

grant select, insert, update, delete on table public.data_sources to service_role;
grant select, insert, update, delete on table public.matches to service_role;
grant select, insert, update, delete on table public.match_team_metrics to service_role;
grant select, insert, update, delete on table public.team_ratings to service_role;
grant select, insert, update, delete on table public.bookmaker_prices to service_role;
grant select, insert, update, delete on table public.model_outputs to service_role;

revoke all on all sequences in schema public from public, anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

-- Prevent future accidental public exposure.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
