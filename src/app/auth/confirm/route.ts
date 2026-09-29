import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { getServerSupabase } from '@/lib/supabase/server';

/** Lands email confirmation and password-recovery links, then continues to `next`. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const supabase = await getServerSupabase();

  if (supabase) {
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        : { error: new Error('Missing token') };
    if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/account/reset' : next, url.origin));
  }
  return NextResponse.redirect(new URL('/account/login?error=link', url.origin));
}
