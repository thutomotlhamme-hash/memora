-- Branches, and three funeral-home roles instead of five.
--
-- * memora_branches: a funeral home's branches. The owner adds and removes them.
-- * Groups may belong to a branch (memora_groups.branch_id). Owners sit in a
--   home-wide group; each branch has its Managers and Arrangers groups.
-- * Memorials and family links belong to a branch (branch_id). Branch staff edit
--   their own branch's memorials; home-wide groups (owners) edit every branch.
-- * Roles: org_owner (Owner), org_admin (Branch manager), org_staff (Arranger).
--   Arrangers now do what directors did (publish, run the day), so the director
--   and viewer roles are removed. Directors move into their branch's Arrangers.
--   Keep the edit-role list in step with ORG_EDIT_ROLES in src/lib/rbac.ts.

create table public.memora_branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.memora_orgs(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  area text not null default '' check (length(area) <= 120),
  created_at timestamptz not null default now()
);
create unique index memora_branches_name_idx on public.memora_branches (org_id, lower(name));
alter table public.memora_branches enable row level security;
revoke all privileges on public.memora_branches from anon, authenticated;

alter table public.memora_groups add column if not exists branch_id uuid references public.memora_branches(id) on delete cascade;
alter table public.memora_cases add column if not exists branch_id uuid references public.memora_branches(id) on delete set null;
alter table public.memora_invites add column if not exists branch_id uuid references public.memora_branches(id) on delete set null;
create index if not exists memora_cases_branch_idx on public.memora_cases(branch_id);

-- Group names are unique per home and branch.
drop index if exists public.memora_groups_name_idx;
create unique index memora_groups_name_idx on public.memora_groups (
  coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
);

-- Existing homes: one "Main branch" holding their managers and arrangers (directors join the arrangers).
do $$
declare o record; b uuid; arr uuid; mgr uuid;
begin
  for o in select id from public.memora_orgs loop
    insert into public.memora_branches (org_id, name) values (o.id, 'Main branch') returning id into b;
    insert into public.memora_groups (name, description, org_id, branch_id, roles)
      values ('Managers', 'Run this branch: its arrangers and its funerals.', o.id, b, array['org_admin']) returning id into mgr;
    insert into public.memora_groups (name, description, org_id, branch_id, roles)
      values ('Arrangers', 'Sit with families, prepare, publish and run this branch’s funerals.', o.id, b, array['org_staff']) returning id into arr;
    insert into public.memora_group_members (group_id, user_id, added_by, created_at)
      select distinct on (m.user_id) case when 'org_admin' = any(g.roles) then mgr else arr end, m.user_id, m.added_by, m.created_at
      from public.memora_group_members m join public.memora_groups g on g.id = m.group_id
      where g.org_id = o.id and g.branch_id is null and g.roles && array['org_admin', 'org_director', 'org_staff']
      order by m.user_id, ('org_admin' = any(g.roles)) desc
      on conflict do nothing;
    delete from public.memora_groups where org_id = o.id and branch_id is null and not (roles && array['org_owner']);
    update public.memora_cases set branch_id = b where org_id = o.id and branch_id is null;
    update public.memora_invites set branch_id = b where org_id = o.id and branch_id is null;
  end loop;
end $$;
update public.memora_groups set roles = array_remove(array_remove(roles, 'org_director'), 'org_viewer')
  where roles && array['org_director', 'org_viewer'];
delete from public.memora_groups where roles = '{}';

-- Who may edit a memorial of a home: a home-wide editor, or an editor in that memorial's branch.
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
      and g.roles && array['org_owner', 'org_admin', 'org_staff']
  );
$$;
revoke all on function public.memora_org_edits(uuid, uuid) from public, anon;
grant execute on function public.memora_org_edits(uuid, uuid) to authenticated;

create or replace function public.memora_owns_case(p_case_id uuid)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.memora_cases c
    where c.id = p_case_id
      and (c.owner_id = (select auth.uid()) or (c.org_id is not null and public.memora_org_edits(c.org_id, c.branch_id)))
  );
$$;

create or replace function public.memora_owns_case_folder(p_folder text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.memora_cases c
    where c.id::text = p_folder
      and (c.owner_id = (select auth.uid()) or (c.org_id is not null and public.memora_org_edits(c.org_id, c.branch_id)))
  );
$$;

drop policy if exists "home staff read cases" on public.memora_cases;
drop policy if exists "home staff edit cases" on public.memora_cases;
create policy "home staff read cases" on public.memora_cases for select to authenticated
  using (org_id is not null and public.memora_org_edits(org_id, branch_id));
create policy "home staff edit cases" on public.memora_cases for update to authenticated
  using (org_id is not null and public.memora_org_edits(org_id, branch_id))
  with check (org_id is not null and public.memora_org_edits(org_id, branch_id));
drop function if exists public.memora_org_edits(uuid);
