import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { SiteHeader } from '@/components/SiteHeader';
import { channels } from '@/lib/server/verify';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reset password' };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <Suspense>
          <AuthForm mode="forgot" codes={channels()} />
        </Suspense>
      </main>
    </>
  );
}
