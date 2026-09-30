// Who can do what in Memora. ServiceNow's model, simplified:
//
//   person → groups → roles → permissions ("cans")
//
// Permissions are fixed, named capabilities, each with a plain-English "can".
// Roles bundle permissions and say plainly what they can't do. Groups hold roles
// and people; a person gets every permission of every role of every group they
// are in. Everything not granted is denied.
//
// Two scopes. Platform roles run Memora itself (the command centre). Funeral
// home roles only ever apply inside their own funeral home.

export type Scope = 'platform' | 'org';

export const PERMISSIONS = {
  // ---- Platform: the command centre ----
  'ops.view': { scope: 'platform', can: 'Open the command centre and see how Memora is running' },
  'orgs.manage': { scope: 'platform', can: 'Add funeral homes, edit their details and disable or re-enable them' },
  'orgs.billing': { scope: 'platform', can: 'Set plans and prices, and raise and settle invoices' },
  'memorials.view_all': { scope: 'platform', can: 'See every memorial and who owns it' },
  'memorials.takedown': { scope: 'platform', can: 'Take a memorial down, or restore it' },
  'memorials.assign': { scope: 'platform', can: 'Move a memorial into or out of a funeral home' },
  'gifts.manage': { scope: 'platform', can: 'Follow up, recheck and cancel gifted memorials' },
  'orders.manage': { scope: 'platform', can: 'Recheck payments and record refunds' },
  'accounts.help': { scope: 'platform', can: 'Look people up, send password reset links and set temporary passwords' },
  'accounts.suspend': { scope: 'platform', can: 'Suspend an account so it can’t log in, or restore it' },
  'access.manage': { scope: 'platform', can: 'Create groups, give groups roles, and add or remove people' },
  'audit.view': { scope: 'platform', can: 'Read the audit log of every change' },
  // ---- Funeral home: inside one home only ----
  'org.view': { scope: 'org', can: 'Open the funeral home’s dashboard and see its memorials' },
  'org.memorials.create': { scope: 'org', can: 'Start memorials for the funeral home' },
  'org.memorials.edit': { scope: 'org', can: 'Edit the funeral home’s memorials' },
  'org.memorials.publish': { scope: 'org', can: 'Publish memorials (each one is billed)' },
  'org.runsheet': { scope: 'org', can: 'Get run-sheet links and run funerals on the day' },
  'org.team': { scope: 'org', can: 'Appoint and remove staff (a branch manager: arrangers in their own branch)' },
  'org.branches': { scope: 'org', can: 'Add, rename and remove branches, and move memorials between them' },
  'org.branding': { scope: 'org', can: 'Change the funeral home’s name, logo and colour on memorials' },
  'org.billing.view': { scope: 'org', can: 'See the plan, usage and invoices' },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
const PLATFORM_PERMISSIONS = ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].scope === 'platform');
const ORG_PERMISSIONS = ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].scope === 'org');

export type RoleDef = {
  label: string;
  scope: Scope;
  summary: string;
  permissions: Permission[];
  /** Platform roles that also act inside every funeral home (to support them). */
  allOrgs?: Permission[];
  /** Who the role is for, in everyday words. */
  forWho: string;
  /** What this role can't do, said plainly. */
  cannot: string[];
};

export const ROLES = {
  platform_admin: {
    label: 'Administrator',
    scope: 'platform',
    forWho: 'You, and anyone who runs Memora with you.',
    summary: 'Runs Memora. Everything, everywhere.',
    permissions: PLATFORM_PERMISSIONS,
    allOrgs: ORG_PERMISSIONS,
    cannot: ['Remove the owners set in the server settings (MEMORA_ADMIN_PHONES)'],
  },
  ops: {
    label: 'Operations',
    scope: 'platform',
    forWho: 'The person who signs up funeral homes and keeps things running.',
    summary: 'Onboards and looks after funeral homes and memorials day to day.',
    permissions: ['ops.view', 'orgs.manage', 'memorials.view_all', 'memorials.takedown', 'memorials.assign', 'gifts.manage', 'accounts.help', 'accounts.suspend', 'audit.view'],
    allOrgs: ['org.view', 'org.memorials.edit', 'org.runsheet', 'org.team', 'org.branches', 'org.branding'],
    cannot: ['Change plans, prices or invoices', 'Give anyone roles or change groups', 'Record refunds'],
  },
  support: {
    label: 'Support',
    scope: 'platform',
    forWho: 'Whoever answers families’ and funeral homes’ WhatsApps.',
    summary: 'Helps families and funeral homes who are stuck.',
    permissions: ['ops.view', 'memorials.view_all', 'gifts.manage', 'accounts.help', 'audit.view'],
    allOrgs: ['org.view'],
    cannot: ['Take memorials down', 'Suspend accounts', 'Add or disable funeral homes', 'See or change billing', 'Change who has access'],
  },
  finance: {
    label: 'Finance',
    scope: 'platform',
    forWho: 'Whoever sends invoices and checks payments.',
    summary: 'Plans, prices, invoices and refunds.',
    permissions: ['ops.view', 'orgs.billing', 'orders.manage', 'audit.view'],
    allOrgs: ['org.billing.view'],
    cannot: ['Open or change memorials', 'Help with logins', 'Change who has access'],
  },
  auditor: {
    label: 'Auditor',
    scope: 'platform',
    forWho: 'An accountant or partner who needs to look, not touch.',
    summary: 'Read-only: sees memorials and the audit log.',
    permissions: ['ops.view', 'memorials.view_all', 'audit.view'],
    allOrgs: ['org.view'],
    cannot: ['Change anything'],
  },
  org_owner: {
    label: 'Owner',
    scope: 'org',
    forWho: 'The owner of the funeral home business.',
    summary: 'Owns the funeral home’s Memora: branches, people, branding, billing and every memorial.',
    permissions: ORG_PERMISSIONS,
    cannot: ['See other funeral homes', 'Change the plan or prices (ask Memora)'],
  },
  org_admin: {
    label: 'Branch manager',
    scope: 'org',
    forWho: 'The manager of one branch.',
    summary: 'Runs a branch: its arrangers and its funerals.',
    permissions: ['org.view', 'org.memorials.create', 'org.memorials.edit', 'org.memorials.publish', 'org.runsheet', 'org.team'],
    cannot: ['Add or remove branches', 'Appoint managers or owners', 'Work in other branches', 'Change branding', 'See billing'],
  },
  org_staff: {
    label: 'Arranger',
    scope: 'org',
    forWho: 'The arranger who sits with the family at the branch.',
    summary: 'Sits with families, then prepares, publishes and runs their funerals.',
    permissions: ['org.view', 'org.memorials.create', 'org.memorials.edit', 'org.memorials.publish', 'org.runsheet'],
    cannot: ['Appoint or remove staff', 'Work in other branches', 'Change branding', 'See billing'],
  },
} as const satisfies Record<string, RoleDef>;

export type Role = keyof typeof ROLES;

/**
 * The funeral-home roles that may edit that home's memorials. The database
 * checks the same list (memora_org_edits in migration 0012): keep them in step.
 */
export const ORG_EDIT_ROLES = (Object.keys(ROLES) as Role[]).filter((r) => ROLES[r].scope === 'org' && (ROLES[r].permissions as readonly Permission[]).includes('org.memorials.edit'));
export const ALL_ROLES = Object.keys(ROLES) as Role[];
export const isRole = (v: unknown): v is Role => typeof v === 'string' && v in ROLES;
export const roleScope = (r: Role): Scope => ROLES[r].scope;

/**
 * A group as the access engine sees it: its roles, the funeral home it belongs
 * to (null = Memora itself), and the branch (null = the whole home).
 */
export type GroupGrant = { roles: Role[]; orgId: string | null; branchId?: string | null; active?: boolean };

/** Everything one person may do, worked out once per request. */
export type Principal = {
  userId: string;
  platform: Set<Permission>;
  /** Permissions inside every funeral home (support roles). */
  anyOrg: Set<Permission>;
  /** Permissions inside particular funeral homes. */
  orgs: Map<string, Set<Permission>>;
  roles: Set<Role>;
  /** Funeral-home roles held in each home. */
  orgRoles: Map<string, Set<Role>>;
  /** Permissions held across a whole home (home-wide groups, e.g. owners). */
  orgWide: Map<string, Set<Permission>>;
  /** Permissions held in particular branches: home → branch → permissions. */
  branches: Map<string, Map<string, Set<Permission>>>;
};

/**
 * Builds a principal from the groups a person is in. Platform roles only count
 * in platform groups, and funeral-home roles only in that home's groups, so a
 * misfiled group can never widen anyone's access. Disabled homes grant nothing.
 */
export function principalFrom(userId: string, groups: GroupGrant[], opts: { owner?: boolean; disabledOrgs?: Set<string> } = {}): Principal {
  const p: Principal = { userId, platform: new Set(), anyOrg: new Set(), orgs: new Map(), roles: new Set(), orgRoles: new Map(), orgWide: new Map(), branches: new Map() };
  const grant = (role: Role, orgId: string | null, branchId: string | null = null) => {
    const def: RoleDef = ROLES[role];
    if (def.scope === 'platform' && orgId === null) {
      p.roles.add(role);
      def.permissions.forEach((x) => p.platform.add(x));
      def.allOrgs?.forEach((x) => p.anyOrg.add(x));
    } else if (def.scope === 'org' && orgId && !opts.disabledOrgs?.has(orgId)) {
      p.roles.add(role);
      const set = p.orgs.get(orgId) ?? new Set<Permission>();
      def.permissions.forEach((x) => set.add(x));
      p.orgs.set(orgId, set);
      p.orgRoles.set(orgId, (p.orgRoles.get(orgId) ?? new Set<Role>()).add(role));
      if (branchId) {
        const home = p.branches.get(orgId) ?? new Map<string, Set<Permission>>();
        const b = home.get(branchId) ?? new Set<Permission>();
        def.permissions.forEach((x) => b.add(x));
        home.set(branchId, b);
        p.branches.set(orgId, home);
      } else {
        const wide = p.orgWide.get(orgId) ?? new Set<Permission>();
        def.permissions.forEach((x) => wide.add(x));
        p.orgWide.set(orgId, wide);
      }
    }
  };
  if (opts.owner) grant('platform_admin', null);
  for (const g of groups) {
    if (g.active === false) continue;
    for (const r of g.roles) if (isRole(r)) grant(r, g.orgId, g.branchId ?? null);
  }
  return p;
}

/** Can this person do this (inside this funeral home, for funeral-home permissions)? Deny by default. */
export function can(p: Principal | null, permission: Permission, orgId?: string | null): boolean {
  if (!p) return false;
  if (PERMISSIONS[permission].scope === 'platform') return p.platform.has(permission);
  if (p.anyOrg.has(permission)) return true;
  if (!orgId) return false;
  return p.orgs.get(orgId)?.has(permission) ?? false;
}

/** The funeral homes this person belongs to. */
export function orgsOf(p: Principal | null): string[] {
  return p ? [...p.orgs.keys()] : [];
}

/** Every permission a role grants, platform and funeral home alike. */
export function roleGrants(role: Role): Permission[] {
  const def: RoleDef = ROLES[role];
  return [...new Set([...def.permissions, ...(def.allOrgs ?? [])])];
}

/**
 * Can this person do this in this branch? Home-wide roles (owners) and Memora's
 * support roles count in every branch; branch roles only in their own branch.
 * With no branch named, only home-wide permissions count.
 */
export function canIn(p: Principal | null, permission: Permission, orgId: string | null | undefined, branchId: string | null | undefined): boolean {
  if (!p) return false;
  if (PERMISSIONS[permission].scope === 'platform') return p.platform.has(permission);
  if (p.anyOrg.has(permission)) return true;
  if (!orgId) return false;
  if (p.orgWide.get(orgId)?.has(permission)) return true;
  return Boolean(branchId && p.branches.get(orgId)?.get(branchId)?.has(permission));
}

/** Which of a home's branches this person works in: all of them, or a list. */
export function branchScope(p: Principal | null, orgId: string): 'all' | string[] {
  if (!p) return [];
  if (p.anyOrg.has('org.view') || p.orgWide.get(orgId)?.has('org.view')) return 'all';
  return [...(p.branches.get(orgId)?.entries() ?? [])].filter(([, perms]) => perms.has('org.view')).map(([id]) => id);
}

/** Owners sit in home-wide groups; managers and arrangers in a branch's groups. */
export const BRANCH_ROLES: Role[] = ['org_admin', 'org_staff'];

/**
 * No one can hand out more than they have. Only administrators make
 * administrators. In a funeral home: only an owner makes an owner; an owner
 * appoints branch managers; a branch manager appoints arrangers in their own
 * branch. Memora's access managers can do any of it.
 */
export function canGrantRole(actor: Principal, role: Role, orgId: string | null, branchId: string | null = null): boolean {
  const def: RoleDef = ROLES[role];
  if (def.scope === 'platform') {
    if (orgId !== null || branchId !== null) return false;
    if (!can(actor, 'access.manage')) return false;
    if (role === 'platform_admin') return actor.roles.has('platform_admin');
    return roleGrants(role).every((perm) => (PERMISSIONS[perm].scope === 'platform' ? actor.platform.has(perm) : actor.anyOrg.has(perm) || actor.roles.has('platform_admin')));
  }
  if (!orgId) return false;
  // Each role lives at its own level: owners home-wide, the others in a branch.
  if (BRANCH_ROLES.includes(role) !== Boolean(branchId)) return false;
  if (can(actor, 'access.manage')) return true;
  if (role === 'org_owner') return (actor.orgRoles.get(orgId)?.has('org_owner') ?? false) && Boolean(actor.orgWide.get(orgId)?.has('org.team'));
  if (role === 'org_admin') return canIn(actor, 'org.team', orgId, null);
  return canIn(actor, 'org.team', orgId, branchId) && def.permissions.every((perm) => canIn(actor, perm, orgId, branchId));
}
