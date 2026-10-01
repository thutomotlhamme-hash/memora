import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusScreen } from '@/components/MemorialView';
import { JoinAccount, SetUpHome, StartFamilyMemorial } from '@/components/pro/JoinForms';
import { SiteHeader } from '@/components/SiteHeader';
import { BrandMark } from '@/components/Brand';
import { Constellation } from '@/components/pro/studio/Constellation';
import { accountLabel, isPhoneLogin } from '@/lib/account-id';
import { PRO_PLANS, formatMoney } from '@/lib/plans';
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
  const joining = invite.kind === 'account';
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
          <span className="st-spark">{joining ? `${invite.accountName} · Memora Enterprise` : family ? invite.orgName : `Memora Pro · ${plan.name} plan`}</span>
          <h1>{joining ? `Welcome to ${invite.accountName}.` : family ? `A memorial for the ${who}.` : 'Welcome to Memora Pro.'}</h1>
          <p>
            {joining
              ? `You’ve been asked to join ${invite.accountName} on Memora, in ${invite.groupName}. Sign in with your cellphone number and you’re in.`
              : family
              ? `${invite.orgName} has asked you to tell your loved one’s story. It takes about fifteen minutes, from your phone.`
              : 'Your funeral home, your branding, on every memorial and printed programme. Set up takes two minutes.'}
          </p>
          <ol className="join-path">
            {joining ? (
              <>
                <li>
                  <b>Your account.</b> Your cellphone number is how you log in.
                </li>
                <li>
                  <b>Your role.</b> {invite.groupName}: you see exactly what that role allows.
                </li>
                <li>
                  <b>The group.</b> Funerals, branches and reports, from one place.
                </li>
              </>
            ) : family ? (
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
                  <b>Your first family.</b> Send a link, or start the memorial yourself. Free trial first; then{' '}
                  {plan.quoted
                    ? 'the terms in your agreement.'
                    : plan.monthlyMinor
                      ? `${formatMoney(plan.monthlyMinor)} a month with ${plan.includedMemorials} funerals included, then ${formatMoney(plan.overageMinor)} each, excl. VAT.`
                      : `${formatMoney(plan.overageMinor)} per published funeral, excl. VAT. No monthly fee.`}
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
          <h2>{step === 1 ? 'Your Memora account' : joining ? `Join ${invite.accountName}` : family ? 'Start the memorial' : 'Your funeral home'}</h2>
          {!user ? (
            <>
              <p className="join-help">Use your cellphone number; it’s how you’ll log in. Nothing is sent to your phone.</p>
              <JoinAccount cta={joining ? 'Continue' : family ? 'Continue to the memorial' : 'Continue to set up'} />
            </>
          ) : (
            <>
              <p className="join-help">
                Signed in as {accountLabel(user.email)}. <Link href={`/account?next=/join/${token}`}>Not you?</Link>
              </p>
              {joining ? (
                <>
                  <p className="tiny muted">
                    By joining you agree to Memora’s <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>. What you do in the group is recorded in
                    its audit log.
                  </p>
                  <StartFamilyMemorial token={decodeURIComponent(token)} label={`Join ${invite.groupName}`} busyLabel="Joining…" />
                </>
              ) : family ? (
                <>
                  <div className="join-terms">
                    <strong>What {invite.orgName} can do</strong>
                    <ul>
                      <li>See and help with everything you add, publish the memorial when you’re both happy, and run the programme on the day.</li>
                      <li>Their name and logo appear on the memorial and printed programme.</li>
                      <li>You can keep editing after it’s published, and nothing is public until then.</li>
                    </ul>
                    <span className="tiny muted">
                      By starting you agree to Memora’s <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.
                    </span>
                  </div>
                  <StartFamilyMemorial token={decodeURIComponent(token)} />
                </>
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
