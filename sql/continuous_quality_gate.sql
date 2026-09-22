-- Continuous betting-engine validation snapshots.
-- Append-only history lets Footy compare each model version with the previous
-- frozen out-of-sample validation instead of judging quality retrospectively.

create table if not exists public.footy_model_quality_snapshots (
  id bigint generated always as identity primary key,
  league text not null,
  market text not null,
  model_version text not null,
  evaluated_at timestamptz not null default now(),
  sample_size integer not null check (sample_size >= 0),
  data_completeness double precision not null
    check (data_completeness >= 0 and data_completeness <= 1),
  model_log_loss double precision not null check (model_log_loss > 0),
  benchmark_log_loss double precision not null check (benchmark_log_loss > 0),
  calibration_error double precision not null check (calibration_error >= 0),
  price_sample_size integer not null default 0 check (price_sample_size >= 0),
  mean_clv double precision,
  realized_roi double precision,
  previous_model_log_loss double precision,
  previous_calibration_error double precision,
  previous_mean_clv double precision,
  gate_status text not null
    check (gate_status in ('READY','LIMITED','BLOCKED')),
  validation_status text not null
    check (validation_status in ('APPROVED','WATCH','PASS')),
  reasons jsonb not null default '[]'::jsonb,
  policy jsonb not null default '{}'::jsonb
);

create index if not exists idx_footy_model_quality_league_market
  on public.footy_model_quality_snapshots(
    league, market, evaluated_at desc
  );

create index if not exists idx_footy_model_quality_status
  on public.footy_model_quality_snapshots(
    gate_status, evaluated_at desc
  );

alter table public.footy_model_quality_snapshots enable row level security;
revoke all on table public.footy_model_quality_snapshots
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.footy_model_quality_snapshots to service_role;
revoke all on sequence public.footy_model_quality_snapshots_id_seq
  from public, anon, authenticated;
grant usage, select on sequence public.footy_model_quality_snapshots_id_seq
  to service_role;
