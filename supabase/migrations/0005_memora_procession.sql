-- Procession tracker: the coordinator's phone in the lead car shares where the
-- procession is, so guests can follow it on the memorial.
--
-- Privacy by design:
-- * Only the latest position is kept (one row per memorial, overwritten). There
--   is no location history.
-- * Sharing ends automatically on arrival, when the coordinator ends it, or six
--   hours after it started, whichever comes first. Ending clears the position.
-- * Server-only table: no policies for anon or authenticated. The app reads and
--   writes it with the service role after checking the run-sheet link.

create table if not exists public.memora_procession (
  case_id uuid primary key references public.memora_cases(id) on delete cascade,
  status text not null default 'ENDED' check (status in ('SHARING', 'PAUSED', 'ENDED')),
  to_stop_key text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  accuracy_m integer,
  started_at timestamptz,
  expires_at timestamptz,
  position_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint memora_procession_position check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
  )
);

alter table public.memora_procession enable row level security;
revoke all on public.memora_procession from public, anon, authenticated;
grant select, insert, update, delete on public.memora_procession to service_role;
