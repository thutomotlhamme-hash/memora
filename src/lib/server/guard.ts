import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase, getSessionUser, type SessionUser } from '../supabase/server';
import { fail, sameOrigin } from './http';

export type Authed = { supabase: SupabaseClient; user: SessionUser };

/** Common checks for owner-only API routes. Returns a Response to send on failure. */
export async function requireOwner(request: Request): Promise<Authed | Response> {
  if (!sameOrigin(request)) return fail('Cross-site request refused.', 403);
  const supabase = await getServerSupabase();
  if (!supabase) return fail('Accounts are not configured on this Memora deployment.', 503);
  const user = await getSessionUser(supabase);
  if (!user) return fail('Please log in to continue.', 401);
  return { supabase, user };
}
