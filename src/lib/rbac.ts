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
  'accounts.help': { scope: 'platform', can: 'Give a family a temporary password when they are locked out' },
  'access.manage': { scope: 'platform', can: 'Create groups, give groups roles, and add or remove people' },
  'audit.view': { scope: 'platform', can: 'Read the audit log of every change' },
  // ---- Funeral home: inside one home only ----
  'org.view': { scope: 'org', can: 'Open the funeral home’s dashboard and see its memorials' },
  'org.memorials.create': { scope: 'org', can: 'Start memorials for the funeral home' },
  'org.memorials.edit': { scope: 'org', can: 'Edit the funeral home’s memorials' },
  'org.memorials.publish': { scope: 'org', can: 'Publish memorials (each one is billed)' },
  'org.runsheet': { scope: 'org', can: 'Get run-sheet links and run funerals on the day' },
  'org.team': { scope: 'org', can: 'Add and remove the funeral home’s own staff' },
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
  /** What this role can't do, said plainly. */
  cannot: string[];
};

export const ROLES = {
  platform_admin: {
    label: 'Administrator',
    scope: 'platform',
    summary: 'Runs Memora. Everything, everywhere.',
    permissions: PLATFORM_PERMISSIONS,
    allOrgs: ORG_PERMISSIONS,
    cannot: ['Remove the owners set in the server settings (MEMORA_ADMIN_PHONES)'],
  },
  ops: {
    label: 'Operations',
    scope: 'platform',
    summary: 'Onboards and looks after funeral homes and memorials day to day.',
    permissions: ['ops.view', 'orgs.manage', 'memorials.view_all', 'memorials.takedown', 'memorials.assign', 'gifts.manage', 'accounts.help', 'audit.view'],
    allOrgs: ['org.view', 'org.memorials.edit', 'org.runsheet', 'org.team', 'org.branding'],
    cannot: ['Change plans, prices or invoices', 'Give anyone roles or change groups', 'Record refunds'],
  },
  support: {
    label: 'Support',
    scope: 'platform',
    summary: 'Helps families and funeral homes who are stuck.',
    permissions: ['ops.view', 'memorials.view_all', 'gifts.manage', 'accounts.help', 'audit.view'],
    allOrgs: ['org.view'],
    cannot: ['Take memorials down', 'Add or disable funeral homes', 'See or change billing', 'Change who has access'],
  },
  finance: {
    label: 'Finance',
    scope: 'platform',
    summary: 'Plans, prices, invoices and refunds.',
    permissions: ['ops.view', 'orgs.billing', 'orders.manage', 'audit.view'],
    allOrgs: ['org.billing.view'],
    cannot: ['Open or change memorials', 'Help with logins', 'Change who has access'],
  },
  auditor: {
    label: 'Auditor',
    scope: 'platform',
    summary: 'Read-only: sees memorials and the audit log.',
    permissions: ['ops.view', 'memorials.view_all', 'audit.view'],
    allOrgs: ['org.view'],
    cannot: ['Change anything'],
  },
  org_owner: {
    label: 'Funeral home owner',
    scope: 'org',
    summary: 'Owns the funeral home’s Memora: team, branding, billing and every memorial.',
    permissions: ORG_PERMISSIONS,
    cannot: ['See other funeral homes', 'Change the plan or prices (ask Memora)'],
  },
  org_admin: {
    label: 'Funeral home manager',
    scope: 'org',
    summary: 'Runs the team and the memorials; sees the bill.',
    permissions: ['org.view', 'org.memorials.create', 'org.memorials.edit', 'org.memorials.publish', 'org.runsheet', 'org.team', 'org.branding', 'org.billing.view'],
    cannot: ['See other funeral homes', 'Change the plan or prices'],
  },
  org_director: {
    label: 'Funeral director',
    scope: 'org',
    summary: 'Creates, publishes and runs funerals.',
    permissions: ['org.view', 'org.memorials.create', 'org.memorials.edit', 'org.memorials.publish', 'org.runsheet'],
    cannot: ['Add or remove staff', 'Change branding', 'See billing'],
  },
  org_staff: {
    label: 'Arrangements staff',
    scope: 'org',
    summary: 'Prepares memorials with families; a director publishes.',
    permissions: ['org.view', 'org.memorials.create', 'org.memorials.edit'],
    cannot: ['Publish memorials', 'Run the day', 'Add staff', 'See billing'],
  },
  org_viewer: {
    label: 'Viewer',
    scope: 'org',
    summary: 'Sees the funeral home’s memorials, changes nothing.',
    permissions: ['org.view'],
    cannot: ['Change anything'],
  },
} as const satisfies Record<string, RoleDef>;

export type Role = keyof typeof ROLES;
export const ALL_ROLES = Object.keys(ROLES) as Role[];
export const isRole = (v: unknown): v is Role => typeof v === 'string' && v in ROLES;
export const roleScope = (r: Role): Scope => ROLES[r].scope;

/** A group as the access engine sees it: its roles, and the funeral home it belongs to (null = Memora itself). */
export type GroupGrant = { roles: Role[]; orgId: string | null; active?: boolean };

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
};

/**
 * Builds a principal from the groups a person is in. Platform roles only count
 * in platform groups, and funeral-home roles only in that home's groups, so a
 * misfiled group can never widen anyone's access. Disabled homes grant nothing.
 */
export function principalFrom(userId: string, groups: GroupGrant[], opts: { owner?: boolean; disabledOrgs?: Set<string> } = {}): Principal {
  const p: Principal = { userId, platform: new Set(), anyOrg: new Set(), orgs: new Map(), roles: new Set(), orgRoles: new Map() };
  const grant = (role: Role, orgId: string | null) => {
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
    }
  };
  if (opts.owner) grant('platform_admin', null);
  for (const g of groups) {
    if (g.active === false) continue;
    for (const r of g.roles) if (isRole(r)) grant(r, g.orgId);
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
 * No one can hand out more than they have: a role may only be given by someone
 * who already holds every permission it grants. Only administrators create
 * administrators. Funeral-home roles need access.manage, or org.team inside
 * that home.
 */
export function canGrantRole(actor: Principal, role: Role, orgId: string | null): boolean {
  const def: RoleDef = ROLES[role];
  if (def.scope === 'platform') {
    if (orgId !== null) return false;
    if (!can(actor, 'access.manage')) return false;
    if (role === 'platform_admin') return actor.roles.has('platform_admin');
    return roleGrants(role).every((perm) => (PERMISSIONS[perm].scope === 'platform' ? actor.platform.has(perm) : actor.anyOrg.has(perm) || actor.roles.has('platform_admin')));
  }
  if (!orgId) return false;
  if (can(actor, 'access.manage')) return true;
  // Only an owner makes another owner.
  if (role === 'org_owner') return actor.orgRoles.get(orgId)?.has('org_owner') ?? false;
  return can(actor, 'org.team', orgId) && def.permissions.every((perm) => can(actor, perm, orgId));
}
