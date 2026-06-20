import logging
import re
import sqlite3
from pathlib import Path

from app.config import settings

logger = logging.getLogger("ghost.db")

_MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"

_ADD_COLUMN_RE = re.compile(
    r"^\s*ALTER\s+TABLE\s+([`\"]?\w+[`\"]?)\s+ADD\s+(?:COLUMN\s+)?([`\"]?\w+[`\"]?)",
    re.IGNORECASE,
)
_RENAME_COLUMN_RE = re.compile(
    r"^\s*ALTER\s+TABLE\s+([`\"]?\w+[`\"]?)\s+RENAME\s+COLUMN\s+([`\"]?\w+[`\"]?)\s+TO\s+([`\"]?\w+[`\"]?)",
    re.IGNORECASE,
)


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def _unquote(ident: str) -> str:
    return ident.strip().strip('`"')


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({_unquote(table)})").fetchall()
    return any(_unquote(column) == row[1] for row in rows)


def _split_statements(sql: str) -> list[str]:
    """Split a migration into individual statements.

    Strips ``--`` line comments then splits on ``;``. Safe for the DDL-only
    migrations in this project (no triggers / BEGIN...END blocks, verified).
    """
    no_comments = "\n".join(
        line for line in sql.splitlines() if not line.lstrip().startswith("--")
    )
    return [s.strip() for s in no_comments.split(";") if s.strip()]


def _apply_statement(conn: sqlite3.Connection, stmt: str) -> None:
    """Execute one statement, making ADD/RENAME COLUMN idempotent so a re-run
    after a partial failure cannot crash on a duplicate/missing column."""
    add = _ADD_COLUMN_RE.match(stmt)
    if add and _column_exists(conn, add.group(1), add.group(2)):
        logger.info("  skip (column exists): %s", stmt.split("\n")[0][:80])
        return
    ren = _RENAME_COLUMN_RE.match(stmt)
    if ren and not _column_exists(conn, ren.group(1), ren.group(2)):
        logger.info("  skip (already renamed): %s", stmt.split("\n")[0][:80])
        return
    conn.execute(stmt)


def run_migrations() -> None:
    conn = get_db()
    # Manage transactions explicitly so each migration is all-or-nothing.
    conn.isolation_level = None
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS _migrations ("
            "  name TEXT PRIMARY KEY,"
            "  applied_at TEXT NOT NULL DEFAULT (datetime('now'))"
            ")"
        )

        applied = {
            row["name"]
            for row in conn.execute("SELECT name FROM _migrations").fetchall()
        }

        for mf in sorted(_MIGRATIONS_DIR.glob("*.sql")):
            if mf.name in applied:
                continue
            logger.info("Applying migration: %s", mf.name)
            statements = _split_statements(mf.read_text(encoding="utf-8"))
            conn.execute("BEGIN")
            try:
                for stmt in statements:
                    _apply_statement(conn, stmt)
                conn.execute(
                    "INSERT INTO _migrations (name) VALUES (?)", (mf.name,)
                )
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                logger.exception("Migration %s failed — rolled back", mf.name)
                raise
            logger.info("Migration %s applied successfully", mf.name)
    finally:
        conn.close()
