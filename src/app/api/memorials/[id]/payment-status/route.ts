import { getAdminSupabase } from '@/lib/supabase/admin';
import { isCasePaid } from '@/lib/server/cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { confirmOrderWithPaystack, paystackSecret } from '@/lib/server/paystack';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Called when the family returns from checkout. Never trusts the redirect itself:
 * it asks Paystack directly about this memorial's latest pending order.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { data: c } = await supabase.from('memora_cases').select('id').eq('id', id).maybeSingle();
  if (!c) return fail('Memorial not found.', 404);

  const admin = getAdminSupabase();
  if (!admin) return fail('Payments are not configured.', 503);
  if (await isCasePaid(admin, id)) return json({ paid: true });
  if (!paystackSecret()) return json({ paid: false });

  const { data: order } = await admin
    .from('memora_orders')
    .select('provider_reference')
    .eq('case_id', id)
    .eq('provider', 'paystack')
    .eq('status', 'PENDING')
    .not('provider_reference', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order?.provider_reference) return json({ paid: false });

  try {
    const result = await confirmOrderWithPaystack(admin, order.provider_reference);
    return json({ paid: result === 'confirmed' || result === 'already_paid', result });
  } catch {
    return json({ paid: false, result: 'pending' });
  }
}
