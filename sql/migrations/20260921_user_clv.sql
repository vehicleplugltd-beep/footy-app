-- Automatic closing-line capture for user bets and acca legs.
-- Applied to Supabase on 2026-09-21.

alter table public.footy_bets
  add column if not exists closing_bookmaker text,
  add column if not exists closing_price_at timestamptz,
  add column if not exists clv numeric;

alter table public.footy_bet_legs
  add column if not exists closing_odds numeric check (closing_odds is null or closing_odds > 1),
  add column if not exists closing_bookmaker text,
  add column if not exists closing_price_at timestamptz,
  add column if not exists clv numeric;

create index if not exists footy_bets_closing_pending_idx
  on public.footy_bets(match_id, kickoff_at)
  where closing_odds is null and match_id is not null;

create index if not exists footy_bet_legs_closing_pending_idx
  on public.footy_bet_legs(match_id)
  where closing_odds is null and match_id is not null;
