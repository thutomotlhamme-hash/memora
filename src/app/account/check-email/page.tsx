import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata = { title: 'Check your email' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { kind = 'confirm', email = '' } = await searchParams;
  const reset = kind === 'reset';
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <span className="eyebrow">Check your email</span>
          <h1 className="h1">{reset ? 'Reset link on its way.' : 'Confirm your email.'}</h1>
          <p className="muted">
            {reset
              ? 'If an account exists for that address, you’ll receive a link to choose a new password.'
              : `We sent a confirmation link${email ? ` to ${email}` : ''}. Open it on this device to finish creating your account.`}
          </p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
            <Link className="btn primary" href="/account/login">
              Back to log in
            </Link>
            <Link className="btn" href="/create">
              Keep editing as a guest
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
