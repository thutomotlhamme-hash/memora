-- One-time codes that confirm a cellphone number (by WhatsApp, or SMS as a
-- backup), used to confirm a number and to reset a forgotten password. Only a
-- hash of the code is kept. Codes expire after 10 minutes, allow 5 tries and
-- work once. Whether a number is confirmed lives in the account's app_metadata
-- (phone_confirmed_at), which only the server can change. Server-only table.

create table public.memora_phone_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('confirm', 'reset')),
  channel text not null check (channel in ('whatsapp', 'sms')),
  code_hash text not null,
  attempts int not null default 0,
  failed boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index memora_phone_codes_phone_idx on public.memora_phone_codes(phone, created_at desc);
create index memora_phone_codes_user_idx on public.memora_phone_codes(user_id);
alter table public.memora_phone_codes enable row level security;
revoke all privileges on public.memora_phone_codes from anon, authenticated;
