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
--   Motheo Funeral Group · Enterprise · active · regions Gauteng and North West,
--     homes Motheo Pretoria (Pretoria Central, Centurion), Motheo Soweto (Soweto),
--     Motheo North West (Mahikeng, Rustenburg switched off). Head office (admin,
--     finance, brand, reporting), a regional manager, branch staff, templates, a
--     paid invoice, an invite waiting, an audit trail. You are a group admin too.
--   First years ending: one Letsatsi and one Motheo memorial with about two
--     months of their public year left (one family has asked about the unveiling).

begin;

-- ---------------------------------------------------------------- clear old demo
-- Demo memorials are marked by a DEMO_SEED row in the activity log; demo audit rows by metadata.demo.
delete from public.memora_invites where label like '%(demo)%' or org_id in (select id from public.memora_orgs where slug like 'demo-%');
delete from public.memora_activity_log where case_id is null and metadata->>'demo' = 'true';
delete from public.memora_cases where id in (select case_id from public.memora_activity_log where action = 'DEMO_SEED')
  or owner_id in (select id from auth.users where raw_user_meta_data->>'demo' = 'true');
delete from public.memora_orgs where slug like 'demo-%';
delete from public.memora_activity_log where account_id in (select id from public.memora_accounts where slug like 'demo-%');
delete from public.memora_accounts where slug like 'demo-%';
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
    -- Demo numbers can't receive codes, so they start confirmed (see docs/PHONE_CODES.md).
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'phone_confirmed_at', now(), 'phone_confirmed_how', 'staff'),
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
  p_obituary text, p_disposition text default 'burial', p_published_days_ago int default 3
) returns uuid language plpgsql as $$
declare c uuid; pub timestamptz := now() - make_interval(days => p_published_days_ago);
begin
  insert into public.memora_cases (owner_id, org_id, branch_id, status, slug, disposition_type, programme_mode, obituary, family_message,
    published_at, archive_at, created_at, updated_at)
  values (p_owner, p_org, p_branch, p_status, case when p_status <> 'DRAFT' then p_slug end, p_disposition, 'formal', p_obituary,
    'Thank you for standing with our family.',
    case when p_status <> 'DRAFT' then pub end,
    case when p_status <> 'DRAFT' then pub + interval '365 days' end,
    least(pub, now()) - interval '3 days', now() - (random() * interval '2 days'))
  returning id into c;
  insert into public.memora_people (case_id, first_name, last_name, birth_date, passing_date) values (c, p_first, p_last, p_born, p_died);
  insert into public.memora_activity_log (case_id, actor_user_id, action, metadata) values (c, p_owner, 'DEMO_SEED', '{"demo":true}');
  -- A home's published memorial is billed once, in the month it was published.
  if p_org is not null and p_status <> 'DRAFT' then
    insert into public.memora_org_usage (case_id, org_id, branch_id, period, published_at, published_by)
    values (c, p_org, p_branch, to_char(pub at time zone 'Africa/Johannesburg', 'YYYY-MM'), pub, p_owner);
  end if;
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
  c_khumalo uuid; c_radebe uuid; c_year uuid; inv_umoya uuid;
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
  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, included_memorials, per_memorial_minor, onboarding_fee_minor, onboarding_paid,
    contract_start, contract_end, branches, contact_name, contact_phone, contact_email, brand_colour, notes, created_by, created_at)
  values ('Letsatsi Funeral Services', 'demo-letsatsi', 'pro_plus', 'active', 1450000, 15, 69900, 650000, true,
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
  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, included_memorials, per_memorial_minor, onboarding_fee_minor, branches,
    contact_name, contact_phone, notes, created_by, created_at)
  values ('Umoya Funerals', 'demo-umoya', 'pro', 'trial', 650000, 5, 89900, 350000, 1, 'Zanele Mthembu', '062 568 3107', 'DEMO DATA · Area: Umlazi, Durban', zanele, now() - interval '9 days')
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
  -- Published about ten months ago: the first year is ending, the unveiling is near.
  c_year := pg_temp.demo_case(sipho, letsatsi, soweto, 'Agnes', 'Mofokeng', '1941-02-14', current_date - 307, current_date - 300, 'PUBLISHED', 'demo-agnes-mofokeng',
    'Regina Mundi Church, Moroka', -26.2556, 27.8779, 'Avalon Cemetery', -26.2807, 27.8752,
    'Mme Agnes ran the Orlando spaza shop for forty years and never let a child leave hungry.', 'burial', 302);
  insert into public.memora_event_interest (case_id, user_id, kind, planned_for, created_at)
    values (c_year, buhle, 'unveiling', current_date + 55, now() - interval '2 days');

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
  -- Pro Plus: 15 included, so four and three memorials cost only the fee (plus onboarding, once).
  insert into public.memora_org_invoices (org_id, period, memorials, included_memorials, overage_memorials, monthly_fee_minor, per_memorial_minor, onboarding_minor, amount_minor, vat_minor, status, created_at) values
    (letsatsi, to_char(lm, 'YYYY-MM'), 4, 15, 0, 1450000, 69900, 650000, 1450000 + 650000, round((1450000 + 650000) * 0.15), 'PAID', lm + interval '31 days'),
    (letsatsi, to_char(current_date, 'YYYY-MM'), 3, 15, 0, 1450000, 69900, 0, 1450000, round(1450000 * 0.15), 'DRAFT', now());

  -- The audit trail that would have been written along the way.
  insert into public.memora_activity_log (case_id, actor_user_id, action, metadata, created_at) values
    (null, me, 'ADMIN_ORG_CREATED', '{"demo":true,"name":"Letsatsi Funeral Services","plan":"pro_plus"}', now() - interval '70 days'),
    (null, lerato, 'ADMIN_BRANCH_ADDED', '{"demo":true,"branch":"Pimville"}', now() - interval '60 days'),
    (null, lerato, 'ADMIN_BRANCH_ADDED', '{"demo":true,"branch":"Tembisa"}', now() - interval '60 days'),
    (null, lerato, 'ADMIN_MEMBER_ADDED', '{"demo":true,"group":"Managers","who":"Sipho Dlamini"}', now() - interval '20 days'),
    (null, sipho, 'ADMIN_MEMBER_ADDED', '{"demo":true,"group":"Arrangers","who":"Nomsa Khumalo"}', now() - interval '20 days'),
    (null, me, 'ADMIN_ORG_PLAN_SET', '{"demo":true,"plan":"pro_plus","monthly":14500,"included":15,"perMemorial":699}', now() - interval '40 days'),
    (null, me, 'ADMIN_ORG_ENABLED', '{"demo":true,"status":"active"}', now() - interval '40 days'),
    (null, me, 'ADMIN_ONBOARDING_LINK_CREATED', '{"demo":true,"for":"Umoya Funerals","plan":"pro"}', now() - interval '10 days'),
    (null, zanele, 'ADMIN_ORG_CREATED', '{"demo":true,"name":"Umoya Funerals","plan":"pro"}', now() - interval '9 days'),
    (null, nomsa, 'ADMIN_FAMILY_LINK_CREATED', '{"demo":true,"for":"Khumalo family"}', now() - interval '5 days'),
    (c_radebe, nomsa, 'ADMIN_MEMORIAL_PUBLISHED', '{"demo":true,"billedTo":"Letsatsi Funeral Services"}', now() - interval '3 days'),
    (null, sipho, 'ADMIN_LINK_REVOKED', '{"demo":true,"kind":"family","for":"Shabalala family"}', now() - interval '2 days'),
    (null, me, 'ADMIN_INVOICES_GENERATED', jsonb_build_object('demo', true, 'period', to_char(current_date, 'YYYY-MM'), 'invoices', 1), now());
end $$;


-- ---------------------------------------------------------------- Motheo Funeral Group (Enterprise)
do $$
declare
  me uuid := (select id from auth.users where email = '27625683235@phone.memora.local');
  thandi uuid; lerato_d uuid; karabo uuid; palesa uuid; neo uuid; tshepo uuid; dineo uuid; boitumelo uuid; fam uuid;
  acc uuid; gauteng uuid; nw uuid;
  pta uuid; sow uuid; nwh uuid;
  b_pta uuid; b_cen uuid; b_sow uuid; b_mah uuid; b_rus uuid;
  g_admins uuid; g_fin uuid; g_brand uuid; g_rep uuid; g_rm_gp uuid; g_rm_nw uuid;
  c_draft uuid; c_old uuid;
  lm date := (date_trunc('month', current_date) - interval '1 month')::date;
begin
  thandi    := pg_temp.demo_user('27625683120', 'Thandi Motheo');
  lerato_d  := pg_temp.demo_user('27625683121', 'Lerato Dube');
  karabo    := pg_temp.demo_user('27625683122', 'Karabo Sithebe');
  palesa    := pg_temp.demo_user('27625683123', 'Palesa Nthite');
  neo       := pg_temp.demo_user('27625683124', 'Neo Mabuza');
  tshepo    := pg_temp.demo_user('27625683125', 'Tshepo Maseko');
  dineo     := pg_temp.demo_user('27625683126', 'Dineo Phiri');
  boitumelo := pg_temp.demo_user('27625683127', 'Boitumelo Kgosi');
  fam       := pg_temp.demo_user('27625683128', 'Refilwe Molapo');

  insert into public.memora_accounts (name, slug, blueprint, status, monthly_fee_minor, included_memorials, per_memorial_minor, onboarding_fee_minor, onboarding_paid,
    branch_allowance, contract_start, renewal_date, contract_end, sla_tier, support_level, primary_contact, billing_contact, commercial_contact, account_manager,
    modules, brand_colour, brand_footer, brand_locks, notes, created_by, created_at)
  values ('Motheo Funeral Group', 'demo-motheo', 'standard', 'active', 3500000, 50, 49900, 950000, true,
    40, lm, (lm + interval '11 months')::date, (lm + interval '12 months' - interval '1 day')::date, 'priority', 'extended',
    'Thandi Motheo · 062 568 3120', 'accounts@motheo.example', 'Thandi Motheo', 'Memora team',
    array['regions','advanced_reporting','audit_log','central_templates','brand_governance','advanced_finance','sla_controls','bulk_import','api_access'],
    '#3F4E8C', 'A Motheo Funeral Group home', array['colour','footer'], 'DEMO DATA', me, now() - interval '45 days')
  returning id into acc;

  insert into public.memora_regions (account_id, name, kind) values (acc, 'Gauteng', 'region') returning id into gauteng;
  insert into public.memora_regions (account_id, name, kind) values (acc, 'North West', 'region') returning id into nw;

  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, included_memorials, per_memorial_minor, onboarding_fee_minor, onboarding_paid, branches, account_id, notes, created_by, created_at)
    values ('Motheo Pretoria', 'demo-motheo-pretoria', 'enterprise', 'active', 0, 0, 0, 0, true, 500, acc, 'DEMO DATA', me, now() - interval '45 days') returning id into pta;
  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, included_memorials, per_memorial_minor, onboarding_fee_minor, onboarding_paid, branches, account_id, brand_colour, notes, created_by, created_at)
    values ('Motheo Soweto', 'demo-motheo-soweto', 'enterprise', 'active', 0, 0, 0, 0, true, 500, acc, '#2F6B5A', 'DEMO DATA', me, now() - interval '45 days') returning id into sow;
  insert into public.memora_orgs (name, slug, plan, status, monthly_fee_minor, included_memorials, per_memorial_minor, onboarding_fee_minor, onboarding_paid, branches, account_id, notes, created_by, created_at)
    values ('Motheo North West', 'demo-motheo-north-west', 'enterprise', 'active', 0, 0, 0, 0, true, 500, acc, 'DEMO DATA', me, now() - interval '45 days') returning id into nwh;
  insert into public.memora_groups (name, description, org_id, roles) values
    ('Owners', 'Own the funeral home’s Memora: branches, people, branding, billing, every memorial.', pta, array['org_owner']),
    ('Owners', 'Own the funeral home’s Memora: branches, people, branding, billing, every memorial.', sow, array['org_owner']),
    ('Owners', 'Own the funeral home’s Memora: branches, people, branding, billing, every memorial.', nwh, array['org_owner']);

  b_pta := pg_temp.demo_branch(pta, 'Pretoria Central', 'Church Street, Arcadia');
  b_cen := pg_temp.demo_branch(pta, 'Centurion', 'Lenchen Avenue, Centurion');
  b_sow := pg_temp.demo_branch(sow, 'Soweto', 'Chris Hani Road, Diepkloof');
  b_mah := pg_temp.demo_branch(nwh, 'Mahikeng', 'Nelson Mandela Drive, Mahikeng');
  b_rus := pg_temp.demo_branch(nwh, 'Rustenburg', 'Beyers Naudé Drive, Rustenburg');
  update public.memora_branches set region_id = gauteng where id in (b_pta, b_cen, b_sow);
  update public.memora_branches set region_id = nw where id in (b_mah, b_rus);
  update public.memora_branches set active = false where id = b_rus;

  insert into public.memora_groups (name, description, account_id, roles) values ('Group administrators', 'Controls the entire group.', acc, array['group_admin']) returning id into g_admins;
  insert into public.memora_groups (name, description, account_id, roles) values ('Finance', 'Contract, usage and invoices.', acc, array['group_finance']) returning id into g_fin;
  insert into public.memora_groups (name, description, account_id, roles) values ('Brand and marketing', 'Master brand and central templates.', acc, array['group_brand']) returning id into g_brand;
  insert into public.memora_groups (name, description, account_id, roles) values ('Reporting and audit', 'Read-only across the group.', acc, array['group_reporting']) returning id into g_rep;
  insert into public.memora_groups (name, description, account_id, roles) values ('Integrations', 'Integration keys.', acc, array['group_integrations']);
  insert into public.memora_groups (name, description, account_id, region_id, roles) values ('Regional managers · Gauteng', 'Runs the Gauteng branches.', acc, gauteng, array['regional_manager']) returning id into g_rm_gp;
  insert into public.memora_groups (name, description, account_id, region_id, roles) values ('Regional managers · North West', 'Runs the North West branches.', acc, nw, array['regional_manager']) returning id into g_rm_nw;

  perform pg_temp.demo_member(g_admins, thandi, me);
  if me is not null then perform pg_temp.demo_member(g_admins, me, me); end if;
  perform pg_temp.demo_member(g_fin, karabo, thandi);
  perform pg_temp.demo_member(g_brand, palesa, thandi);
  perform pg_temp.demo_member(g_rep, neo, thandi);
  perform pg_temp.demo_member(g_rm_gp, lerato_d, thandi);
  perform pg_temp.demo_member(pg_temp.demo_group(pta, b_pta, 'Managers'), tshepo, lerato_d);
  perform pg_temp.demo_member(pg_temp.demo_group(pta, b_pta, 'Arrangers'), dineo, tshepo);
  perform pg_temp.demo_member(pg_temp.demo_group(nwh, b_mah, 'Arrangers'), boitumelo, thandi);

  -- Funerals across the group: today, soon, one not published two days out (an exception), one done, one a year on.
  perform pg_temp.demo_case(dineo, pta, b_pta, 'Johannes', 'Mathebula', '1949-11-03', current_date - 5, current_date, 'PUBLISHED', 'demo-johannes-mathebula',
    'Pretoria Central Methodist Church', -25.7470, 28.1880, 'Rebecca Street Cemetery', -25.7470, 28.1640,
    'Johannes kept the books for the Pretoria railway workshops for thirty-five years and sang bass in three choirs.');
  perform pg_temp.demo_case(tshepo, pta, b_cen, 'Margaret', 'Swanepoel', '1952-08-19', current_date - 4, current_date + 3, 'PUBLISHED', 'demo-margaret-swanepoel',
    'NG Kerk Lyttelton', -25.8430, 28.1960, 'Zwartkop Cemetery', -25.8360, 28.1570,
    'Margaret taught Grade One in Centurion for twenty-eight years and remembered every name.');
  perform pg_temp.demo_case(thandi, sow, b_sow, 'Sello', 'Ramafoko', '1960-04-22', current_date - 3, current_date + 5, 'PUBLISHED', 'demo-sello-ramafoko',
    'Regina Mundi Church, Moroka', -26.2556, 27.8779, 'Avalon Cemetery', -26.2807, 27.8752,
    'Sello ran the Diepkloof boxing club and never missed a Kaizer Chiefs home game.');
  c_draft := pg_temp.demo_case(boitumelo, nwh, b_mah, 'Kelebogile', 'Motsamai', '1945-01-09', current_date - 2, current_date + 2, 'DRAFT', null,
    'Mahikeng Lutheran Church', -25.8560, 25.6400, 'Mahikeng Cemetery', -25.8650, 25.6300,
    'Mma Kelebogile sewed the school uniforms for half of Mahikeng.');
  perform pg_temp.demo_case(dineo, pta, b_pta, 'Pieter', 'Botha', '1944-03-30', current_date - 12, current_date - 8, 'PUBLISHED', 'demo-pieter-botha',
    'Pretoria Central Methodist Church', -25.7470, 28.1880, 'Thaba Tshwane Cemetery', -25.7900, 28.1500,
    'Pieter fixed every radio on his street and refused payment from pensioners.', 'burial', 10);
  c_old := pg_temp.demo_case(boitumelo, nwh, b_mah, 'Ditiro', 'Seleke', '1938-07-12', current_date - 306, current_date - 299, 'PUBLISHED', 'demo-ditiro-seleke',
    'Mahikeng Lutheran Church', -25.8560, 25.6400, 'Mahikeng Cemetery', -25.8650, 25.6300,
    'Rra Ditiro farmed cattle near Lotlhakane and taught every grandchild to read the sky.', 'burial', 300);
  insert into public.memora_invites (kind, org_id, branch_id, label, created_by, created_at, expires_at, used_at, used_by, case_id) values
    ('family', nwh, b_mah, 'Motsamai family', boitumelo, now() - interval '3 days', now() + interval '27 days', now() - interval '2 days', fam, c_draft);
  update public.memora_cases set owner_id = fam where id = c_draft;

  -- Head office's templates: one for every branch, one only for Gauteng, standard wording.
  insert into public.memora_templates (account_id, name, kind, tradition, items, audience, audience_ids, created_by, updated_by, created_at, updated_at) values
    (acc, 'Funeral service', 'programme', 'Christian',
      '[{"part":"service","type":"arrival","title":"Arrival of the deceased","minutes":5},{"part":"service","type":"prayer","title":"Opening prayer","minutes":5},{"part":"service","type":"hymn","title":"Hymn","minutes":5},{"part":"service","type":"obituary","title":"Obituary","minutes":10},{"part":"service","type":"tribute","title":"Tribute from the family","minutes":10},{"part":"service","type":"sermon","title":"Sermon","minutes":20},{"part":"service","type":"viewing","title":"Final viewing","minutes":15},{"part":"graveside","type":"committal","title":"Committal","minutes":10},{"part":"graveside","type":"thanks","title":"Vote of thanks","minutes":5}]',
      'all', '{}', palesa, palesa, now() - interval '40 days', now() - interval '12 days'),
    (acc, 'Zion Christian Church service', 'programme', 'ZCC',
      '[{"part":"service","type":"hymn","title":"Opening hymn","minutes":10},{"part":"service","type":"prayer","title":"Prayer","minutes":10},{"part":"service","type":"scripture","title":"Scripture","minutes":10},{"part":"service","type":"sermon","title":"Sermon","minutes":30},{"part":"graveside","type":"committal","title":"Committal","minutes":15}]',
      'regions', array[gauteng], palesa, palesa, now() - interval '20 days', now() - interval '20 days');
  insert into public.memora_templates (account_id, name, kind, wording, created_by, updated_by) values
    (acc, 'Obituary opening', 'wording', 'It is with great sadness that the family announces the passing of their beloved {name}. {name} will be remembered for their warmth, their faith and the love they gave so freely.', palesa, palesa);

  -- An invite waiting for a new finance clerk; last month's invoice paid (with onboarding).
  insert into public.memora_invites (kind, account_id, group_id, label, created_by, created_at, expires_at)
    values ('account', acc, g_fin, '062 568 3129 (demo)', thandi, now() - interval '1 day', now() + interval '13 days');
  insert into public.memora_account_invoices (account_id, period, memorials, included_memorials, overage_memorials, monthly_fee_minor, per_memorial_minor, onboarding_minor, amount_minor, vat_minor, status, created_at)
    values (acc, to_char(lm, 'YYYY-MM'), 41, 50, 0, 3500000, 49900, 950000, 3500000 + 950000, round((3500000 + 950000) * 0.15), 'PAID', lm + interval '31 days');
  insert into public.memora_event_interest (case_id, user_id, kind, created_at) values (c_old, boitumelo, 'unveiling', now() - interval '1 day');

  insert into public.memora_activity_log (actor_user_id, action, metadata, account_id, created_at) values
    (me, 'ADMIN_ACCOUNT_PROVISIONED', '{"demo":true,"name":"Motheo Funeral Group","blueprint":"standard","after":{"monthly":35000,"included":50,"perMemorial":499,"regions":2,"homes":3,"branches":5}}', acc, now() - interval '45 days'),
    (thandi, 'ADMIN_MEMBER_ADDED', '{"demo":true,"group":"Regional managers · Gauteng","who":"Lerato Dube"}', acc, now() - interval '40 days'),
    (palesa, 'ADMIN_BRAND_CHANGED', '{"demo":true,"group":"Motheo Funeral Group","before":{"colour":"","locked":[]},"after":{"colour":"#3F4E8C","locked":["colour","footer"]}}', acc, now() - interval '38 days'),
    (palesa, 'ADMIN_TEMPLATE_PUBLISHED', '{"demo":true,"template":"Zion Christian Church service","audience":"regions"}', acc, now() - interval '20 days'),
    (me, 'ADMIN_CONTRACT_CHANGED', '{"demo":true,"group":"Motheo Funeral Group","before":{"included":40,"branches":30},"after":{"included":50,"branches":40}}', acc, now() - interval '15 days'),
    (thandi, 'ADMIN_BRANCHES_DEACTIVATED', '{"demo":true,"branches":["Rustenburg"]}', acc, now() - interval '6 days');

  -- A few notifications, as they would have arrived (the bell also works out today's situations itself).
  delete from public.memora_notifications where key like 'demo:%';
  insert into public.memora_notifications (user_id, kind, tone, title, body, href, key, created_at)
  select u, k, t, ti, b, h, 'demo:' || ky, now() - make_interval(hours => hrs)
  from (values
    (thandi, 'family_started', 'action', 'Motsamai family started their memorial', 'They used the link you sent and are adding the story and programme. Check in, then publish when it’s ready.', '/memorials/' || c_draft, 'fs-thandi', 30),
    (me, 'family_started', 'action', 'Motsamai family started their memorial', 'They used the link you sent and are adding the story and programme. Check in, then publish when it’s ready.', '/memorials/' || c_draft, 'fs-me', 30),
    (thandi, 'unveiling_interest', 'action', 'The Seleke family is planning Ditiro’s unveiling', 'They asked about unveiling pages. A good moment to call them.', '/memorials/' || c_old, 'uv-thandi', 20),
    (me, 'unveiling_interest', 'action', 'The Seleke family is planning Ditiro’s unveiling', 'They asked about unveiling pages. A good moment to call them.', '/memorials/' || c_old, 'uv-me', 20),
    (karabo, 'invoice', 'action', 'Motheo Funeral Group’s Memora invoice is ready', 'Last month: R44,500, payable on your agreement’s terms.', '/pro/group?account=' || acc || '&tab=billing', 'inv-karabo', 200),
    (lerato_d, 'role_added', 'good', 'You’ve been added to Regional managers · Gauteng at Motheo Funeral Group', 'Sees and runs the branches in their region: their funerals, their managers and arrangers, and their reports.', '/pro/group?account=' || acc, 'role-lerato', 900)
  ) as v(u, k, t, ti, b, h, ky, hrs)
  where u is not null;
end $$;

commit;
