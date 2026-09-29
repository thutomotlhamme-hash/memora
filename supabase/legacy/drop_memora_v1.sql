-- OPTIONAL, DESTRUCTIVE. Run once, by hand, only on the old Memora V1 project
-- (ref tusrwqgruhojotldcjec) before applying migrations/0001_memora_family.sql there.
--
-- Memora V1 mixed the family product with Memora Pro (funeral homes). Memora 2 drops
-- the funeral-home product entirely and uses a new, family-only schema. At hand-over
-- the V1 project had 0 rows in every memora_* table, but CHECK FIRST:
--
--   select 'cases', count(*) from public.memora_cases
--   union all select 'orders', count(*) from public.memora_orders;
--
-- Also delete the V1 Edge Functions in the dashboard (public-memorial, publish-case,
-- payment-init, payment-webhook, approval-review, create-approval-request,
-- create-family-intake, family-intake, funeral-home-admin). Memora 2 runs this logic
-- in Next.js route handlers instead.

begin;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'memora %' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'memora\_%' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'memora\_%' loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

commit;
