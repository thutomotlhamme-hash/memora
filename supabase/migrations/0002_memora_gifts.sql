-- Gift a memorial.
--
-- Someone pays for Memora Complete on behalf of a family. After paying, the
-- buyer sends the recipient a private link on WhatsApp to create the memorial,
-- already paid for. The recipient's WhatsApp number and the rough funeral date
-- let the Memora team follow up by hand so the memorial is ready in time.
--
-- Gifts hold contact details for people who may never sign up, so the table is
-- server-only: RLS is on with no policies, and anon/authenticated have no grants.

create table public.memora_gifts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'PENDING' check (status in ('PENDING','PAID','REDEEMED','CANCELLED')),

  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'ZAR',
  provider text not null default 'yoco',
  provider_reference text unique,
  provider_payment_id text,
  paid_at timestamptz,

  buyer_name text not null check (length(btrim(buyer_name)) between 1 and 120),
  buyer_email text not null check (buyer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  buyer_user_id uuid references auth.users(id) on delete set null,
  recipient_name text not null check (length(btrim(recipient_name)) between 1 and 120),
  recipient_email text check (recipient_email is null or recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  recipient_whatsapp text not null check (recipient_whatsapp ~ '^[1-9][0-9]{7,14}$'),
  loved_one_name text not null default '',
  message text not null default '' check (length(message) <= 1000),
  funeral_date_estimate date,
  funeral_date_unsure boolean not null default false,

  -- Manual follow-up by the Memora team, recorded from the gifts board.
  team_contact_count integer not null default 0,
  team_contacted_at timestamptz,

  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  case_id uuid references public.memora_cases(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint memora_gifts_date check (funeral_date_estimate is not null or funeral_date_unsure)
);

create index memora_gifts_status_idx on public.memora_gifts(status, funeral_date_estimate);
create index memora_gifts_case_idx on public.memora_gifts(case_id);
create index memora_gifts_buyer_user_idx on public.memora_gifts(buyer_user_id);
create index memora_gifts_redeemed_by_idx on public.memora_gifts(redeemed_by);

alter table public.memora_gifts enable row level security;
revoke all privileges on public.memora_gifts from anon, authenticated;
