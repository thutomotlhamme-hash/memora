-- Password reset links the command centre sends people on WhatsApp (accounts are
-- cellphone numbers, so there's no email to send a reset to). The link is signed
-- with MEMORA_LINK_SECRET (token = <id>.<hmac>); this table only says whether it
-- still works: once, for 24 hours, until used or switched off. Server-only.

create table public.memora_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz
);
create index memora_password_resets_user_idx on public.memora_password_resets(user_id);
alter table public.memora_password_resets enable row level security;
revoke all privileges on public.memora_password_resets from anon, authenticated;
