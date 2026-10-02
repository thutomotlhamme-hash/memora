import Link from 'next/link';

/** A gentle reminder (never a wall) until the number on the account is confirmed. */
export function ConfirmNumberNudge({ next, why = 'You’ll need it before you publish a memorial.' }: { next: string; why?: string }) {
  return (
    <div className="note phone-nudge" role="status">
      <span>
        <strong>Confirm your cellphone number.</strong> We send a code by WhatsApp or SMS; it takes a minute. {why}
      </span>
      <Link className="btn sm primary" href={`/account/confirm?next=${encodeURIComponent(next)}`}>
        Confirm now
      </Link>
    </div>
  );
}
