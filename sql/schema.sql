create table if not exists data_sources (
  id bigint generated always as identity primary key,
  source_name text not null,
  source_url text,
  source_version text,
  retrieved_at timestamptz not null default now()
);

create table if not exists matches (
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

create table if not exists match_team_metrics (
  id bigint generated always as identity primary key,
  match_id text not null references matches(match_id) on delete cascade,
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
  on match_team_metrics(team);

create index if not exists idx_match_team_metrics_match
  on match_team_metrics(match_id);

create table if not exists team_ratings (
  id bigint generated always as identity primary key,
  team text not null,
  rating_type text not null,
  rating_value double precision not null,
  rating_date date not null,
  source text not null,
  unique (team, rating_type, rating_date, source)
);

create table if not exists bookmaker_prices (
  id bigint generated always as identity primary key,
  match_id text not null references matches(match_id) on delete cascade,
  bookmaker text not null,
  market text not null,
  selection text not null,
  line double precision,
  decimal_odds double precision not null,
  captured_at timestamptz not null default now()
);

create table if not exists model_outputs (
  id bigint generated always as identity primary key,
  match_id text not null references matches(match_id) on delete cascade,
  model_version text not null,
  home_xg double precision not null,
  away_xg double precision not null,
  market text not null,
  selection text not null,
  model_probability double precision,
  fair_odds double precision not null,
  uncertainty_haircut double precision not null,
  minimum_take_price double precision not null,
  created_at timestamptz not null default now()
);
