"""Role-Based Access Control for the Owner / Super-Admin panel.

A deliberately small, fixed role set (RBAC, not ABAC) — easy to audit and
reason about at the current scale. Every admin route declares the permission it
requires; ``role_has_permission`` is the single source of truth that maps a
role to the permissions it grants. The ``owner`` role holds the ``*`` wildcard
and can do everything.

Permission naming: ``<domain>.<action>`` where action is ``read`` or ``write``
(write implies the destructive/mutating operations within that domain). A few
high-risk capabilities get their own explicit permission so a role can be
granted read+write WITHOUT them (e.g. ``users.delete``, ``users.impersonate``).
"""

from __future__ import annotations

# Canonical permission strings. Kept as constants so typos surface immediately.
PERM_USERS_READ = "users.read"
PERM_USERS_WRITE = "users.write"
PERM_USERS_DELETE = "users.delete"
PERM_USERS_RESET = "users.reset"          # password reset / magic-link minting
PERM_USERS_IMPERSONATE = "users.impersonate"
PERM_USERS_CREATE = "users.create"        # provision a new operator (owner-only)
PERM_USERS_TIER = "users.tier"            # change trial<->production (owner-only)
PERM_ADMINS_MANAGE = "admins.manage"      # create/edit/disable other admins
PERM_AUDIT_READ = "audit.read"
PERM_USAGE_READ = "usage.read"
PERM_COSTS_READ = "costs.read"
PERM_ERRORS_READ = "errors.read"
PERM_SYSTEM_READ = "system.read"          # overview / health / dashboards
PERM_SYSTEM_MANAGE = "system.manage"      # settings, feature flags, policies

ALL_PERMISSIONS: tuple[str, ...] = (
    PERM_USERS_READ,
    PERM_USERS_WRITE,
    PERM_USERS_DELETE,
    PERM_USERS_RESET,
    PERM_USERS_IMPERSONATE,
    PERM_USERS_CREATE,
    PERM_USERS_TIER,
    PERM_ADMINS_MANAGE,
    PERM_AUDIT_READ,
    PERM_USAGE_READ,
    PERM_COSTS_READ,
    PERM_ERRORS_READ,
    PERM_SYSTEM_READ,
    PERM_SYSTEM_MANAGE,
)

VALID_ROLES: tuple[str, ...] = ("owner", "admin", "support", "finance", "viewer")

# Hebrew labels for the panel (management-friendly).
ROLE_LABELS_HE = {
    "owner": "בעלים (Super Admin)",
    "admin": "מנהל",
    "support": "תמיכה",
    "finance": "כספים",
    "viewer": "צפייה בלבד",
}

_READ_ONLY_SET = frozenset(
    {
        PERM_USERS_READ,
        PERM_AUDIT_READ,
        PERM_USAGE_READ,
        PERM_COSTS_READ,
        PERM_ERRORS_READ,
        PERM_SYSTEM_READ,
    }
)

_ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    # Owner is handled via the "*" wildcard in role_has_permission.
    "owner": frozenset({"*"}),
    "admin": frozenset(
        {
            PERM_USERS_READ,
            PERM_USERS_WRITE,
            PERM_USERS_DELETE,
            PERM_USERS_RESET,
            PERM_AUDIT_READ,
            PERM_USAGE_READ,
            PERM_COSTS_READ,
            PERM_ERRORS_READ,
            PERM_SYSTEM_READ,
        }
    ),
    "support": frozenset(
        {
            PERM_USERS_READ,
            PERM_USERS_RESET,
            PERM_USERS_IMPERSONATE,
            PERM_AUDIT_READ,
            PERM_USAGE_READ,
            PERM_ERRORS_READ,
            PERM_SYSTEM_READ,
        }
    ),
    "finance": frozenset(
        {
            PERM_COSTS_READ,
            PERM_USAGE_READ,
            PERM_SYSTEM_READ,
        }
    ),
    "viewer": _READ_ONLY_SET,
}


def role_has_permission(role: str | None, permission: str) -> bool:
    """True if ``role`` grants ``permission``. Owner holds the wildcard."""
    perms = _ROLE_PERMISSIONS.get((role or "").strip().lower())
    if not perms:
        return False
    return "*" in perms or permission in perms


def permissions_for_role(role: str | None) -> list[str]:
    """The explicit permission list for a role (expands owner's wildcard to the
    full set) — handy for telling the frontend what the current admin can do."""
    r = (role or "").strip().lower()
    perms = _ROLE_PERMISSIONS.get(r)
    if not perms:
        return []
    if "*" in perms:
        return list(ALL_PERMISSIONS)
    return sorted(perms)


def is_valid_role(role: str | None) -> bool:
    return (role or "").strip().lower() in VALID_ROLES
