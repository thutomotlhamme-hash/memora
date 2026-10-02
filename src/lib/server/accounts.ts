import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { accountLabel, isPhoneLogin, loginAddress } from '../account-id';
import { siteUrl } from '../config';
import { displayName } from '../memorial';
import { ROLES, type Principal, type Role } from '../rbac';
import { loadPrincipal, ownerEmails } from './access';
import { linkSecret, signGiftToken, verifyGiftToken } from './links';

// The command centre's view of a person: who they are, what they made, what
// they can do, and the tools to get them back in (reset link, temporary
// password) or keep them out (suspend).

type Row = Record<string, any>;
const RESET_HOURS = 24;
const FOREVER = '876000h';

export interface AccountView {
  id: string;
  email: string;
  label: string;
  name: string;
  whatsapp: string;
  createdAt: string;
  lastSignInAt: string | null;
  suspended: boolean;
  owner: boolean;
  /** When the number was shown to be theirs: by a code, or vouched for by Memora's team. */
  phoneConfirmed: { at: string; how: 'code' | 'staff' } | null;
  memorials: { id: string; name: string; status: string; slug: string | null; home: string }[];
  access: { where: string; role: string }[];
  resets: { id: string; createdAt: string; state: 'open' | 'used' | 'expired' | 'revoked'; url: string }[];
}

export async function findAccountId(admin: SupabaseClient, who: string): Promise<{ id: string; email: string } | null> {
  const login = loginAddress(who);
  if (!login) return null;
  const { data } = await admin.rpc('memora_find_account', { p_email: login.email });
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? { id: String(row.id), email: String(row.email) } : null;
}

const resetUrl = (id: string) => `${siteUrl()}/account/reset-link/${signGiftToken('reset', id)}`;
const resetState = (r: Row): AccountView['resets'][number]['state'] =>
  r.revoked_at ? 'revoked' : r.used_at ? 'used' : new Date(r.expires_at).getTime() < Date.now() ? 'expired' : 'open';

export async function loadAccount(admin: SupabaseClient, id: string): Promise<AccountView | null> {
  const { data } = await admin.auth.admin.getUserById(id);
  const u = data?.user;
  if (!u?.email) return null;
  const [{ data: cases }, { data: groups }, { data: resets }] = await Promise.all([
    admin.from('memora_cases').select('id,status,slug,memora_people(first_name,last_name,preferred_name),memora_orgs(name)').eq('owner_id', id).order('updated_at', { ascending: false }).limit(20),
    admin.from('memora_group_members').select('memora_groups(name, roles, org_id, memora_orgs(name), memora_branches(name))').eq('user_id', id),
    admin.from('memora_password_resets').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(5),
  ]);
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  const banned = u.banned_until ? new Date(u.banned_until).getTime() > Date.now() : false;
  return {
    id,
    email: u.email,
    label: accountLabel(u.email),
    name: String(u.user_metadata?.full_name ?? ''),
    whatsapp: isPhoneLogin(u.email) ? u.email.split('@')[0] : '',
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    suspended: banned,
    owner: ownerEmails().includes(u.email.toLowerCase()),
    phoneConfirmed: typeof u.app_metadata?.phone_confirmed_at === 'string' ? { at: u.app_metadata.phone_confirmed_at, how: u.app_metadata.phone_confirmed_how === 'staff' ? 'staff' : 'code' } : null,
    memorials: ((cases ?? []) as Row[]).map((c) => {
      const p = one(c.memora_people) as Row | null;
      return {
        id: c.id,
        status: c.status,
        slug: c.slug,
        name: displayName({ firstName: p?.first_name ?? '', lastName: p?.last_name ?? '', preferredName: p?.preferred_name ?? '' }, 'Untitled memorial'),
        home: (one(c.memora_orgs) as Row | null)?.name ?? '',
      };
    }),
    access: ((groups ?? []) as Row[]).flatMap((m) => {
      const g = one(m.memora_groups) as Row | null;
      if (!g) return [];
      const where = g.org_id ? [(one(g.memora_orgs) as Row | null)?.name, (one(g.memora_branches) as Row | null)?.name].filter(Boolean).join(' · ') : 'Memora team';
      return [{ where, role: ((g.roles ?? []) as Role[]).map((r) => ROLES[r]?.label ?? r).join(', ') }];
    }),
    resets: ((resets ?? []) as Row[]).map((r) => ({ id: r.id, createdAt: r.created_at, state: resetState(r), url: linkSecret() ? resetUrl(r.id) : '' })),
  };
}

/** The newest accounts, for browsing when you don't have a number to search. */
export async function recentAccounts(admin: SupabaseClient, limit = 25): Promise<{ id: string; label: string; name: string; createdAt: string; lastSignInAt: string | null; suspended: boolean }[]> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  return (data?.users ?? [])
    .filter((u) => u.email && !u.is_anonymous)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((u) => ({
      id: u.id,
      label: accountLabel(u.email!),
      name: String(u.user_metadata?.full_name ?? ''),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      suspended: u.banned_until ? new Date(u.banned_until).getTime() > Date.now() : false,
    }));
}

type Guarded = { ok: true; account: { id: string; email: string } } | { ok: false; error: string; status: number };

/**
 * Changing someone's way in could hand over their access. Only administrators
 * may do it to people on the Memora team; nobody may do it to the owners in the
 * server settings, and nobody suspends themselves.
 */
export async function guardAccount(admin: SupabaseClient, actor: Principal, target: { id: string; email: string } | null, kind: 'reset' | 'suspend'): Promise<Guarded> {
  if (!target) return { ok: false, error: 'No account uses that cellphone number or email.', status: 404 };
  if (kind === 'suspend' && target.id === actor.userId) return { ok: false, error: 'You can’t suspend your own account.', status: 400 };
  if (ownerEmails().includes(target.email.toLowerCase()) && target.id !== actor.userId) return { ok: false, error: 'That’s an owner set in the server settings. Change it in Netlify instead.', status: 403 };
  const p = await loadPrincipal(admin, target);
  if (p.platform.size > 0 && !actor.roles.has('platform_admin')) return { ok: false, error: 'Only an administrator can do that to someone on the Memora team.', status: 403 };
  return { ok: true, account: target };
}

/** A one-time link to choose a new password, for 24 hours. Older open links for the person stop working. */
export async function createResetLink(admin: SupabaseClient, actorId: string, userId: string): Promise<string> {
  if (!linkSecret()) throw new Error('Reset links need MEMORA_LINK_SECRET set in Netlify.');
  const now = new Date();
  await admin.from('memora_password_resets').update({ revoked_at: now.toISOString() }).eq('user_id', userId).is('used_at', null).is('revoked_at', null);
  const { data, error } = await admin
    .from('memora_password_resets')
    .insert({ user_id: userId, created_by: actorId, expires_at: new Date(now.getTime() + RESET_HOURS * 3_600_000).toISOString() })
    .select('id')
    .single();
  if (error || !data) throw new Error('Could not make the link.');
  return resetUrl(data.id as string);
}

export async function revokeResetLinks(admin: SupabaseClient, userId: string): Promise<void> {
  await admin.from('memora_password_resets').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).is('used_at', null).is('revoked_at', null);
}

export async function setSuspended(admin: SupabaseClient, userId: string, suspended: boolean): Promise<boolean> {
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: suspended ? FOREVER : 'none' });
  if (!error && suspended) await revokeResetLinks(admin, userId);
  return !error;
}

export type OpenedReset = { state: 'invalid' | 'used' | 'expired' | 'revoked' } | { state: 'open'; id: string; userId: string; label: string };

export async function openResetLink(admin: SupabaseClient, token: string): Promise<OpenedReset> {
  const id = verifyGiftToken('reset', token);
  if (!id) return { state: 'invalid' };
  const { data: r } = await admin.from('memora_password_resets').select('*').eq('id', id).maybeSingle();
  if (!r) return { state: 'invalid' };
  const state = resetState(r);
  if (state !== 'open') return { state };
  const { data } = await admin.auth.admin.getUserById(r.user_id);
  if (!data?.user?.email) return { state: 'invalid' };
  if (data.user.banned_until && new Date(data.user.banned_until).getTime() > Date.now()) return { state: 'revoked' };
  return { state: 'open', id: r.id, userId: r.user_id, label: accountLabel(data.user.email) };
}

/** Sets the new password and uses up the link (only if it's still open, so it works once). */
export async function redeemResetLink(admin: SupabaseClient, token: string, password: string): Promise<{ ok: true; label: string } | { ok: false; error: string; status: number }> {
  if (password.length < 8) return { ok: false, error: 'Use a password of at least 8 characters.', status: 400 };
  const opened = await openResetLink(admin, token);
  if (opened.state !== 'open') {
    const why = { invalid: 'This link isn’t valid.', used: 'This link has already been used.', expired: 'This link has expired.', revoked: 'This link was switched off.' }[opened.state];
    return { ok: false, error: `${why} Ask Memora for a new one.`, status: 410 };
  }
  const { data: claimed } = await admin
    .from('memora_password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', opened.id)
    .is('used_at', null)
    .is('revoked_at', null)
    .select('id');
  if (!claimed?.length) return { ok: false, error: 'This link has just been used. Ask Memora for a new one.', status: 409 };
  const { error } = await admin.auth.admin.updateUserById(opened.userId, { password });
  if (error) {
    await admin.from('memora_password_resets').update({ used_at: null }).eq('id', opened.id);
    return { ok: false, error: 'Could not save the new password. Please try again.', status: 500 };
  }
  await admin.from('memora_activity_log').insert({ actor_user_id: opened.userId, action: 'ADMIN_PASSWORD_RESET_LINK_USED', metadata: { account: opened.label } });
  return { ok: true, label: opened.label };
}
