-- Footy Edge user betting workspace.
-- Applied to the production Supabase project on 2026-09-21.
-- User-owned tables are protected by RLS and are inaccessible to anon.

create table if not exists public.footy_bet_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  source_format text not null default 'CSV' check (source_format in ('CSV','MANUAL','API')),
  rows_received integer not null default 0 check (rows_received >= 0),
  rows_imported integer not null default 0 check (rows_imported >= 0),
  rows_rejected integer not null default 0 check (rows_rejected >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.footy_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_batch_id uuid references public.footy_bet_imports(id) on delete set null,
  match_id text references public.footy_matches(match_id) on delete set null,
  placed_at timestamptz not null default now(),
  event_name text not null,
  kickoff_at timestamptz,
  market text not null,
  selection text not null,
  bookmaker text,
  decimal_odds numeric not null check (decimal_odds > 1),
  stake numeric not null default 0 check (stake >= 0),
  model_version text,
  model_probability numeric check (model_probability is null or (model_probability > 0 and model_probability < 1)),
  fair_odds numeric check (fair_odds is null or fair_odds > 1),
  minimum_take_price numeric check (minimum_take_price is null or minimum_take_price > 1),
  closing_odds numeric check (closing_odds is null or closing_odds > 1),
  status text not null default 'OPEN' check (status in ('OPEN','WON','LOST','PUSH','VOID','CASHED_OUT')),
  profit numeric,
  source text not null default 'USER_MANUAL' check (source in ('USER_MANUAL','USER_CSV','FOOTY_TIP','API')),
  notes text,
  bet_type text not null default 'SINGLE' check (bet_type in ('SINGLE','DOUBLE','TREBLE','ACCA')),
  leg_count smallint not null default 1 check (leg_count between 1 and 20),
  combined_model_probability numeric check (combined_model_probability is null or (combined_model_probability > 0 and combined_model_probability < 1)),
  combined_fair_odds numeric check (combined_fair_odds is null or combined_fair_odds > 1),
  combined_minimum_take_price numeric check (combined_minimum_take_price is null or combined_minimum_take_price > 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.footy_bet_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.footy_bets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  leg_no smallint not null check (leg_no between 1 and 20),
  match_id text references public.footy_matches(match_id) on delete set null,
  event_name text not null,
  market text not null,
  selection text not null,
  bookmaker text,
  decimal_odds numeric not null check (decimal_odds > 1),
  model_version text,
  model_probability numeric check (model_probability is null or (model_probability > 0 and model_probability < 1)),
  fair_odds numeric check (fair_odds is null or fair_odds > 1),
  minimum_take_price numeric check (minimum_take_price is null or minimum_take_price > 1),
  verdict text check (verdict is null or verdict in ('BET','WATCH','PASS','FADE')),
  correlation_group text,
  created_at timestamptz not null default now(),
  unique (bet_id, leg_no)
);

create table if not exists public.footy_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_id uuid references public.footy_bets(id) on delete set null,
  match_id text references public.footy_matches(match_id) on delete set null,
  model_version text,
  market text,
  selection text,
  feedback_type text not null check (feedback_type in ('HELPFUL','NOT_HELPFUL','PRICE_WRONG','DATA_WRONG','MODEL_MISSED','OTHER')),
  rating smallint check (rating is null or rating between 1 and 5),
  comment text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists footy_bets_user_placed_idx on public.footy_bets(user_id, placed_at desc);
create index if not exists footy_bets_user_status_idx on public.footy_bets(user_id, status);
create index if not exists footy_bets_match_idx on public.footy_bets(match_id);\ncreate index if not exists footy_bets_import_batch_idx on public.footy_bets(import_batch_id);
create index if not exists footy_bet_imports_user_created_idx on public.footy_bet_imports(user_id, created_at desc);
create index if not exists footy_bet_legs_user_idx on public.footy_bet_legs(user_id, created_at desc);
create index if not exists footy_bet_legs_bet_idx on public.footy_bet_legs(bet_id);
create index if not exists footy_bet_legs_match_idx on public.footy_bet_legs(match_id);
create index if not exists footy_feedback_user_created_idx on public.footy_feedback(user_id, created_at desc);
create index if not exists footy_feedback_match_idx on public.footy_feedback(match_id);\ncreate index if not exists footy_feedback_bet_idx on public.footy_feedback(bet_id);

alter table public.footy_bet_imports enable row level security;
alter table public.footy_bets enable row level security;
alter table public.footy_bet_legs enable row level security;
alter table public.footy_feedback enable row level security;

revoke all on table public.footy_bet_imports, public.footy_bets, public.footy_bet_legs, public.footy_feedback from anon;
grant select, insert, update, delete on table public.footy_bet_imports, public.footy_bets, public.footy_bet_legs, public.footy_feedback to authenticated;
grant select, insert, update, delete on table public.footy_bet_imports, public.footy_bets, public.footy_bet_legs, public.footy_feedback to service_role;

create policy "bet_imports_select_own" on public.footy_bet_imports for select to authenticated using ((select auth.uid()) = user_id);
create policy "bet_imports_insert_own" on public.footy_bet_imports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bet_imports_update_own" on public.footy_bet_imports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bet_imports_delete_own" on public.footy_bet_imports for delete to authenticated using ((select auth.uid()) = user_id);

create policy "bets_select_own" on public.footy_bets for select to authenticated using ((select auth.uid()) = user_id);
create policy "bets_insert_own" on public.footy_bets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "bets_update_own" on public.footy_bets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bets_delete_own" on public.footy_bets for delete to authenticated using ((select auth.uid()) = user_id);

create policy "bet_legs_select_own" on public.footy_bet_legs for select to authenticated using ((select auth.uid()) = user_id);
create policy "bet_legs_insert_own" on public.footy_bet_legs for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.footy_bets b
    where b.id = bet_id and b.user_id = (select auth.uid())
  )
);
create policy "bet_legs_update_own" on public.footy_bet_legs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bet_legs_delete_own" on public.footy_bet_legs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "feedback_select_own" on public.footy_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "feedback_insert_own" on public.footy_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "feedback_update_own" on public.footy_feedback for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "feedback_delete_own" on public.footy_feedback for delete to authenticated using ((select auth.uid()) = user_id);
