-- Night vigil template: the evening usually begins with the deceased arriving home.
alter table public.memora_programme_items drop constraint if exists memora_programme_items_item_type_check;
alter table public.memora_programme_items add constraint memora_programme_items_item_type_check check (item_type in (
  'arrival','prayer','scripture','hymn','tribute','obituary','eulogy','song','announcement','custom',
  'viewing','candle','sermon','committal','wreath','thanks'
));

-- After the funeral: refreshments at home or a venue, then later the after-tears.
alter table public.memora_stops drop constraint if exists memora_stops_stop_type_check;
alter table public.memora_stops add constraint memora_stops_stop_type_check check (stop_type in (
  'home','vigil','church','hall','cemetery','crematorium','reception','aftertears','gathering','other'
));
