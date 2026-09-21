-- Cover the footy_alert_events -> footy_price_alerts foreign key.
create index if not exists footy_alert_events_alert_idx
  on public.footy_alert_events(alert_id);
