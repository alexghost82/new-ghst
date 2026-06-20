/** Frontend mirror of the backend RBAC role labels (app/security/rbac.py).
 * Display-only; the server remains the single source of truth for enforcement. */
export const ROLE_LABELS_HE: Record<string, string> = {
  owner: "בעלים (Super Admin)",
  admin: "מנהל",
  support: "תמיכה",
  finance: "כספים",
  viewer: "צפייה בלבד",
};

export const PERM = {
  USERS_READ: "users.read",
  USERS_WRITE: "users.write",
  USERS_DELETE: "users.delete",
  USERS_RESET: "users.reset",
  USERS_IMPERSONATE: "users.impersonate",
  USERS_CREATE: "users.create",
  USERS_TIER: "users.tier",
  ADMINS_MANAGE: "admins.manage",
  AUDIT_READ: "audit.read",
  USAGE_READ: "usage.read",
  COSTS_READ: "costs.read",
  ERRORS_READ: "errors.read",
  SYSTEM_READ: "system.read",
  SYSTEM_MANAGE: "system.manage",
} as const;
