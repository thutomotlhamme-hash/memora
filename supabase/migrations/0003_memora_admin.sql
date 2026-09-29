-- Memora team administration.
--
-- Owners are listed in the MEMORA_ADMIN_EMAILS environment variable (so they can
-- never be locked out from inside the app). Staff are added here by an owner
-- from /admin → Team. Access always requires signing in with that exact,
-- confirmed email address; a link alone never grants access.
--
-- Server-only: RLS on with no policies, no client grants.

create table public.memora_admins (
  email text primary key check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  added_by text not null,
  created_at timestamptz not null default now()
);

alter table public.memora_admins enable row level security;
revoke all privileges on public.memora_admins from anon, authenticated;

-- One row per memorial with the owner's email, for the admin board. auth.users
-- isn't reachable through the Data API, so this runs as a server-only function.
create or replace function public.memora_admin_cases(p_limit integer default 200)
returns table (
  id uuid, status text, slug text, owner_email text, first_name text, last_name text, preferred_name text,
  funeral_date date, published_at timestamptz, archive_at timestamptz, updated_at timestamptz, created_at timestamptz, paid boolean
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.status, c.slug, u.email::text, p.first_name, p.last_name, p.preferred_name,
    (select min(s.event_date) from public.memora_stops s where s.case_id = c.id),
    c.published_at, c.archive_at, c.updated_at, c.created_at,
    exists (
      select 1 from public.memora_orders o join public.memora_payments pay on pay.order_id = o.id
      where o.case_id = c.id and o.status = 'PAID' and pay.status = 'CONFIRMED' and pay.verified_at is not null
    )
  from public.memora_cases c
  left join public.memora_people p on p.case_id = c.id
  left join auth.users u on u.id = c.owner_id
  order by c.updated_at desc
  limit greatest(1, least(p_limit, 500));
$$;
revoke all on function public.memora_admin_cases(integer) from public, anon, authenticated;
grant execute on function public.memora_admin_cases(integer) to service_role;
