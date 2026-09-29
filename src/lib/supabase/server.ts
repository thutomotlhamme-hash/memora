import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from '../config';

/** Server client acting as the signed-in user from the request cookies (RLS applies). */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy
          // refreshes the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/**
 * The verified, permanent (non-anonymous) user for this request, or null.
 * Uses getClaims(), which validates the JWT rather than trusting the cookie.
 */
export async function getSessionUser(supabase?: SupabaseClient | null): Promise<SessionUser | null> {
  const client = supabase ?? (await getServerSupabase());
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims as Record<string, any> | undefined;
  if (error || !claims?.sub || claims.is_anonymous === true) return null;
  return {
    id: String(claims.sub),
    email: String(claims.email ?? ''),
    name: String(claims.user_metadata?.full_name ?? ''),
  };
}
