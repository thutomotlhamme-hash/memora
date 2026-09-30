import { AdminAction, CopyButton } from '@/components/admin/AdminAction';
import { fmtDate } from '@/lib/memorial';
import { PRO_PLANS } from '@/lib/plans';
import type { Invite } from '@/lib/server/invites';

const STATE: Record<Invite['state'], string> = { open: 'Waiting', used: 'Used', expired: 'Expired', revoked: 'Switched off' };
const day = (iso: string | null) => (iso ? fmtDate(iso.slice(0, 10)) : '');

/** The message that goes with a link, ready for WhatsApp. */
export function inviteMessage(i: Invite, from = 'Memora'): string {
  return i.kind === 'family'
    ? `Hello, it’s ${from}. We are so sorry for your loss. Here is your link to start the memorial on Memora; we will help with the rest and publish it for you: ${i.url}`
    : `Hi${i.label ? ` ${i.label}` : ''}, it’s Memora. Here is your link to set up your funeral home on Memora Pro. It takes two minutes on your phone or computer: ${i.url}`;
}

/** Links that have been sent: who for, where they stand, and one tap to share again or switch off. */
export function InviteList({ invites, endpoint, from, empty }: { invites: Invite[]; endpoint?: string; from?: string; empty: string }) {
  if (!invites.length) return <p className="muted small">{empty}</p>;
  return (
    <ul className="invite-list">
      {invites.map((i) => (
        <li key={i.id} className={`invite-row ${i.state}`}>
          <div>
            <strong>{i.label || (i.kind === 'org' ? 'A funeral home' : 'A family')}</strong>
            <span className="muted small">
              {' '}
              · {i.kind === 'org' && i.plan ? `${PRO_PLANS[i.plan].name} · ` : ''}
              {i.state === 'used' ? `used ${day(i.usedAt)}${i.usedBy ? ` by ${i.usedBy}` : ''}${i.kind === 'org' && i.orgName ? ` · ${i.orgName}` : ''}` : i.state === 'open' ? `works until ${day(i.expiresAt)}` : `made ${day(i.createdAt)}`}
            </span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className={`pill invite-state ${i.state}`}>{STATE[i.state]}</span>
            {i.state === 'open' && i.url && (
              <>
                <a className="btn sm primary" href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(i, from))}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
                <CopyButton text={i.url} label="Copy link" />
                <AdminAction endpoint={endpoint} action="invite.revoke" id={i.id} label="Switch off" variant="ghost" confirm="Switch this link off? It stops working straight away." />
              </>
            )}
            {i.state === 'used' && i.caseId && (
              <a className="btn sm" href={`/memorials/${i.caseId}`}>
                Open memorial
              </a>
            )}
            {i.state === 'used' && i.kind === 'org' && i.orgId && (
              <a className="btn sm" href={`/pro/dashboard?home=${i.orgId}`}>
                Their dashboard
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
