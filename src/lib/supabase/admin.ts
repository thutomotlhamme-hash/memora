import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl } from '../config';

let adminClient: SupabaseClient | null = null;

/**
 * Service-role client for trusted server transitions only (publishing, orders,
 * payments, public memorial reads). It bypasses RLS, so every caller must do its
 * own ownership and state checks first. Never import this from client code.
 */
export function getAdminSupabase(): SupabaseClient | null {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !secret) return null;
  adminClient ??= createClient(supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}
