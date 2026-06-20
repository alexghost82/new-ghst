"""Owner / Super-Admin panel routes, mounted under ``/api/admin``.

Submodules:
  - auth:  login (password → TOTP), refresh, logout, me.
  - users: operator account management (Stage 4).
  - audit: audit-log reads (Stage 5).

All routes except the auth login/refresh endpoints sit behind the JWT + RBAC
dependencies in ``app.dependencies``.
"""

from fastapi import APIRouter

from app.routes.admin import audit as _audit
from app.routes.admin import auth as _auth
from app.routes.admin import costs as _costs
from app.routes.admin import errors as _errors
from app.routes.admin import system as _system
from app.routes.admin import usage as _usage
from app.routes.admin import users as _users

router = APIRouter(prefix="/admin", tags=["admin"])
router.include_router(_auth.router)
router.include_router(_users.router)
router.include_router(_audit.router)
router.include_router(_usage.router)
router.include_router(_costs.router)
router.include_router(_errors.router)
router.include_router(_system.router)
