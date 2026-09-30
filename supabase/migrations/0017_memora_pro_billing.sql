-- Memora Pro billing: a monthly allowance, a usage ledger, VAT and adjustments.
--
-- * memora_orgs.included_memorials: published memorials included each month.
--   per_memorial_minor is now the price of each one beyond that (for
--   Pay-as-you-go nothing is included, so it is still the price of every one).
-- * memora_org_usage: one row per memorial a funeral home publishes, written
--   when it is published. The case id is the key, so a memorial is billed once,
--   in the month it was first published, however often it is edited, taken
--   down or restored. Drafts, previews and family links never get a row.
-- * memora_billing_adjustments: credits (negative) and extra charges, with a reason.
-- * Invoices keep amount_minor as the total excluding VAT and add the lines.
--
-- Safe to run more than once. Server-only, like the other billing tables.

alter table public.memora_orgs add column if not exists included_memorials integer not null default 0 check (included_memorials >= 0);

-- Homes still on the old list prices move to the new plan terms. For every
-- plan the new terms cost a home the same or less than before (an allowance is
-- now included), so no customer pays more. Custom prices are left alone.
update public.memora_orgs set included_memorials = case plan when 'pro' then 5 when 'pro_plus' then 15 when 'enterprise' then 50 else 0 end
  where included_memorials = 0 and plan <> 'payg';
update public.memora_orgs set per_memorial_minor = case plan when 'pro' then 89900 when 'pro_plus' then 69900 when 'enterprise' then 49900 else per_memorial_minor end
  where per_memorial_minor = 99900;
update public.memora_orgs set onboarding_fee_minor = case plan when 'payg' then 0 when 'pro' then 350000 when 'pro_plus' then 650000 else onboarding_fee_minor end
  where onboarding_fee_minor = 950000 and not onboarding_paid;

create table if not exists public.memora_org_usage (
  case_id uuid primary key,
  org_id uuid not null references public.memora_orgs(id) on delete cascade,
  branch_id uuid,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  published_at timestamptz not null,
  published_by uuid
);
create index if not exists memora_org_usage_org_period_idx on public.memora_org_usage(org_id, period);

-- What was already published under a home counts in the month it was published (as before).
insert into public.memora_org_usage (case_id, org_id, branch_id, period, published_at)
  select c.id, c.org_id, c.branch_id, to_char(c.published_at at time zone 'Africa/Johannesburg', 'YYYY-MM'), c.published_at
  from public.memora_cases c
  where c.org_id is not null and c.published_at is not null
on conflict (case_id) do nothing;

create table if not exists public.memora_billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.memora_orgs(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  amount_minor integer not null,
  reason text not null check (length(btrim(reason)) between 3 and 300),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists memora_billing_adjustments_idx on public.memora_billing_adjustments(org_id, period);

alter table public.memora_org_invoices add column if not exists included_memorials integer not null default 0;
alter table public.memora_org_invoices add column if not exists overage_memorials integer not null default 0;
alter table public.memora_org_invoices add column if not exists adjustments_minor integer not null default 0;
alter table public.memora_org_invoices add column if not exists vat_minor integer not null default 0;

do $$
declare t text;
begin
  foreach t in array array['memora_org_usage', 'memora_billing_adjustments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on public.%I from anon, authenticated', t);
  end loop;
end $$;
