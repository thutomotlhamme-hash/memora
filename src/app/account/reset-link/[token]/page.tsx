import { StatusScreen } from '@/components/MemorialView';
import { NewPasswordForm } from '@/components/NewPasswordForm';
import { SiteHeader } from '@/components/SiteHeader';
import { openResetLink } from '@/lib/server/accounts';
import { getAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Choose a new password', robots: { index: false } };

const ENDED = {
  invalid: 'This link isn’t working.',
  used: 'This link has already been used.',
  expired: 'This link has expired.',
  revoked: 'This link was switched off.',
} as const;

export default async function ResetLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdminSupabase();
  const opened = admin ? await openResetLink(admin, decodeURIComponent(token)) : ({ state: 'invalid' } as const);
  if (opened.state !== 'open') {
    return (
      <>
        <SiteHeader />
        <StatusScreen eyebrow="Memora" title={ENDED[opened.state]} body="Reset links work once, for 24 hours. Ask Memora on WhatsApp for a new one." />
      </>
    );
  }
  return (
    <>
      <SiteHeader hideCreate />
      <main className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">Memora</span>
          <h1 className="h2" style={{ margin: '8px 0 6px' }}>
            Choose a new password
          </h1>
          <p className="muted">For {opened.label}. You’ll log in with this number and your new password.</p>
          <NewPasswordForm token={decodeURIComponent(token)} label={opened.label} />
        </div>
      </main>
    </>
  );
}
