"""Smoke tests for the Owner / Super-Admin panel.

Runs against a throwaway SQLite DB under ``backend/data/_admin_smoke``. Designed
to run as a plain script (``python tests/test_admin_smoke.py``) — no pytest
dependency — matching the other smoke tests in this folder.

Covers: migrations (admin tables), password hashing, TOTP, JWT issue/verify,
the two-step login flow over HTTP, RBAC enforcement, user lifecycle
(suspend/soft-delete/restore), audit logging, and cost-pricing specificity.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

TEST_ROOT = Path(__file__).resolve().parent
SCRATCH = TEST_ROOT.parent / "data" / "_admin_smoke"
if SCRATCH.exists():
    shutil.rmtree(SCRATCH)
SCRATCH.mkdir(parents=True, exist_ok=True)

os.environ["DATABASE_PATH"] = str(SCRATCH / "ghost.db")
os.environ["CHROMA_PATH"] = str(SCRATCH / "chroma")
os.environ["UPLOAD_PATH"] = str(SCRATCH / "uploads")
os.environ.setdefault("GHOST_MASTER_KEY", "")  # set below if empty
# Persistent owner seed (read by config at import time) — exercised below.
os.environ["GHOST_OWNER_EMAIL"] = "seed-owner@test"
os.environ["GHOST_OWNER_PASSWORD"] = "seed-owner-pass-123456"
os.environ["GHOST_DEMO_API_KEY"] = "sk-demo-smoke-key"

sys.path.insert(0, str(TEST_ROOT.parent))

# A valid Fernet key is required for TOTP-secret encryption.
if not os.environ.get("GHOST_MASTER_KEY"):
    from cryptography.fernet import Fernet

    os.environ["GHOST_MASTER_KEY"] = Fernet.generate_key().decode()

import pyotp  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import estimate_cost_usd  # noqa: E402
from app.security import rbac  # noqa: E402
from app.services import admin_auth_service as a  # noqa: E402
from app.storage import admin_store, user_store  # noqa: E402
from app.storage.database import get_db, run_migrations  # noqa: E402

_passed = 0
_failed = 0


def check(name: str, cond: bool) -> None:
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  [PASS] {name}")
    else:
        _failed += 1
        print(f"  [FAIL] {name}")


def main() -> int:
    run_migrations()
    db = get_db()
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    for t in ("admin_users", "admin_refresh_tokens", "audit_log", "usage_events", "llm_usage", "error_events"):
        check(f"table {t} exists", t in tables)

    secret = a.generate_totp_secret()
    admin_store.create_admin(
        db, email="owner@test", password_hash=a.hash_password("super-secret-pw-1"),
        role="owner", totp_secret=secret, totp_enabled=True,
    )
    u1 = user_store.create_user(db, "alice", "sk-a", origin="standard")
    db.close()

    check("password verifies", a.verify_password(admin_store.get_admin_by_email(get_db(), "owner@test")["password_hash"], "super-secret-pw-1"))
    check("totp verifies", a.verify_totp(secret, pyotp.TOTP(secret).now()))

    # RBAC matrix
    check("owner has admins.manage", rbac.role_has_permission("owner", rbac.PERM_ADMINS_MANAGE))
    check("support lacks delete", not rbac.role_has_permission("support", rbac.PERM_USERS_DELETE))
    check("viewer read-only", rbac.role_has_permission("viewer", rbac.PERM_USERS_READ) and not rbac.role_has_permission("viewer", rbac.PERM_USERS_WRITE))

    # Cost pricing specificity (regression guard for the prefix-shadow bug)
    check("4o-mini not shadowed by 4o", round(estimate_cost_usd("gpt-4o-mini", 1_000_000, 1_000_000), 3) == 0.75)
    check("5-mini not shadowed by 5", round(estimate_cost_usd("gpt-5-mini", 1_000_000, 0), 3) == 0.25)

    from app.main import app

    c = TestClient(app)
    r = c.get("/api/admin/auth/me")
    check("unauth /me -> 401", r.status_code == 401)
    r = c.post("/api/admin/auth/login", json={"email": "owner@test", "password": "wrong"})
    check("bad password -> 401", r.status_code == 401)
    r = c.post("/api/admin/auth/login", json={"email": "owner@test", "password": "super-secret-pw-1"})
    d = r.json()["data"]
    check("login -> mfa stage", d.get("stage") == "mfa")
    r = c.post("/api/admin/auth/mfa", json={"mfa_token": d["mfa_token"], "code": pyotp.TOTP(secret).now()})
    sess = r.json()["data"]
    H = {"Authorization": f"Bearer {sess['access_token']}"}
    check("mfa -> session with owner perms", "users.delete" in sess["admin"]["permissions"])

    check("users list works", c.get("/api/admin/users", headers=H).status_code == 200)
    check("suspend works", c.post(f"/api/admin/users/{u1['id']}/status", json={"status": "suspended"}, headers=H).json()["data"]["status"] == "suspended")
    check("soft-delete works", c.post(f"/api/admin/users/{u1['id']}/delete", json={"reason": "test"}, headers=H).json()["data"]["status"] == "deleted")
    check("restore works", c.post(f"/api/admin/users/{u1['id']}/restore", headers=H).json()["data"]["status"] == "active")
    # Create (owner-only): trial (no key -> demo key) + production (with key).
    rc1 = c.post("/api/admin/users", json={"nickname": "new-trial", "tier": "trial"}, headers=H)
    check("owner creates trial user", rc1.status_code == 201 and rc1.json()["data"]["origin"] == "trial")
    rc2 = c.post("/api/admin/users", json={"nickname": "new-prod", "tier": "production", "api_key": "sk-prod-x"}, headers=H)
    check("owner creates production user", rc2.status_code == 201 and rc2.json()["data"]["origin"] == "standard")
    rc3 = c.post("/api/admin/users", json={"nickname": "no-key", "tier": "production"}, headers=H)
    check("production without key -> 400", rc3.status_code == 400)
    # Tier flip trial -> production.
    tid = rc1.json()["data"]["id"]
    rt = c.post(f"/api/admin/users/{tid}/tier", json={"tier": "production", "reason": "upgrade"}, headers=H)
    check("tier flip trial->production", rt.status_code == 200 and rt.json()["data"]["origin"] == "standard")

    check("audit endpoint works", c.get("/api/admin/audit", headers=H).status_code == 200)
    check("usage overview works", c.get("/api/admin/usage/overview", headers=H).status_code == 200)
    check("costs overview works", c.get("/api/admin/costs/overview", headers=H).status_code == 200)
    check("errors summary works", c.get("/api/admin/errors/summary", headers=H).status_code == 200)
    check("system health works", c.get("/api/admin/system/health", headers=H).status_code == 200)

    # RBAC enforcement: a viewer cannot mutate.
    db = get_db()
    vs = a.generate_totp_secret()
    admin_store.create_admin(db, email="v@test", password_hash=a.hash_password("viewer-pw-12345"), role="viewer", totp_secret=vs, totp_enabled=True)
    db.close()
    r = c.post("/api/admin/auth/login", json={"email": "v@test", "password": "viewer-pw-12345"})
    dd = r.json()["data"]
    r = c.post("/api/admin/auth/mfa", json={"mfa_token": dd["mfa_token"], "code": pyotp.TOTP(vs).now()})
    VH = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
    check("viewer can read users", c.get("/api/admin/users", headers=VH).status_code == 200)
    check("viewer cannot mutate (403)", c.post(f"/api/admin/users/{u1['id']}/status", json={"status": "active"}, headers=VH).status_code == 403)
    check("viewer cannot create (403)", c.post("/api/admin/users", json={"nickname": "x", "tier": "trial"}, headers=VH).status_code == 403)
    check("viewer cannot change tier (403)", c.post(f"/api/admin/users/{u1['id']}/tier", json={"tier": "production"}, headers=VH).status_code == 403)

    # Owner seed from env: creates only if missing, never overwrites.
    from app.main import _seed_owner_admin

    _seed_owner_admin()
    db = get_db()
    seeded = admin_store.get_admin_by_email(db, "seed-owner@test")
    first_hash = seeded["password_hash"] if seeded else None
    db.close()
    check("owner seed created from env", seeded is not None and seeded["role"] == "owner")
    _seed_owner_admin()  # second run must not overwrite
    db = get_db()
    seeded2 = admin_store.get_admin_by_email(db, "seed-owner@test")
    db.close()
    check("owner seed does not overwrite existing", seeded2 and seeded2["password_hash"] == first_hash)

    db = get_db()
    actions = {x[0] for x in db.execute("SELECT DISTINCT action FROM audit_log").fetchall()}
    db.close()
    check("audit captured login + lifecycle + create/tier + denial", {"admin_login_success", "user_status_changed", "user_soft_deleted", "user_created", "user_tier_changed", "permission_denied"}.issubset(actions))

    print(f"\nRESULTS  passed={_passed}  failed={_failed}")
    return 1 if _failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
