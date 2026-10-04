// Checking a provider's record of a payment against what we asked for. Pure, so it's tested.

/** The provider's own record of a payment, in one shape. */
export interface Lookup {
  paid: boolean;
  id: string;
  amountMinor: number;
  /** Null when the provider doesn't say (iKhokha only takes rand). */
  currency: string | null;
  paymentId: string;
  /** Our own id the provider echoes back, when it does. */
  ref: { orderId?: string; giftId?: string; any?: string };
}

/** Does the provider's record match what we asked for, to the cent? */
export function matches(l: Lookup, expect: { id: string; reference: string; kind: 'order' | 'gift'; amountMinor: number; currency: string }): boolean {
  const echoed = expect.kind === 'order' ? (l.ref.orderId ?? l.ref.any) : (l.ref.giftId ?? l.ref.any);
  return (
    l.id === expect.id &&
    l.amountMinor === Number(expect.amountMinor) &&
    (l.currency === null ? expect.currency.toUpperCase() === 'ZAR' : l.currency === expect.currency.toUpperCase()) &&
    (!echoed || echoed === expect.reference)
  );
}
