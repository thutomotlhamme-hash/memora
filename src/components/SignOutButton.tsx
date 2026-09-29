'use client';

import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn ghost"
      type="button"
      onClick={async () => {
        await getBrowserSupabase()?.auth.signOut();
        router.replace('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
