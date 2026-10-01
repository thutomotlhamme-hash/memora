import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { homeAudience, notify } from '@/lib/server/notify';
import { getAdminSupabase } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

/**
 * A family asking to hear about the unveiling (Memora's events, coming later).
 * Kept once per memorial; asking again updates the date or note.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const admin = getAdminSupabase();
  if (!admin) return fail('Not switched on yet.', 503);
  const { data: c } = await auth.supabase.from('memora_cases').select('id,status').eq('id', id).maybeSingle();
  if (!c) return fail('Memorial not found.', 404);
  const body = (await request.json().catch(() => ({}))) as { plannedFor?: string; note?: string; kind?: string };
  const kind = body.kind === 'extend' ? 'extend' : 'unveiling';
  const plannedFor = typeof body.plannedFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.plannedFor) ? body.plannedFor : null;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const { error } = await admin.from('memora_event_interest').upsert({ case_id: id, user_id: auth.user.id, kind, planned_for: plannedFor, note }, { onConflict: 'case_id,kind' });
  if (error) return fail('Could not save that. Please try again.', 500);
  await admin.from('memora_activity_log').insert({ case_id: id, actor_user_id: auth.user.id, action: kind === 'extend' ? 'EXTEND_INTEREST' : 'UNVEILING_INTEREST', metadata: { planned_for: plannedFor } });
  // The funeral home that looked after them hears too: the unveiling is theirs to offer.
  const { data: home } = await admin.from('memora_cases').select('org_id,branch_id,memora_people(first_name,last_name)').eq('id', id).maybeSingle();
  if (home?.org_id && kind === 'unveiling') {
    const person = (Array.isArray(home.memora_people) ? home.memora_people[0] : home.memora_people) as { first_name?: string; last_name?: string } | null;
    await notify(
      admin,
      await homeAudience(admin, home.org_id, home.branch_id, 'org.memorials.edit'),
      {
        kind: 'unveiling_interest',
        tone: 'action',
        title: `${person?.last_name ? `The ${person.last_name} family is` : 'A family is'} planning ${person?.first_name ? `${person.first_name}’s` : 'the'} unveiling`,
        body: plannedFor ? `They’re thinking of ${plannedFor}. A good moment to call them.` : 'They asked about unveiling pages. A good moment to call them.',
        href: `/memorials/${id}`,
        key: `unveiling:${id}`,
      },
      auth.user.id,
    );
  }
  return json({
    message: kind === 'extend' ? 'Noted. We’ll be in touch before the memorial goes private.' : 'Thank you. We’ll let you know on WhatsApp as soon as unveiling pages are ready.',
  });
}
