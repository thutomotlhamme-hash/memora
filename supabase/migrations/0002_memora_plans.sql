-- Plans: Essential (3 months public), Complete (1 year), Forever (permanent).
-- The plan is recorded on the server-owned order; publishing reads it to set
-- archive_at (null = never archived).

alter table public.memora_orders
  add column if not exists plan text not null default 'essential'
  check (plan in ('essential','complete','forever'));
