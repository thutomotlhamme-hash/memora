-- Finds an account by the address people sign in with (an email, or the
-- internal address of a cellphone account). Used only by the admin tools to
-- help someone log in or to add a teammate. Server-only (service_role).

create or replace function public.memora_find_account(p_email text)
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1
$$;

revoke all on function public.memora_find_account(text) from public, anon, authenticated;
grant execute on function public.memora_find_account(text) to service_role;
