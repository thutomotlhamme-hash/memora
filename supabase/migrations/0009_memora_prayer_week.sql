-- Prayers during the week before the funeral: where, the usual time, and each
-- evening's service title, word of the day, scripture and who leads.
alter table public.memora_cases add column if not exists prayers jsonb;
grant update (prayers) on public.memora_cases to authenticated;

-- memora_save_draft also keeps the prayer week.
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
    prayers = p_draft->'prayers',
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
