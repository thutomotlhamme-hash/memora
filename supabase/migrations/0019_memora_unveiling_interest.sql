-- The first year, and what comes after it.
--
-- A memorial is public for a year: long enough for the tombstone unveiling,
-- which most families hold around the first anniversary. Memora's events
-- product (unveiling invitations, directions, the day itself, another year
-- online) comes later; until then families can ask to be told when it's ready,
-- and their funeral home can see whose first year is ending.
--
-- One row per memorial and kind. Server-only, like the other operational tables.

create table if not exists public.memora_event_interest (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.memora_cases(id) on delete cascade,
  user_id uuid,
  kind text not null default 'unveiling' check (kind in ('unveiling', 'anniversary', 'extend')),
  planned_for date,
  note text not null default '' check (length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (case_id, kind)
);
alter table public.memora_event_interest enable row level security;
revoke all privileges on public.memora_event_interest from anon, authenticated;
