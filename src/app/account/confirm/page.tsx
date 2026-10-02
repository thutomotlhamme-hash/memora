import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PhoneConfirm } from '@/components/PhoneConfirm';
import { SiteHeader } from '@/components/SiteHeader';
import { safeNext } from '@/lib/safe-next';
import { getSessionUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Confirm your number' };

export default async function ConfirmNumberPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next ?? '/memorials');
  const user = await getSessionUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(`/account/confirm?next=${next}`)}`);
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">Your number</span>
          <h1 className="h1">Confirm it’s yours.</h1>
          <p className="muted" style={{ margin: 0 }}>
            Memorials go out under your name, and your number is how you get back in if you forget your password. So we check it once, with a code.
          </p>
          <PhoneConfirm />
          <Link className="btn block" href={next} style={{ marginTop: 8 }}>
            Continue
          </Link>
        </div>
      </main>
    </>
  );
}
