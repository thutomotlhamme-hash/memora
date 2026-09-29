-- Night vigil and graveside: the programme has parts, and the journey can
-- include the vigil the night before.
--
-- * memora_programme_items.part: 'vigil' | 'service' | 'graveside' (default service)
-- * New programme item types common at South African funerals.
-- * New stop type: vigil.
-- * memora_save_draft and memora_run_update keep each item's part.
-- * memora_cases.programme_release_at: when guests may see the programme
--   (null = straight away). Until then the family can keep changing it privately.

alter table public.memora_programme_items add column if not exists part text not null default 'service';
alter table public.memora_programme_items drop constraint if exists memora_programme_items_part_check;
alter table public.memora_programme_items add constraint memora_programme_items_part_check check (part in ('vigil', 'service', 'graveside'));

alter table public.memora_programme_items drop constraint if exists memora_programme_items_item_type_check;
alter table public.memora_programme_items add constraint memora_programme_items_item_type_check check (item_type in (
  'prayer','scripture','hymn','tribute','obituary','eulogy','song','announcement','custom',
  'viewing','candle','sermon','committal','wreath','thanks'
));

alter table public.memora_stops drop constraint if exists memora_stops_stop_type_check;
alter table public.memora_stops add constraint memora_stops_stop_type_check check (stop_type in (
  'home','vigil','church','hall','cemetery','crematorium','reception','gathering','other'
));

alter table public.memora_cases add column if not exists programme_release_at timestamptz;
grant update (programme_release_at) on public.memora_cases to authenticated;

create or replace function public.memora_save_draft(p_case_id uuid, p_draft jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_person jsonb := coalesce(p_draft->'person', '{}'::jsonb);
begin
  update public.memora_cases set
    disposition_type = coalesce(p_draft#>>'{disposition,type}', ''),
    disposition_notes = coalesce(p_draft#>>'{disposition,notes}', ''),
    programme_mode = coalesce(p_draft#>>'{programme,mode}', ''),
    obituary = coalesce(p_draft#>>'{story,obituary}', ''),
    family_message = coalesce(p_draft#>>'{story,familyMessage}', ''),
    programme_release_at = nullif(p_draft#>>'{programme,releaseAt}', '')::timestamptz,
    updated_at = v_now
  where id = p_case_id;
  if not found then
    raise exception 'Memorial not found' using errcode = 'P0002';
  end if;

  insert into public.memora_people (case_id, first_name, last_name, preferred_name, birth_date, passing_date, portrait_path, updated_at)
  values (
    p_case_id,
    coalesce(v_person->>'firstName', ''),
    coalesce(v_person->>'lastName', ''),
    coalesce(v_person->>'preferredName', ''),
    nullif(v_person->>'birthDate', '')::date,
    nullif(v_person->>'passingDate', '')::date,
    nullif(v_person->>'portraitPath', ''),
    v_now
  )
  on conflict (case_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    preferred_name = excluded.preferred_name,
    birth_date = excluded.birth_date,
    passing_date = excluded.passing_date,
    portrait_path = excluded.portrait_path,
    updated_at = excluded.updated_at;

  delete from public.memora_stops where case_id = p_case_id;
  insert into public.memora_stops (
    case_id, stop_key, stop_type, title, event_date, event_time, departure_time, address_text, landmark,
    parking_notes, transport_notes, notes, latitude, longitude, sort_order
  )
  select
    p_case_id,
    coalesce(nullif(s.v->>'id', ''), gen_random_uuid()::text),
    coalesce(nullif(s.v->>'type', ''), 'other'),
    s.v->>'title',
    (s.v->>'date')::date,
    (s.v->>'time')::time,
    nullif(s.v->>'departTime', '')::time,
    coalesce(s.v->>'address', ''),
    coalesce(s.v->>'landmark', ''),
    coalesce(s.v->>'parking', ''),
    coalesce(s.v->>'transport', ''),
    coalesce(s.v->>'notes', ''),
    (s.v->>'lat')::numeric,
    (s.v->>'lng')::numeric,
    s.i::integer
  from jsonb_array_elements(coalesce(p_draft->'journey', '[]'::jsonb)) with ordinality as s(v, i);

  delete from public.memora_programme_items where case_id = p_case_id;
  insert into public.memora_programme_items (case_id, item_key, part, item_type, start_time, title, presenter, detail, sort_order)
  select
    p_case_id,
    coalesce(nullif(p.v->>'id', ''), gen_random_uuid()::text),
    coalesce(nullif(p.v->>'part', ''), 'service'),
    coalesce(nullif(p.v->>'type', ''), 'custom'),
    nullif(p.v->>'time', '')::time,
    p.v->>'title',
    coalesce(p.v->>'presenter', ''),
    coalesce(p.v->>'detail', ''),
    p.i::integer
  from jsonb_array_elements(coalesce(p_draft#>'{programme,items}', '[]'::jsonb)) with ordinality as p(v, i);

  return v_now;
end $$;

revoke all on function public.memora_save_draft(uuid, jsonb) from public, anon;
grant execute on function public.memora_save_draft(uuid, jsonb) to authenticated;

create or replace function public.memora_run_update(
  p_case_id uuid,
  p_base timestamptz,
  p_programme jsonb,
  p_stop_times jsonb,
  p_set_live boolean,
  p_live_key text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_current timestamptz;
begin
  select updated_at into v_current from public.memora_cases where id = p_case_id and status <> 'ARCHIVED' for update;
  if not found then
    raise exception 'Memorial not found' using errcode = 'P0002';
  end if;
  if p_base is not null and v_current > p_base then
    raise exception 'stale' using errcode = '40001';
  end if;

  if p_programme is not null then
    delete from public.memora_programme_items where case_id = p_case_id;
    insert into public.memora_programme_items (case_id, item_key, part, item_type, start_time, title, presenter, detail, sort_order)
    select
      p_case_id,
      coalesce(nullif(p.v->>'id', ''), gen_random_uuid()::text),
      coalesce(nullif(p.v->>'part', ''), 'service'),
      coalesce(nullif(p.v->>'type', ''), 'custom'),
      nullif(p.v->>'time', '')::time,
      p.v->>'title',
      coalesce(p.v->>'presenter', ''),
      coalesce(p.v->>'detail', ''),
      p.i::integer
    from jsonb_array_elements(p_programme) with ordinality as p(v, i);
    update public.memora_cases set programme_mode = 'formal' where id = p_case_id and jsonb_array_length(p_programme) > 0;
  end if;

  if p_stop_times is not null then
    update public.memora_stops s set
      event_time = coalesce(nullif(t.v->>'time', '')::time, s.event_time),
      departure_time = case when t.v ? 'departTime' then nullif(t.v->>'departTime', '')::time else s.departure_time end
    from jsonb_array_elements(p_stop_times) as t(v)
    where s.case_id = p_case_id and s.stop_key = t.v->>'id';
  end if;

  if p_set_live then
    update public.memora_cases set live_current_key = p_live_key, live_started_at = case when p_live_key is null then null else v_now end
    where id = p_case_id;
  end if;

  update public.memora_cases set updated_at = v_now where id = p_case_id;
  return v_now;
end $$;

revoke all on function public.memora_run_update(uuid, timestamptz, jsonb, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function public.memora_run_update(uuid, timestamptz, jsonb, jsonb, boolean, text) to service_role;
