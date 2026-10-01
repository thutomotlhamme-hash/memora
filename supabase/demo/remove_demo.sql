-- Removes everything seed_demo.sql made: the demo funeral homes (with their
-- branches, groups, links and invoices), the demo Enterprise group, the demo
-- people and their memorials.
-- Real funeral homes, families and memorials are not touched.

begin;
-- Demo memorials are marked by a DEMO_SEED row in the activity log; demo audit rows by metadata.demo.
delete from public.memora_invites where label like '%(demo)%' or org_id in (select id from public.memora_orgs where slug like 'demo-%');
delete from public.memora_activity_log where case_id is null and metadata->>'demo' = 'true';
delete from public.memora_cases where id in (select case_id from public.memora_activity_log where action = 'DEMO_SEED')
  or owner_id in (select id from auth.users where raw_user_meta_data->>'demo' = 'true');
delete from public.memora_orgs where slug like 'demo-%';
delete from public.memora_activity_log where account_id in (select id from public.memora_accounts where slug like 'demo-%');
delete from public.memora_accounts where slug like 'demo-%';
delete from auth.users where raw_user_meta_data->>'demo' = 'true';
commit;
