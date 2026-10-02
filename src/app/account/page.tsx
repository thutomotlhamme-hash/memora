import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/SignOutButton';
import { SiteHeader } from '@/components/SiteHeader';
import { accountLabel, isPhoneLogin } from '@/lib/account-id';
import { getSessionUser } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { confirmState } from '@/lib/server/verify';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect('/account/login?next=/account');
  const phone = await confirmState(getAdminSupabase(), user);
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">Your account</span>
          <h1 className="h1">{user.name ? `Hello, ${user.name.split(' ')[0]}.` : 'Your account.'}</h1>
          <div className="card flat" style={{ padding: 0, border: 0, marginTop: 20 }}>
            <div className="kv">
              <span>{isPhoneLogin(user.email) ? 'Cellphone' : 'Email'}</span>
              <strong>
                {accountLabel(user.email)}
                {phone === 'confirmed' && <span className="pill phone-pill ok">Confirmed</span>}
              </strong>
            </div>
            {phone === 'needed' && (
              <div className="kv">
                <span>Confirmed</span>
                <span>
                  Not yet. You’ll need it before you publish.{' '}
                  <Link className="text-link" href="/account/confirm?next=/account">
                    Confirm my number
                  </Link>
                </span>
              </div>
            )}
            <div className="kv">
              <span>Logging in</span>
              <span>Use this {isPhoneLogin(user.email) ? 'number' : 'email'} and your password on any phone or computer.</span>
            </div>
            <div className="kv">
              <span>Privacy</span>
              <span>Your drafts are visible only to you. Nothing is public until you publish.</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: 28 }}>
            <Link className="btn primary" href="/memorials">
              My memorials
            </Link>
            <Link className="btn" href="/account/reset">
              Change password
            </Link>
            <SignOutButton />
          </div>
        </div>
      </main>
    </>
  );
}
