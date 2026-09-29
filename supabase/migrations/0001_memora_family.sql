-- Memora 2 — family memorial schema.
--
-- A clean, family-only schema. The funeral-home product (Memora Pro:
-- organisations, branches, staff, invites, intake and approval links) has been
-- removed entirely. Apply to a fresh Supabase project, or to the existing
-- project after dropping the old memora_* tables (it had no production rows).
--
-- Security model
--   * Every table has RLS. Browser clients only ever act as the signed-in owner.
--   * Anonymous (guest) Supabase users are refused everywhere: guest drafts live
--     only in the browser until the person creates a real account.
--   * Trusted state (status, slug, publish dates, orders, payments) can only be
--     changed by the server with the service-role key, never by the browser.
--   * Public memorial reads go through the Next.js server, which only returns
--     published, non-archived memorials. anon has no table access at all.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.memora_cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  slug text unique,
  disposition_type text not null default '' check (disposition_type in ('','burial','cremation','private_burial_later','memorial_only','other')),
  disposition_notes text not null default '',
  programme_mode text not null default '' check (programme_mode in ('','formal','none')),
  obituary text not null default '',
  family_message text not null default '',
  published_at timestamptz,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memora_people (
  case_id uuid primary key references public.memora_cases(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  preferred_name text not null default '',
  birth_date date,
  passing_date date,
  portrait_path text,
  updated_at timestamptz not null default now()
);

create table public.memora_stops (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.memora_cases(id) on delete cascade,
  stop_type text not null default 'other' check (stop_type in ('home','church','hall','cemetery','crematorium','reception','gathering','other')),
  title text not null check (length(btrim(title)) > 0),
  event_date date not null,
  event_time time not null,
  departure_time time,
  address_text text not null default '',
  landmark text not null default '',
  parking_notes text not null default '',
  transport_notes text not null default '',
  notes text not null default '',
  latitude numeric(10,7) not null check (latitude between -90 and 90),
  longitude numeric(10,7) not null check (longitude between -180 and 180),
  sort_order integer not null default 0
);

create table public.memora_programme_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.memora_cases(id) on delete cascade,
  item_type text not null default 'custom' check (item_type in ('prayer','scripture','hymn','tribute','obituary','eulogy','song','announcement','custom')),
  start_time time,
  title text not null check (length(btrim(title)) > 0),
  presenter text not null default '',
  detail text not null default '',
  sort_order integer not null default 0
);

create table public.memora_orders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.memora_cases(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'ZAR',
  status text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','REFUNDED','CANCELLED')),
  provider text not null default 'paystack',
  provider_reference text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memora_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.memora_orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text not null,
  status text not null check (status in ('PENDING','CONFIRMED','FAILED','REFUNDED')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'ZAR',
  verified_at timestamptz,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table public.memora_activity_log (
  id bigint generated always as identity primary key,
  case_id uuid references public.memora_cases(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index memora_cases_owner_idx on public.memora_cases(owner_id, updated_at desc);
create index memora_cases_public_idx on public.memora_cases(slug) where status = 'PUBLISHED';
create index memora_stops_case_idx on public.memora_stops(case_id, sort_order);
create index memora_programme_case_idx on public.memora_programme_items(case_id, sort_order);
create index memora_orders_case_idx on public.memora_orders(case_id, status);
create index memora_payments_order_idx on public.memora_payments(order_id);
create index memora_activity_case_idx on public.memora_activity_log(case_id);
create index memora_activity_actor_idx on public.memora_activity_log(actor_user_id);
create index memora_orders_created_by_idx on public.memora_orders(created_by);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.memora_is_permanent_user()
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select (select auth.uid()) is not null
    and coalesce((((select auth.jwt())->>'is_anonymous')::boolean), false) = false;
$$;
revoke all on function public.memora_is_permanent_user() from public;
grant execute on function public.memora_is_permanent_user() to authenticated;

create or replace function public.memora_owns_case(p_case_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.memora_cases c
    where c.id = p_case_id and c.owner_id = (select auth.uid())
  );
$$;
revoke all on function public.memora_owns_case(uuid) from public;
grant execute on function public.memora_owns_case(uuid) to authenticated;

-- Storage paths are text; compare as text so a non-UUID folder is simply "not yours"
-- instead of raising a cast error.
create or replace function public.memora_owns_case_folder(p_folder text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.memora_cases c
    where c.id::text = p_folder and c.owner_id = (select auth.uid())
  );
$$;
revoke all on function public.memora_owns_case_folder(text) from public;
grant execute on function public.memora_owns_case_folder(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.memora_cases enable row level security;
alter table public.memora_people enable row level security;
alter table public.memora_stops enable row level security;
alter table public.memora_programme_items enable row level security;
alter table public.memora_orders enable row level security;
alter table public.memora_payments enable row level security;
alter table public.memora_activity_log enable row level security;

-- Defence in depth: every Memora table refuses anonymous-auth identities.
do $$
declare t text;
begin
  foreach t in array array['memora_cases','memora_people','memora_stops','memora_programme_items','memora_orders','memora_payments','memora_activity_log']
  loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.memora_is_permanent_user()) with check (public.memora_is_permanent_user())',
      'permanent_accounts_only', t);
  end loop;
end $$;

create policy "owner reads cases" on public.memora_cases for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "owner creates draft cases" on public.memora_cases for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'DRAFT' and slug is null and published_at is null and archive_at is null);
create policy "owner edits cases" on public.memora_cases for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes unpublished cases" on public.memora_cases for delete to authenticated
  using (owner_id = (select auth.uid()) and status = 'DRAFT');

create policy "owner people" on public.memora_people for all to authenticated
  using (public.memora_owns_case(case_id)) with check (public.memora_owns_case(case_id));
create policy "owner stops" on public.memora_stops for all to authenticated
  using (public.memora_owns_case(case_id)) with check (public.memora_owns_case(case_id));
create policy "owner programme" on public.memora_programme_items for all to authenticated
  using (public.memora_owns_case(case_id)) with check (public.memora_owns_case(case_id));

create policy "owner reads orders" on public.memora_orders for select to authenticated
  using (public.memora_owns_case(case_id));
create policy "owner reads payments" on public.memora_payments for select to authenticated
  using (exists (select 1 from public.memora_orders o where o.id = order_id and public.memora_owns_case(o.case_id)));
create policy "owner reads activity" on public.memora_activity_log for select to authenticated
  using (public.memora_owns_case(case_id));

-- ---------------------------------------------------------------------------
-- Least-privilege Data API grants (table privileges AND RLS both apply)
-- ---------------------------------------------------------------------------

revoke all privileges on
  public.memora_cases, public.memora_people, public.memora_stops, public.memora_programme_items,
  public.memora_orders, public.memora_payments, public.memora_activity_log
from anon, authenticated;

grant select, insert, delete on public.memora_cases to authenticated;
-- Only content columns are browser-editable. status, slug and publish dates are server-owned.
grant update (disposition_type, disposition_notes, programme_mode, obituary, family_message, updated_at)
  on public.memora_cases to authenticated;
grant select, insert, update, delete on public.memora_people, public.memora_stops, public.memora_programme_items to authenticated;
grant select on public.memora_orders, public.memora_payments, public.memora_activity_log to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic draft save. Runs as the caller, so RLS still decides what it can touch.
-- ---------------------------------------------------------------------------

create or replace function public.memora_save_draft(p_case_id uuid, p_draft jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_person jsonb := coalesce(p_draft->'person', '{}'::jsonb);
begin
  update public.memora_cases set
    disposition_type = coalesce(p_draft#>>'{disposition,type}', ''),
    disposition_notes = coalesce(p_draft#>>'{disposition,notes}', ''),
    programme_mode = coalesce(p_draft#>>'{programme,mode}', ''),
    obituary = coalesce(p_draft#>>'{story,obituary}', ''),
    family_message = coalesce(p_draft#>>'{story,familyMessage}', ''),
    updated_at = v_now
  where id = p_case_id;
  if not found then
    raise exception 'Memorial not found' using errcode = 'P0002';
  end if;

  insert into public.memora_people (case_id, first_name, last_name, preferred_name, birth_date, passing_date, portrait_path, updated_at)
  values (
    p_case_id,
    coalesce(v_person->>'firstName', ''),
    coalesce(v_person->>'lastName', ''),
    coalesce(v_person->>'preferredName', ''),
    nullif(v_person->>'birthDate', '')::date,
    nullif(v_person->>'passingDate', '')::date,
    nullif(v_person->>'portraitPath', ''),
    v_now
  )
  on conflict (case_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    preferred_name = excluded.preferred_name,
    birth_date = excluded.birth_date,
    passing_date = excluded.passing_date,
    portrait_path = excluded.portrait_path,
    updated_at = excluded.updated_at;

  delete from public.memora_stops where case_id = p_case_id;
  insert into public.memora_stops (
    case_id, stop_type, title, event_date, event_time, departure_time, address_text, landmark,
    parking_notes, transport_notes, notes, latitude, longitude, sort_order
  )
  select
    p_case_id,
    coalesce(nullif(s.v->>'type', ''), 'other'),
    s.v->>'title',
    (s.v->>'date')::date,
    (s.v->>'time')::time,
    nullif(s.v->>'departTime', '')::time,
    coalesce(s.v->>'address', ''),
    coalesce(s.v->>'landmark', ''),
    coalesce(s.v->>'parking', ''),
    coalesce(s.v->>'transport', ''),
    coalesce(s.v->>'notes', ''),
    (s.v->>'lat')::numeric,
    (s.v->>'lng')::numeric,
    s.i::integer
  from jsonb_array_elements(coalesce(p_draft->'journey', '[]'::jsonb)) with ordinality as s(v, i);

  delete from public.memora_programme_items where case_id = p_case_id;
  insert into public.memora_programme_items (case_id, item_type, start_time, title, presenter, detail, sort_order)
  select
    p_case_id,
    coalesce(nullif(p.v->>'type', ''), 'custom'),
    nullif(p.v->>'time', '')::time,
    p.v->>'title',
    coalesce(p.v->>'presenter', ''),
    coalesce(p.v->>'detail', ''),
    p.i::integer
  from jsonb_array_elements(coalesce(p_draft#>'{programme,items}', '[]'::jsonb)) with ordinality as p(v, i);

  return v_now;
end $$;

revoke all on function public.memora_save_draft(uuid, jsonb) from public;
grant execute on function public.memora_save_draft(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Private media. Objects live under <case_id>/<file>. Public pages receive
-- short-lived signed URLs from the server; the bucket is never public.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memora-media', 'memora-media', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "memora owner media read" on storage.objects for select to authenticated
  using (bucket_id = 'memora-media' and public.memora_is_permanent_user()
    and public.memora_owns_case_folder((storage.foldername(name))[1]));
create policy "memora owner media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'memora-media' and public.memora_is_permanent_user()
    and public.memora_owns_case_folder((storage.foldername(name))[1]));
create policy "memora owner media update" on storage.objects for update to authenticated
  using (bucket_id = 'memora-media' and public.memora_is_permanent_user()
    and public.memora_owns_case_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'memora-media' and public.memora_is_permanent_user()
    and public.memora_owns_case_folder((storage.foldername(name))[1]));
create policy "memora owner media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'memora-media' and public.memora_is_permanent_user()
    and public.memora_owns_case_folder((storage.foldername(name))[1]));
