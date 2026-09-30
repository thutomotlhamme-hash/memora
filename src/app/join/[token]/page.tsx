import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusScreen } from '@/components/MemorialView';
import { JoinAccount, SetUpHome, StartFamilyMemorial } from '@/components/pro/JoinForms';
import { SiteHeader } from '@/components/SiteHeader';
import { accountLabel, isPhoneLogin } from '@/lib/account-id';
import { PRO_PLANS } from '@/lib/plans';
import { openInvite } from '@/lib/server/invites';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your Memora link', robots: { index: false } };

const ENDED = {
  used: ['This link has already been used.', 'Each link works once. If it was you, log in and open My memorials. Otherwise ask for a new link.'],
  expired: ['This link has expired.', 'Ask whoever sent it for a new one. It takes them a few seconds.'],
  revoked: ['This link was switched off.', 'Ask whoever sent it for a new one.'],
} as const;

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdminSupabase();
  const opened = admin ? await openInvite(admin, decodeURIComponent(token)) : ({ state: 'invalid' } as const);
  const user = await getSessionUser();

  if (opened.state === 'invalid') {
    return (
      <>
        <SiteHeader />
        <StatusScreen eyebrow="Memora" title="This link isn’t working." body="Check that the whole link was copied, or ask whoever sent it for a new one." />
      </>
    );
  }
  if (opened.state !== 'open') {
    if (opened.state === 'used' && opened.invite.kind === 'family' && opened.invite.caseId && user) redirect('/memorials');
    const [title, body] = ENDED[opened.state];
    return (
      <>
        <SiteHeader />
        <StatusScreen
          eyebrow={opened.invite.kind === 'org' ? 'Memora Pro' : opened.invite.orgName || 'Memora'}
          title={title}
          body={body}
          action={
            <Link className="btn" href={user ? '/memorials' : '/account/login'}>
              {user ? 'My memorials' : 'Log in'}
            </Link>
          }
        />
      </>
    );
  }

  const { invite } = opened;
  const family = invite.kind === 'family';
  if (family && opened.orgStatus === 'disabled') {
    return (
      <>
        <SiteHeader />
        <StatusScreen eyebrow={invite.orgName} title="This link can’t be used right now." body="Please contact the funeral home. You can also make a memorial yourself on Memora." />
      </>
    );
  }
  const plan = PRO_PLANS[invite.plan ?? 'pro'];

  return (
    <>
      <SiteHeader hideCreate />
      <main className="container join-wrap">
        <section className="card join-card">
          <span className="eyebrow">{family ? invite.orgName : `Memora Pro · ${plan.name} plan`}</span>
          <h1 className="h2" style={{ marginTop: 8 }}>
            {family ? `A memorial for the ${invite.label.replace(/^the\s+/i, '')}` : 'Set up your funeral home on Memora'}
          </h1>
          {family ? (
            <ul className="join-steps">
              <li>
                <strong>You</strong> add your loved one’s details, photo, story and the programme.
              </li>
              <li>
                <strong>{invite.orgName}</strong> checks it, can help edit it, publishes it and runs it on the day.
              </li>
              <li>
                <strong>Nothing to pay.</strong> The funeral home covers Memora.
              </li>
            </ul>
          ) : (
            <ul className="join-steps">
              <li>Tell us your funeral home’s details. You become its owner on Memora.</li>
              <li>You start in a free trial. Add your directors and arrangements staff from your dashboard.</li>
              <li>
                Then send families a link, or make memorials yourselves. {plan.name}: {plan.monthlyMinor ? `R${(plan.monthlyMinor / 100).toLocaleString('en-ZA')} a month + ` : ''}R
                {(plan.perMemorialMinor / 100).toLocaleString('en-ZA')} per published memorial, excl. VAT, once the trial ends.
              </li>
            </ul>
          )}

          {!user ? (
            <>
              <p className="small muted" style={{ margin: '16px 0 8px' }}>
                First, your Memora account. Use your cellphone number; it’s how you’ll log in.
              </p>
              <JoinAccount cta={family ? 'Continue to the memorial' : 'Continue to set up'} />
            </>
          ) : (
            <>
              <p className="small muted" style={{ margin: '16px 0 12px' }}>
                Signed in as {accountLabel(user.email)}.{' '}
                <Link href={`/account?next=/join/${token}`}>Not you?</Link>
              </p>
              {family ? <StartFamilyMemorial token={decodeURIComponent(token)} /> : <SetUpHome token={decodeURIComponent(token)} name={invite.label} phone={isPhoneLogin(user.email) ? accountLabel(user.email) : ''} />}
            </>
          )}
        </section>
      </main>
    </>
  );
}
