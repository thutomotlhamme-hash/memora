-- Onboarding and family links, and funeral-home staff editing their home's memorials.
--
-- * memora_invites: a link Memora sends a funeral home so it can set itself up
--   (kind 'org'), or a link a funeral home sends a family so they can start the
--   memorial under the home (kind 'family'). Links are signed with
--   MEMORA_LINK_SECRET (token = <id>.<hmac>), so nothing secret is stored here.
--   Server-only, like the other Pro tables.
-- * memora_org_edits(org): true when the signed-in person is in an active group of
--   that home whose roles can edit memorials, and the home isn't disabled.
--   Keep the role list in step with ORG_EDIT_ROLES in src/lib/rbac.ts.
-- * Home staff may read and edit (never delete) their home's memorials, their
--   people, stops, programme and photos. Everything else stays owner-only.

create table public.memora_invites (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('org', 'family')),
  org_id uuid references public.memora_orgs(id) on delete cascade,
  plan text check (plan is null or plan in ('payg', 'pro', 'pro_plus', 'enterprise')),
  label text not null default '' check (length(label) <= 120),
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid,
  case_id uuid references public.memora_cases(id) on delete set null,
  revoked_at timestamptz,
  check (kind = 'org' or org_id is not null)
);
create index memora_invites_org_idx on public.memora_invites(org_id);
alter table public.memora_invites enable row level security;
revoke all privileges on public.memora_invites from anon, authenticated;

create or replace function public.memora_org_edits(p_org uuid)
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
      and g.active
      and o.status <> 'disabled'
      and g.roles && array['org_owner', 'org_admin', 'org_director', 'org_staff']
  );
$$;
revoke all on function public.memora_org_edits(uuid) from public, anon;
grant execute on function public.memora_org_edits(uuid) to authenticated;

-- "Owns" now means: made it, or edits memorials for the home it belongs to.
create or replace function public.memora_owns_case(p_case_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.memora_cases c
    where c.id = p_case_id
      and (c.owner_id = (select auth.uid()) or (c.org_id is not null and public.memora_org_edits(c.org_id)))
  );
$$;

create or replace function public.memora_owns_case_folder(p_folder text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.memora_cases c
    where c.id::text = p_folder
      and (c.owner_id = (select auth.uid()) or (c.org_id is not null and public.memora_org_edits(c.org_id)))
  );
$$;

create policy "home staff read cases" on public.memora_cases for select to authenticated
  using (org_id is not null and public.memora_org_edits(org_id));
create policy "home staff edit cases" on public.memora_cases for update to authenticated
  using (org_id is not null and public.memora_org_edits(org_id))
  with check (org_id is not null and public.memora_org_edits(org_id));
