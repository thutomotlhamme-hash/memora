import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
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
  return json({
    message: kind === 'extend' ? 'Noted. We’ll be in touch before the memorial goes private.' : 'Thank you. We’ll let you know on WhatsApp as soon as unveiling pages are ready.',
  });
}
