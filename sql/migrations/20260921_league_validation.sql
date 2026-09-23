-- Keep market validation competition-specific.
alter table public.footy_model_market_validation
  add column if not exists league text;

update public.footy_model_market_validation
set league = 'ENG-Premier League'
where league is null;

alter table public.footy_model_market_validation
  alter column league set not null,
  alter column league set default 'ENG-Premier League';

alter table public.footy_model_market_validation
  drop constraint if exists footy_model_market_validation_pkey;

alter table public.footy_model_market_validation
  add constraint footy_model_market_validation_pkey
  primary key (model_version, league, market);
