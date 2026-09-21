-- Attribute historical value tests to their competition.
alter table public.footy_value_backtest_runs
  add column if not exists league text not null default 'ENG-Premier League';

update public.footy_value_backtest_runs
set league = 'ENG-Premier League'
where league is null;
