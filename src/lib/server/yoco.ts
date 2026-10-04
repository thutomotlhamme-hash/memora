import 'server-only';

const API = 'https://payments.yoco.com/api';

export function yocoSecret(): string {
  return process.env.YOCO_SECRET_KEY ?? '';
}

async function yocoFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${yocoSecret()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.displayMessage || json?.description || json?.message || `Yoco request failed (${res.status})`);
  return json;
}

/** Creates a hosted Yoco checkout and returns its id and the page to send the buyer to. */
export async function createCheckout(input: {
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; redirectUrl: string }> {
  const json = await yocoFetch('/checkouts', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      failureUrl: input.failureUrl,
      metadata: input.metadata,
    }),
  });
  if (!json?.id || !json?.redirectUrl) throw new Error('Yoco did not return a checkout page.');
  return { id: String(json.id), redirectUrl: String(json.redirectUrl) };
}

export async function fetchCheckout(checkoutId: string): Promise<any> {
  return yocoFetch(`/checkouts/${encodeURIComponent(checkoutId)}`);
}
