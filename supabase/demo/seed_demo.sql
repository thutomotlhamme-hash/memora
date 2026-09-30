-- Memora demo data: every step of the journey, visible in the command centre
-- and on each funeral home's dashboard. Safe to run again (it clears the old
-- demo first). Remove it all with remove_demo.sql.
--
-- Replace __DEMO_PASSWORD__ before running (never commit a real one). Every demo
-- person logs in with their cellphone number and that password, so you can see
-- Memora exactly as each role does.
--
-- What it makes (dates are relative to today, so it always looks current):
--   Letsatsi Funeral Services · Pro Plus · active · branches Soweto, Pimville, Tembisa
--     Owner, a manager and arrangers per branch; Tembisa has no one yet.
--     Memorials: a funeral today, one in 2 days, one in 12 days, a family's draft
--     from a family link, a staff draft with no date yet, and one that's done.
--     Family links: used, waiting, expired, switched off. Invoices: last month paid,
--     this month draft.
--   Umoya Funerals · Pro · trial · set up from an onboarding link · branch Umlazi
--   Families on their own: one live, one draft. Our own team: one draft.
--   Onboarding links: used (Umoya), waiting (Kopano Funerals), expired.

begin;

-- ---------------------------------------------------------------- clear old demo
-- Demo memorials are marked by a DEMO_SEED row in the activity log; demo audit rows by metadata.demo.
delete from public.memora_invites where label like '%(demo)%' or org_id in (select id from public.memora_orgs where slug like 'demo-%');
delete from public.memora_activity_log where case_id is null and metadata->>'demo' = 'true';
delete from public.memora_cases where id in (select case_id from public.memora_activity_log where action = 'DEMO_SEED')
  or owner_id in (select id from auth.users where raw_user_meta_data->>'demo' = 'true');
delete from public.memora_orgs where slug like 'demo-%';
delete from auth.users where raw_user_meta_data->>'demo' = 'true';

-- ---------------------------------------------------------------- helpers
create function pg_temp.demo_user(p_digits text, p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid(); v_email text := p_digits || '@phone.memora.local';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, is_anonymous)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt('__DEMO_PASSWORD__', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('phone', '+' || p_digits, 'signup', 'phone', 'full_name', p_name, 'email_verified', true, 'demo', true),
    now() - interval '30 days', now(), '', '', '', '', false);
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', false, 'phone_verified', false), 'email', now(), now(), now());
  return v_id;
end $$;

create function pg_temp.demo_group(p_org uuid, p_branch uuid, p_name text) returns uuid language sql as $$
  select id from public.memora_groups where org_id = p_org and coalesce(branch_id::text, '') = coalesce(p_branch::text, '') and name = p_name;
$$;

create function pg_temp.demo_branch(p_org uuid, p_name text, p_area text) returns uuid language plpgsql as $$
declare b uuid;
begin
  insert into public.memora_branches (org_id, name, area, created_at) values (p_org, p_name, p_area, now() - interval '60 days') returning id into b;
  insert into public.memora_groups (name, description, org_id, branch_id, roles) values
    ('Managers', 'Run this branch: its arrangers and its funerals.', p_org, b, array['org_admin']),
    ('Arrangers', 'Sit with families, prepare, publish and run this branch’s funerals.', p_org, b, array['org_staff']);
  return b;
end $$;

create function pg_temp.demo_member(p_group uuid, p_user uuid, p_by uuid) returns void language sql as $$
  insert into public.memora_group_members (group_id, user_id, added_by, created_at) values (p_group, p_user, p_by, now() - interval '20 days');
$$;

-- A memorial with its person, the service and the burial; published ones get a programme.
create function pg_temp.demo_case(
  p_owner uuid, p_org uuid, p_branch uuid, p_first text, p_last text, p_born date, p_died date,
  p_funeral date, p_status text, p_slug text,
  p_church text, p_church_lat numeric, p_church_lng numeric, p_grave text, p_grave_lat numeric, p_grave_lng numeric,
  p_obituary text, p_disposition text default 'burial'
) returns uuid language plpgsql as $$
declare c uuid;
begin
  insert into public.memora_cases (owner_id, org_id, branch_id, status, slug, disposition_type, programme_mode, obituary, family_message,
    published_at, archive_at, created_at, updated_at)
  values (p_owner, p_org, p_branch, p_status, case when p_status <> 'DRAFT' then p_slug end, p_disposition, 'formal', p_obituary,
    'Thank you for standing with our family.',
    case when p_status <> 'DRAFT' then now() - interval '3 days' end,
    case when p_status <> 'DRAFT' then now() + interval '362 days' end,
    now() - interval '6 days', now() - (random() * interval '2 days'))
  returning id into c;
  insert into public.memora_people (case_id, first_name, last_name, birth_date, passing_date) values (c, p_first, p_last, p_born, p_died);
  insert into public.memora_activity_log (case_id, actor_user_id, action, metadata) values (c, p_owner, 'DEMO_SEED', '{"demo":true}');
  if p_funeral is not null then
    insert into public.memora_stops (case_id, stop_key, stop_type, title, event_date, event_time, departure_time, address_text, latitude, longitude, sort_order) values
      (c, 'service', 'church', 'Funeral service', p_funeral, '08:00', '10:30', p_church, p_church_lat, p_church_lng, 0),
      (c, 'burial', case when p_disposition = 'cremation' then 'crematorium' else 'cemetery' end, case when p_disposition = 'cremation' then 'Cremation' else 'Burial' end,
        p_funeral, '11:15', null, p_grave, p_grave_lat, p_grave_lng, 1);
  end if;
  if p_status <> 'DRAFT' then
    insert into public.memora_programme_items (case_id, item_key, part, item_type, start_time, title, presenter, sort_order) values
      (c, 'i1', 'service', 'hymn', '08:00', 'Opening hymn', 'Congregation', 0),
      (c, 'i2', 'service', 'prayer', '08:10', 'Opening prayer', 'Rev. Mokoena', 1),
      (c, 'i3', 'service', 'obituary', '08:25', 'Obituary', 'Family representative', 2),
      (c, 'i4', 'service', 'tribute', '08:45', 'Tributes', 'Friends and colleagues', 3),
      (c, 'i5', 'service', 'sermon', '09:30', 'Sermon', 'Pastor Dube', 4),
      (c, 'i6', 'graveside', 'committal', '11:15', 'Committal', 'Pastor Dube', 5),
      (c, 'i7', 'graveside', 'thanks', '11:45', 'Vote of thanks', 'Family', 6);
  end if;
  return c;
end $$;

-- ---------------------------------------------------------------- the demo
do $$
declare
  me uuid := (select id from auth.users where email = '27625683235@phone.memora.local');
  -- Letsatsi
  lerato uuid; sipho uuid; nomsa uuid; themba uuid; ayanda uuid; kagiso uuid;
  -- Umoya
  zanele uuid; priya uuid;
  -- Families
  buhle uuid; johan uuid; aisha uuid;
  letsatsi uuid; umoya uuid; soweto uuid; pimville uuid; tembisa uuid; umlazi uuid;
  c_khumalo uuid; c_radebe uuid; inv_umoya uuid;
  lm date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  lerato := pg_temp.demo_user('27625683101', 'Lerato Mokoena');
  sipho  := pg_temp.demo_user('27625683102', 'Sipho Dlamini');
  nomsa  := pg_temp.demo_user('27625683103', 'Nomsa Khumalo');
  themba := pg_temp.demo_user('27625683104', 'Themba Nkosi');
  ayanda := pg_temp.demo_user('27625683105', 'Ayanda Zulu');
  kagiso := pg_temp.demo_user('27625683106', 'Kagiso Molefe');
  zanele := pg_temp.demo_user('27625683107', 'Zanele Mthembu');
  priya  := pg_temp.demo_user('27625683108', 'Priya Naidoo');
  buhle  := pg_temp.demo_user('27625683109', 'Buhle Khumalo');
  johan  := pg_temp.demo_user('27625683110', 'Johan van Wyk');
  aisha  := pg_temp.demo_user('27625683111', 'Aisha Patel');

  -- Letsatsi Funeral Services: active, three branches.
  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, per_memorial_minor, onboarding_fee_minor, onboarding_paid,
    contract_start, contract_end, branches, contact_name, contact_phone, contact_email, brand_colour, notes, created_by, created_at)
  values ('Letsatsi Funeral Services', 'demo-letsatsi', 'pro_plus', 'active', 1450000, 99900, 950000, true,
    lm, (lm + interval '12 months')::date, 3, 'Lerato Mokoena', '062 568 3101', 'office@letsatsi.example', '#8C5A2B', 'DEMO DATA', me, now() - interval '70 days')
  returning id into letsatsi;
  insert into public.memora_groups (name, description, org_id, roles) values ('Owners', 'Own the funeral home’s Memora: branches, people, branding, billing, every memorial.', letsatsi, array['org_owner']);
  soweto   := pg_temp.demo_branch(letsatsi, 'Soweto', 'Vilakazi Street, Orlando West');
  pimville := pg_temp.demo_branch(letsatsi, 'Pimville', 'Koma Road, Pimville');
  tembisa  := pg_temp.demo_branch(letsatsi, 'Tembisa', 'Andrew Mapheto Drive, Tembisa');
  perform pg_temp.demo_member(pg_temp.demo_group(letsatsi, null, 'Owners'), lerato, me);
  perform pg_temp.demo_member(pg_temp.demo_group(letsatsi, soweto, 'Managers'), sipho, lerato);
  perform pg_temp.demo_member(pg_temp.demo_group(letsatsi, soweto, 'Arrangers'), nomsa, sipho);
  perform pg_temp.demo_member(pg_temp.demo_group(letsatsi, soweto, 'Arrangers'), themba, sipho);
  perform pg_temp.demo_member(pg_temp.demo_group(letsatsi, pimville, 'Managers'), ayanda, lerato);
  perform pg_temp.demo_member(pg_temp.demo_group(letsatsi, pimville, 'Arrangers'), kagiso, ayanda);

  -- Umoya Funerals: set itself up from an onboarding link; still in trial.
  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, per_memorial_minor, onboarding_fee_minor, branches,
    contact_name, contact_phone, notes, created_by, created_at)
  values ('Umoya Funerals', 'demo-umoya', 'pro', 'trial', 650000, 99900, 950000, 1, 'Zanele Mthembu', '062 568 3107', 'DEMO DATA · Area: Umlazi, Durban', zanele, now() - interval '9 days')
  returning id into umoya;
  insert into public.memora_groups (name, description, org_id, roles) values ('Owners', 'Own the funeral home’s Memora: branches, people, branding, billing, every memorial.', umoya, array['org_owner']);
  umlazi := pg_temp.demo_branch(umoya, 'Umlazi', 'Mangosuthu Highway, Umlazi');
  perform pg_temp.demo_member(pg_temp.demo_group(umoya, null, 'Owners'), zanele, zanele);
  perform pg_temp.demo_member(pg_temp.demo_group(umoya, umlazi, 'Arrangers'), priya, zanele);

  -- Letsatsi's funerals, one for every stage.
  perform pg_temp.demo_case(lerato, letsatsi, tembisa, 'Mpho', 'Maluleke', '1958-04-11', current_date - 6, current_date, 'PUBLISHED', 'demo-mpho-maluleke',
    'Tembisa Methodist Church', -25.9964, 28.2268, 'Tembisa Cemetery', -25.9870, 28.2400,
    'Mpho was a teacher for thirty years and a grandfather to half the street.');
  c_radebe := pg_temp.demo_case(nomsa, letsatsi, soweto, 'Thabo', 'Radebe', '1947-09-02', current_date - 5, current_date + 2, 'PUBLISHED', 'demo-thabo-radebe',
    'Regina Mundi Church, Moroka', -26.2556, 27.8779, 'Avalon Cemetery', -26.2807, 27.8752,
    'Thabo drove a taxi from Soweto to town for forty years and knew every passenger by name.');
  c_khumalo := pg_temp.demo_case(buhle, letsatsi, soweto, 'Nomvula', 'Khumalo', '1939-01-20', current_date - 4, current_date + 9, 'DRAFT', null,
    'St Mary’s Anglican Church, Orlando', -26.2395, 27.9200, 'Avalon Cemetery', -26.2807, 27.8752,
    'Gogo Nomvula raised eleven grandchildren and sang alto in the church choir for sixty years.');
  perform pg_temp.demo_case(themba, letsatsi, soweto, 'Petrus', 'Mahlangu', '1952-06-30', current_date - 3, current_date + 12, 'PUBLISHED', 'demo-petrus-mahlangu',
    'Dutch Reformed Church, Meadowlands', -26.2180, 27.8950, 'Doornkop Cemetery', -26.2200, 27.8300,
    'Petrus built half the houses in Meadowlands and never once charged a widow.');
  perform pg_temp.demo_case(kagiso, letsatsi, pimville, 'Dikeledi', 'Sebola', '1965-12-12', current_date - 1, null, 'DRAFT', null,
    '', 0, 0, '', 0, 0, '');
  perform pg_temp.demo_case(ayanda, letsatsi, pimville, 'Jabulani', 'Ndlovu', '1950-03-15', current_date - 28, current_date - 20, 'PUBLISHED', 'demo-jabulani-ndlovu',
    'Pimville Methodist Church', -26.2680, 27.8940, 'Avalon Cemetery', -26.2807, 27.8752,
    'Jabulani coached the Pimville youth football team for twenty-five seasons.');

  -- Umoya's first memorial.
  perform pg_temp.demo_case(priya, umoya, umlazi, 'Sibusiso', 'Cele', '1971-08-08', current_date - 2, current_date + 5, 'DRAFT', null,
    'Umlazi Catholic Church', -29.9700, 30.8800, 'Umlazi Cemetery', -29.9800, 30.8900,
    'Sibusiso was a nurse at Prince Mshiyeni hospital and the loudest voice at every Sharks game.');

  -- Families on their own, and our own team.
  perform pg_temp.demo_case(johan, null, null, 'Hendrik', 'van Wyk', '1944-05-05', current_date - 7, current_date + 6, 'PUBLISHED', 'demo-hendrik-van-wyk',
    'NG Moederkerk, Stellenbosch', -33.9360, 18.8610, 'Stellenbosch Crematorium', -33.9300, 18.8500,
    'Hendrik farmed the same vineyard his grandfather planted, and taught every grandchild to prune a vine.', 'cremation');
  perform pg_temp.demo_case(aisha, null, null, 'Yusuf', 'Patel', '1960-10-10', current_date - 1, null, 'DRAFT', null, '', 0, 0, '', 0, 0, '');
  if me is not null then
    perform pg_temp.demo_case(me, null, null, 'Samuel', 'Sithole', '1955-07-07', current_date - 2, current_date + 8, 'DRAFT', null,
      'Holy Cross Church, Orlando West', -26.2360, 27.9080, 'Avalon Cemetery', -26.2807, 27.8752,
      'A memorial our own team is building, to show the difference in the command centre.');
  end if;

  -- Family links from Letsatsi: used, waiting, expired, switched off.
  insert into public.memora_invites (kind, org_id, branch_id, label, created_by, created_at, expires_at, used_at, used_by, case_id) values
    ('family', letsatsi, soweto, 'Khumalo family', nomsa, now() - interval '5 days', now() + interval '25 days', now() - interval '4 days', buhle, c_khumalo);
  insert into public.memora_invites (kind, org_id, branch_id, label, created_by, created_at, expires_at) values
    ('family', letsatsi, pimville, 'Zwane family', kagiso, now() - interval '1 day', now() + interval '29 days'),
    ('family', letsatsi, soweto, 'Mabena family', themba, now() - interval '40 days', now() - interval '10 days');
  insert into public.memora_invites (kind, org_id, branch_id, label, created_by, created_at, expires_at, revoked_at) values
    ('family', letsatsi, soweto, 'Shabalala family', sipho, now() - interval '3 days', now() + interval '27 days', now() - interval '2 days');

  -- Onboarding links: Umoya used theirs; Kopano's is waiting; Hope's expired.
  insert into public.memora_invites (kind, org_id, plan, label, created_by, created_at, expires_at, used_at, used_by)
    values ('org', umoya, 'pro', 'Umoya Funerals', me, now() - interval '10 days', now() + interval '4 days', now() - interval '9 days', zanele) returning id into inv_umoya;
  insert into public.memora_invites (kind, plan, label, created_by, created_at, expires_at) values
    ('org', 'pro', 'Kopano Funerals (demo)', me, now() - interval '1 day', now() + interval '13 days'),
    ('org', 'pro_plus', 'Hope Funeral Parlour (demo)', me, now() - interval '30 days', now() - interval '16 days');

  -- Letsatsi's bills: last month paid (with onboarding), this month in draft.
  insert into public.memora_org_invoices (org_id, period, memorials, monthly_fee_minor, per_memorial_minor, onboarding_minor, amount_minor, status, created_at) values
    (letsatsi, to_char(lm, 'YYYY-MM'), 4, 1450000, 99900, 950000, 1450000 + 4 * 99900 + 950000, 'PAID', lm + interval '31 days'),
    (letsatsi, to_char(current_date, 'YYYY-MM'), 3, 1450000, 99900, 0, 1450000 + 3 * 99900, 'DRAFT', now());

  -- The audit trail that would have been written along the way.
  insert into public.memora_activity_log (case_id, actor_user_id, action, metadata, created_at) values
    (null, me, 'ADMIN_ORG_CREATED', '{"demo":true,"name":"Letsatsi Funeral Services","plan":"pro_plus"}', now() - interval '70 days'),
    (null, lerato, 'ADMIN_BRANCH_ADDED', '{"demo":true,"branch":"Pimville"}', now() - interval '60 days'),
    (null, lerato, 'ADMIN_BRANCH_ADDED', '{"demo":true,"branch":"Tembisa"}', now() - interval '60 days'),
    (null, lerato, 'ADMIN_MEMBER_ADDED', '{"demo":true,"group":"Managers","who":"Sipho Dlamini"}', now() - interval '20 days'),
    (null, sipho, 'ADMIN_MEMBER_ADDED', '{"demo":true,"group":"Arrangers","who":"Nomsa Khumalo"}', now() - interval '20 days'),
    (null, me, 'ADMIN_ORG_PLAN_SET', '{"demo":true,"plan":"pro_plus","monthly":14500,"perMemorial":999}', now() - interval '40 days'),
    (null, me, 'ADMIN_ORG_ENABLED', '{"demo":true,"status":"active"}', now() - interval '40 days'),
    (null, me, 'ADMIN_ONBOARDING_LINK_CREATED', '{"demo":true,"for":"Umoya Funerals","plan":"pro"}', now() - interval '10 days'),
    (null, zanele, 'ADMIN_ORG_CREATED', '{"demo":true,"name":"Umoya Funerals","plan":"pro"}', now() - interval '9 days'),
    (null, nomsa, 'ADMIN_FAMILY_LINK_CREATED', '{"demo":true,"for":"Khumalo family"}', now() - interval '5 days'),
    (c_radebe, nomsa, 'ADMIN_MEMORIAL_PUBLISHED', '{"demo":true,"billedTo":"Letsatsi Funeral Services"}', now() - interval '3 days'),
    (null, sipho, 'ADMIN_LINK_REVOKED', '{"demo":true,"kind":"family","for":"Shabalala family"}', now() - interval '2 days'),
    (null, me, 'ADMIN_INVOICES_GENERATED', jsonb_build_object('demo', true, 'period', to_char(current_date, 'YYYY-MM'), 'invoices', 1), now());
end $$;

commit;
