-- Memora Pro and the command centre.
--
-- * memora_orgs: funeral homes on a Pro plan (plan, prices, contract, branding, status).
-- * memora_cases.org_id: a memorial made by (or moved into) a funeral home.
-- * memora_groups / memora_group_members: access, ServiceNow-style but simpler.
--   People join groups; groups hold roles; roles grant permissions (defined in
--   code, src/lib/rbac.ts). org_id null = a Memora (platform) group.
-- * memora_org_invoices: one invoice per funeral home per month.
--
-- All server-only: RLS on with no policies, no client grants. Every read and
-- write goes through the server after a permission check.

create table public.memora_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  plan text not null default 'pro' check (plan in ('payg', 'pro', 'pro_plus', 'enterprise')),
  status text not null default 'trial' check (status in ('trial', 'active', 'disabled')),
  monthly_fee_minor integer not null default 0 check (monthly_fee_minor >= 0),
  per_memorial_minor integer not null default 99900 check (per_memorial_minor >= 0),
  onboarding_fee_minor integer not null default 950000 check (onboarding_fee_minor >= 0),
  onboarding_paid boolean not null default false,
  contract_start date,
  contract_end date,
  branches integer not null default 1 check (branches between 1 and 500),
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  logo_url text not null default '' check (logo_url = '' or logo_url ~ '^https://'),
  brand_colour text not null default '' check (brand_colour = '' or brand_colour ~ '^#[0-9a-fA-F]{6}$'),
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memora_cases add column if not exists org_id uuid references public.memora_orgs(id) on delete set null;
create index if not exists memora_cases_org_idx on public.memora_cases(org_id);

create table public.memora_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  description text not null default '',
  org_id uuid references public.memora_orgs(id) on delete cascade,
  roles text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index memora_groups_name_idx on public.memora_groups (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.memora_group_members (
  group_id uuid not null references public.memora_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index memora_group_members_user_idx on public.memora_group_members(user_id);

create table public.memora_org_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.memora_orgs(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  memorials integer not null default 0,
  monthly_fee_minor integer not null default 0,
  per_memorial_minor integer not null default 0,
  onboarding_minor integer not null default 0,
  amount_minor integer not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'PAID', 'VOID')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, period)
);

do $$
declare t text;
begin
  foreach t in array array['memora_orgs', 'memora_groups', 'memora_group_members', 'memora_org_invoices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Members of every group, with the address they sign in with (auth.users isn't
-- reachable through the Data API).
create or replace function public.memora_group_people()
returns table (group_id uuid, user_id uuid, email text, name text, added_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.group_id, m.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', ''), m.created_at
  from public.memora_group_members m join auth.users u on u.id = m.user_id
  order by m.created_at;
$$;
revoke all on function public.memora_group_people() from public, anon, authenticated;
grant execute on function public.memora_group_people() to service_role;

-- The Memora groups everyone starts with.
insert into public.memora_groups (name, description, roles) values
  ('Memora Administrators', 'Run Memora. Everything, everywhere.', array['platform_admin']),
  ('Memora Operations', 'Onboard and look after funeral homes and memorials.', array['ops']),
  ('Memora Support', 'Help families and funeral homes who are stuck.', array['support']),
  ('Memora Finance', 'Plans, prices, invoices and refunds.', array['finance'])
on conflict do nothing;
