#!/usr/bin/env python3
"""Bootstrap / manage Owner / Super-Admin accounts for the Ghost admin panel.

This is the ONLY way an admin is created — there is no public sign-up endpoint.
Run it from the ``backend/`` directory:

    python scripts/create_admin.py --email you@example.com --role owner

The password is read interactively (never passed on the command line / shell
history) unless ``--password`` is given for non-interactive provisioning. 2FA is
NOT set here: the admin enrolls TOTP on their first login.

Requires the same environment as the server (notably ``GHOST_MASTER_KEY``),
since the TOTP secret column is encrypted with it.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

# Allow ``python scripts/create_admin.py`` from the backend dir.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.security.rbac import VALID_ROLES  # noqa: E402
from app.services.admin_auth_service import hash_password  # noqa: E402
from app.storage.admin_store import (  # noqa: E402
    create_admin,
    get_admin_by_email,
    update_admin_password,
)
from app.storage.database import get_db, run_migrations  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or reset a Ghost admin account")
    parser.add_argument("--email", required=True, help="Admin login email")
    parser.add_argument("--role", default="owner", choices=VALID_ROLES, help="RBAC role")
    parser.add_argument("--name", default="", help="Display name")
    parser.add_argument(
        "--password",
        default=None,
        help="Password (omit to be prompted securely; recommended)",
    )
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="If the email already exists, reset its password instead of failing",
    )
    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass("New admin password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("ERROR: passwords do not match", file=sys.stderr)
            return 1
    if len(password) < 12:
        print("ERROR: password must be at least 12 characters", file=sys.stderr)
        return 1

    # Ensure the admin tables exist before we touch them.
    run_migrations()

    db = get_db()
    try:
        existing = get_admin_by_email(db, args.email)
        if existing:
            if not args.reset_password:
                print(
                    f"ERROR: admin '{args.email}' already exists "
                    f"(use --reset-password to set a new password)",
                    file=sys.stderr,
                )
                return 1
            update_admin_password(db, existing["id"], hash_password(password))
            print(f"OK: password reset for admin '{args.email}' (role={existing['role']})")
            return 0

        admin = create_admin(
            db,
            email=args.email,
            password_hash=hash_password(password),
            role=args.role,
            display_name=args.name,
            created_by="cli-bootstrap",
        )
        print(
            f"OK: created admin '{admin['email']}' (id={admin['id']}, role={admin['role']}).\n"
            f"    Sign in at /admin — you will enroll 2FA (TOTP) on first login."
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
