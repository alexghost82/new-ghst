"""Smoke test for the migration runner.

Runs against a throwaway SQLite DB. Verifies that:
  * a fresh DB applies every migration file once,
  * running again is a no-op (idempotent — no duplicate-column crash),
  * the _migrations ledger matches the migration files on disk,
  * a couple of expected tables/columns exist afterwards.

Designed to run with plain ``python tests/test_migrations_smoke.py`` (no pytest).
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

TEST_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Point the DB at an isolated temp file BEFORE importing project modules.
_TMP = tempfile.mkdtemp(prefix="ghost_migr_smoke_")
os.environ["DATABASE_PATH"] = str(Path(_TMP) / "migr.db")
# A valid throwaway Fernet key (only needed if encryption paths are touched).
os.environ.setdefault("GHOST_MASTER_KEY", "HE2JSrWwoePRadxtar6w3_UvvGBjmGUxZMFVWYV1Qeg=")

from app.storage.database import (  # noqa: E402
    _MIGRATIONS_DIR,
    get_db,
    run_migrations,
)

PASSED = 0
FAILED = 0


def check(label: str, cond: bool) -> None:
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  [PASS] {label}")
    else:
        FAILED += 1
        print(f"  [FAIL] {label}")


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def _column_exists(conn, table: str, column: str) -> bool:
    return any(r[1] == column for r in conn.execute(f"PRAGMA table_info({table})"))


def main() -> int:
    migration_files = sorted(_MIGRATIONS_DIR.glob("*.sql"))
    print(f"Found {len(migration_files)} migration files")

    # First apply.
    run_migrations()
    conn = get_db()
    applied = [r[0] for r in conn.execute("SELECT name FROM _migrations ORDER BY name")]
    check("all migrations recorded once", len(applied) == len(migration_files))
    check(
        "ledger matches files on disk",
        set(applied) == {mf.name for mf in migration_files},
    )
    check("core tables exist", _table_exists(conn, "users") and _table_exists(conn, "conversations"))
    check(
        "later ALTER columns exist",
        _column_exists(conn, "conversations", "accuracy_level"),
    )
    conn.close()

    # Second apply must be a no-op (idempotency / re-run safety).
    try:
        run_migrations()
        rerun_ok = True
    except Exception as exc:  # noqa: BLE001
        print(f"  re-run raised: {exc}")
        rerun_ok = False
    check("re-running migrations is a safe no-op", rerun_ok)

    conn = get_db()
    applied_after = [r[0] for r in conn.execute("SELECT name FROM _migrations")]
    check("no duplicate ledger rows after re-run", len(applied_after) == len(migration_files))
    conn.close()

    print(f"\nRESULTS  passed={PASSED}  failed={FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
