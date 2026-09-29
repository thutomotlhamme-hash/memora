import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata = { title: 'Reset password' };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="auth-wrap">
        <Suspense>
          <AuthForm mode="forgot" />
        </Suspense>
      </main>
    </>
  );
}
