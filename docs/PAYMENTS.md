# Payments: iKhokha (or Yoco)

Memora takes card payments for **Memora Complete** (R899) and for gifts. When
iKhokha's keys are set, iKhokha is used; otherwise Yoco. Nobody is charged while
`NEXT_PUBLIC_MEMORA_PAYMENTS` isn't `on`: publishing stays free.

## Plugging in iKhokha

1. In the iKhokha dashboard, open **Integrations → iK Pay API** (not the Buy Button
   or Pay Link pages).
2. In Netlify → memora-memorials → **Site configuration → Environment variables**, add:
   - `IKHOKHA_APP_ID`: the **Application Key ID**
   - `IKHOKHA_APP_SECRET`: the **Application Key Secret** (mark it as a secret)
3. Redeploy. The command centre's setup list shows the keys as set.
4. When you're ready to charge, set `NEXT_PUBLIC_MEMORA_PAYMENTS=on` and redeploy.
   Then test once with your own card for R899, and refund it from the iKhokha dashboard.

There's no webhook to register. Memora sends its callback address
(`/api/ikhokha/webhook`) with each payment.

## How a payment is confirmed

- The amount is set on the server; the browser never sends it.
- Each order or gift gets its own iKhokha paylink. Our order or gift id is sent
  as `externalTransactionID`.
- A payment is marked paid **only** after Memora asks iKhokha
  (`getStatus/{paylinkID}`, a signed request) and iKhokha says **PAID**, for exactly
  the order's amount. iKhokha's callback, the return from checkout and the command
  centre's **Check payment** button all trigger that same check. A forged callback
  achieves nothing.
- Requests are signed as in iKhokha's examples:
  `IK-SIGN = hex HMAC-SHA256(secret, escape(path + body))`. See
  `src/lib/ikhokha-signature.ts` and `tests/ikhokha.test.ts`.
- Orders started with Yoco are still confirmed with Yoco. Switching providers
  never strands a payment.

## Refunds

Refund in the iKhokha dashboard, then press **Mark refunded** in the command centre.
