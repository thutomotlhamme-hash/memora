-- Memora Enterprise: the group operating layer, built from configuration.
--
--   Enterprise account (memora_accounts: the contract, modules, master brand)
--     → regions (optional: provinces, districts, brands, divisions)
--     → funeral homes / business units (memora_orgs.account_id)
--       → branches (memora_branches.region_id)
--         → teams and people (memora_groups: account-, region-, home- or branch-level)
--           → funerals and memorials
--
-- Existing Pro homes are untouched: account_id stays null and they work as before.
-- Account groups (account_id set, org_id null) hold group roles (group admin,
-- regional manager, finance, brand, reporting, integrations) defined in
-- src/lib/rbac.ts. Everything here is server-only except the edit check.
-- Safe to run more than once.

create table if not exists public.memora_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  blueprint text not null default 'standard' check (blueprint in ('standard', 'franchise', 'insurer', 'network')),
  status text not null default 'onboarding' check (status in ('onboarding', 'trial', 'active', 'suspended', 'ending', 'closed')),
  -- Commercial terms (the contract). Same shape as a home's, so one invoice engine serves both.
  monthly_fee_minor integer not null default 3500000 check (monthly_fee_minor >= 0),
  included_memorials integer not null default 50 check (included_memorials >= 0),
  per_memorial_minor integer not null default 49900 check (per_memorial_minor >= 0),
  onboarding_fee_minor integer not null default 950000 check (onboarding_fee_minor >= 0),
  onboarding_paid boolean not null default false,
  branch_allowance integer check (branch_allowance is null or branch_allowance between 1 and 5000),
  contract_start date,
  renewal_date date,
  contract_end date,
  sla_tier text not null default 'standard' check (sla_tier in ('standard', 'priority', 'premium')),
  support_level text not null default 'business_hours' check (support_level in ('business_hours', 'extended', 'always_on')),
  primary_contact text not null default '',
  billing_contact text not null default '',
  commercial_contact text not null default '',
  account_manager text not null default '',
  -- Enterprise modules switched on for this contract (see MODULES in src/lib/enterprise.ts).
  modules text[] not null default '{}',
  -- The master brand, and which parts homes may not change.
  logo_url text not null default '' check (logo_url = '' or logo_url ~ '^https://'),
  brand_colour text not null default '' check (brand_colour = '' or brand_colour ~ '^#[0-9a-fA-F]{6}$'),
  brand_footer text not null default '' check (length(brand_footer) <= 200),
  brand_locks text[] not null default '{}',
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memora_regions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.memora_accounts(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  kind text not null default 'region' check (kind in ('region', 'province', 'district', 'brand', 'division')),
  created_at timestamptz not null default now()
);
create unique index if not exists memora_regions_name_idx on public.memora_regions (account_id, lower(name));

alter table public.memora_orgs add column if not exists account_id uuid references public.memora_accounts(id) on delete set null;
create index if not exists memora_orgs_account_idx on public.memora_orgs(account_id);
alter table public.memora_branches add column if not exists region_id uuid references public.memora_regions(id) on delete set null;
alter table public.memora_branches add column if not exists active boolean not null default true;
alter table public.memora_groups add column if not exists account_id uuid references public.memora_accounts(id) on delete cascade;
alter table public.memora_groups add column if not exists region_id uuid references public.memora_regions(id) on delete cascade;
create index if not exists memora_groups_account_idx on public.memora_groups(account_id);

-- Group names are unique within their place: Memora, an account (and region), a home (and branch).
drop index if exists public.memora_groups_name_idx;
create unique index memora_groups_name_idx on public.memora_groups (
  coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
);

-- Enterprise invoices: one per account per month, across all its homes.
create table if not exists public.memora_account_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.memora_accounts(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  memorials integer not null default 0,
  included_memorials integer not null default 0,
  overage_memorials integer not null default 0,
  monthly_fee_minor integer not null default 0,
  per_memorial_minor integer not null default 0,
  onboarding_minor integer not null default 0,
  adjustments_minor integer not null default 0,
  amount_minor integer not null default 0,
  vat_minor integer not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'PAID', 'VOID')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, period)
);
alter table public.memora_billing_adjustments add column if not exists account_id uuid references public.memora_accounts(id) on delete cascade;

-- Central templates: programme structures and wording, published to all, some regions, or some branches.
create table if not exists public.memora_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.memora_accounts(id) on delete cascade,
  org_id uuid references public.memora_orgs(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  kind text not null default 'programme' check (kind in ('programme', 'wording')),
  tradition text not null default '' check (length(tradition) <= 80),
  items jsonb not null default '[]',
  wording text not null default '' check (length(wording) <= 4000),
  audience text not null default 'all' check (audience in ('all', 'regions', 'branches')),
  audience_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_id is not null or org_id is not null)
);
create index if not exists memora_templates_account_idx on public.memora_templates(account_id);
create index if not exists memora_templates_org_idx on public.memora_templates(org_id);

-- Service accounts for integrations. Only a hash of each key is kept; the key is shown once.
create table if not exists public.memora_api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.memora_accounts(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists memora_api_keys_account_idx on public.memora_api_keys(account_id);

-- The audit log learns which account and home a change belongs to, so a group sees its own.
alter table public.memora_activity_log add column if not exists account_id uuid;
alter table public.memora_activity_log add column if not exists org_id uuid;
create index if not exists memora_activity_log_account_idx on public.memora_activity_log(account_id, created_at desc);

-- Invites can bring someone into an account group (e.g. the group's first administrators).
alter table public.memora_invites add column if not exists account_id uuid references public.memora_accounts(id) on delete cascade;
alter table public.memora_invites add column if not exists group_id uuid references public.memora_groups(id) on delete cascade;
do $$
begin
  alter table public.memora_invites drop constraint if exists memora_invites_kind_check;
  alter table public.memora_invites add constraint memora_invites_kind_check check (kind in ('org', 'family', 'account'));
  alter table public.memora_invites drop constraint if exists memora_invites_check;
  alter table public.memora_invites add constraint memora_invites_check check (kind = 'org' or (kind = 'family' and org_id is not null) or (kind = 'account' and account_id is not null and group_id is not null));
end $$;

do $$
declare t text;
begin
  foreach t in array array['memora_accounts', 'memora_regions', 'memora_account_invoices', 'memora_templates', 'memora_api_keys'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Who may edit a home's memorial: the home's own editors (as before), or the
-- group's administrators, or the regional managers of the branch's region.
-- A suspended or closed account, or a disabled home, grants nothing.
create or replace function public.memora_org_edits(p_org uuid, p_branch uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memora_group_members m
    join public.memora_groups g on g.id = m.group_id
    join public.memora_orgs o on o.id = g.org_id
    where m.user_id = (select auth.uid())
      and g.org_id = p_org
      and (g.branch_id is null or g.branch_id = p_branch)
      and g.active
      and o.status <> 'disabled'
      and not exists (select 1 from public.memora_accounts a where a.id = o.account_id and a.status in ('suspended', 'closed'))
      and g.roles && array['org_owner', 'org_admin', 'org_staff']
  ) or exists (
    select 1
    from public.memora_group_members m
    join public.memora_groups g on g.id = m.group_id
    join public.memora_accounts a on a.id = g.account_id
    join public.memora_orgs o on o.account_id = a.id
    where m.user_id = (select auth.uid())
      and o.id = p_org
      and g.org_id is null
      and g.active
      and o.status <> 'disabled'
      and a.status not in ('suspended', 'closed')
      and (
        (g.region_id is null and g.roles && array['group_admin'])
        or (g.region_id is not null and g.roles && array['regional_manager']
            and exists (select 1 from public.memora_branches b where b.id = p_branch and b.region_id = g.region_id))
      )
  );
$$;
revoke all on function public.memora_org_edits(uuid, uuid) from public, anon;
grant execute on function public.memora_org_edits(uuid, uuid) to authenticated;
