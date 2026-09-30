import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusScreen } from '@/components/MemorialView';
import { JoinAccount, SetUpHome, StartFamilyMemorial } from '@/components/pro/JoinForms';
import { SiteHeader } from '@/components/SiteHeader';
import { BrandMark } from '@/components/Brand';
import { Constellation } from '@/components/pro/studio/Constellation';
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
  // A family link wears the funeral home's own logo and colour.
  const { data: home } = family && invite.orgId && admin ? await admin.from('memora_orgs').select('logo_url,brand_colour').eq('id', invite.orgId).maybeSingle() : { data: null };
  const accent = home?.brand_colour && /^#[0-9a-f]{6}$/i.test(home.brand_colour) ? (home.brand_colour as string) : undefined;
  const who = invite.label.replace(/^the\s+/i, '');
  const step = user ? 2 : 1;

  return (
    <main className="join" style={accent ? ({ ['--home' as string]: accent } as React.CSSProperties) : undefined}>
      <aside className="join-stage">
        <Constellation seed={who.length * 5 + 11} count={80} />
        <Link href="/" className="join-mark" aria-label="Memora">
          <BrandMark size={26} /> <span>Memora</span>
        </Link>
        <div className="join-stage-copy">
          {family && home?.logo_url ? <img className="join-home-logo" src={home.logo_url} alt={invite.orgName} /> : null}
          <span className="st-spark">{family ? invite.orgName : `Memora Pro · ${plan.name} plan`}</span>
          <h1>{family ? `A memorial for the ${who}.` : 'Welcome to Memora Pro.'}</h1>
          <p>
            {family
              ? `${invite.orgName} has asked you to tell your loved one’s story. It takes about fifteen minutes, from your phone.`
              : 'Your funeral home, your branding, on every memorial and printed programme. Set up takes two minutes.'}
          </p>
          <ol className="join-path">
            {family ? (
              <>
                <li>
                  <b>You</b> add the photo, their story and the programme.
                </li>
                <li>
                  <b>{invite.orgName}</b> checks it, publishes it and runs the day.
                </li>
                <li>
                  <b>Nothing to pay.</b> The funeral home covers Memora.
                </li>
              </>
            ) : (
              <>
                <li>
                  <b>Your details.</b> You become the owner of your funeral home on Memora.
                </li>
                <li>
                  <b>Your team.</b> Add branches, managers and arrangers from your dashboard.
                </li>
                <li>
                  <b>Your first family.</b> Send a link, or start the memorial yourself. Free trial first; then {plan.monthlyMinor ? `R${(plan.monthlyMinor / 100).toLocaleString('en-ZA')} a month + ` : ''}R
                  {(plan.perMemorialMinor / 100).toLocaleString('en-ZA')} per memorial, excl. VAT.
                </li>
              </>
            )}
          </ol>
        </div>
      </aside>

      <section className="join-panel">
        <div className="join-panel-inner">
          <div className="join-progress" aria-label={`Step ${step} of 2`}>
            <span className={step >= 1 ? 'on' : ''} />
            <span className={step >= 2 ? 'on' : ''} />
          </div>
          <span className="st-eyebrow">Step {step} of 2</span>
          <h2>{step === 1 ? 'Your Memora account' : family ? 'Start the memorial' : 'Your funeral home'}</h2>
          {!user ? (
            <>
              <p className="join-help">Use your cellphone number; it’s how you’ll log in. Nothing is sent to your phone.</p>
              <JoinAccount cta={family ? 'Continue to the memorial' : 'Continue to set up'} />
            </>
          ) : (
            <>
              <p className="join-help">
                Signed in as {accountLabel(user.email)}. <Link href={`/account?next=/join/${token}`}>Not you?</Link>
              </p>
              {family ? (
                <StartFamilyMemorial token={decodeURIComponent(token)} />
              ) : (
                <SetUpHome token={decodeURIComponent(token)} name={invite.label} phone={isPhoneLogin(user.email) ? accountLabel(user.email) : ''} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
