import 'server-only';

import { signIkhokha } from '../ikhokha-signature';

// iKhokha iK Pay API: a hosted payment page ("paylink") per order. Keys come
// from the iKhokha dashboard → Integrations → iK Pay API.

const API = 'https://api.ikhokha.com/public-api/v1/api';

const appId = () => process.env.IKHOKHA_APP_ID?.trim() ?? '';
const appSecret = () => process.env.IKHOKHA_APP_SECRET?.trim() ?? '';
export const ikhokhaOn = () => Boolean(appId() && appSecret());

async function ikFetch(url: string, body?: string): Promise<any> {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'IK-APPID': appId(), 'IK-SIGN': await signIkhokha(appSecret(), url, body ?? '') },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `iKhokha request failed (${res.status})`);
  return json;
}

/** Creates a paylink for an order or gift; `reference` is our own id, echoed back as externalTransactionID. */
export async function createPaylink(input: {
  amountMinor: number;
  currency: string;
  reference: string;
  description: string;
  callbackUrl: string;
  successUrl: string;
  failureUrl: string;
  cancelUrl: string;
  requesterUrl: string;
}): Promise<{ id: string; url: string }> {
  const body = JSON.stringify({
    entityID: appId(),
    externalEntityID: input.reference,
    amount: input.amountMinor,
    currency: input.currency,
    requesterUrl: input.requesterUrl,
    description: input.description.slice(0, 100),
    paymentReference: input.reference,
    mode: 'live',
    externalTransactionID: input.reference,
    urls: { callbackUrl: input.callbackUrl, successPageUrl: input.successUrl, failurePageUrl: input.failureUrl, cancelUrl: input.cancelUrl },
  });
  const json = await ikFetch(`${API}/payment`, body);
  if (String(json?.responseCode) !== '00' || !json?.paylinkUrl || !json?.paylinkID) throw new Error(json?.message || 'iKhokha did not return a payment page.');
  return { id: String(json.paylinkID), url: String(json.paylinkUrl) };
}

/** iKhokha's own answer about a paylink: { paylinkID, status: 'PAID' | …, amount, … }. */
export async function fetchPaylink(paylinkId: string): Promise<any> {
  return ikFetch(`${API}/getStatus/${encodeURIComponent(paylinkId)}`);
}
