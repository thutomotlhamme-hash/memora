-- In-app notifications: one row per person per thing worth knowing.
--
-- Written by the server when something happens (a family starts from a link,
-- a memorial is published, someone is added to a team, an invoice is sent),
-- and for situations worked out when a person opens their notifications (a
-- funeral in two days that isn't published, a first year ending). The key
-- makes each one appear once per person. Server-only.

create table if not exists public.memora_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (length(kind) between 2 and 40),
  tone text not null default 'info' check (tone in ('info', 'action', 'warn', 'good')),
  title text not null check (length(title) between 2 and 200),
  body text not null default '' check (length(body) <= 600),
  href text not null default '' check (href = '' or href ~ '^/'),
  key text not null check (length(key) between 2 and 200),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, key)
);
create index if not exists memora_notifications_user_idx on public.memora_notifications(user_id, created_at desc);
alter table public.memora_notifications enable row level security;
revoke all privileges on public.memora_notifications from anon, authenticated;
