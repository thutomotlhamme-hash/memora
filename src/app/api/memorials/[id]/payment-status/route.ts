import { getAdminSupabase } from '@/lib/supabase/admin';
import { isCasePaid } from '@/lib/server/cases';
import { requireOwner } from '@/lib/server/guard';
import { fail, json } from '@/lib/server/http';
import { PROVIDERS, confirmOrder, providerOn, type Provider } from '@/lib/server/payments';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Called when the family returns from checkout. Never trusts the redirect itself:
 * it asks the payment provider directly about this memorial's latest pending order.
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
  const { data: order } = await admin
    .from('memora_orders')
    .select('provider,provider_reference')
    .eq('case_id', id)
    .in('provider', PROVIDERS)
    .eq('status', 'PENDING')
    .not('provider_reference', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!order?.provider_reference || !providerOn(order.provider)) return json({ paid: false });

  try {
    const result = await confirmOrder(admin, order.provider as Provider, order.provider_reference);
    return json({ paid: await isCasePaid(admin, id), result });
  } catch {
    return json({ paid: false, result: 'pending' });
  }
}
