#!/usr/bin/env bash
#
# rashi-deploy — deterministic backend source fingerprint.
# ------------------------------------------------------------------------------
# Prints a single SHA256 hex digest of the backend source tree, computed over the
# exact set of files that `gcloud run deploy --source backend` would upload, i.e.
# honoring backend/.gcloudignore excludes. The digest is stable across machines
# and runs (sorted file list, content-addressed), so it can be written after a
# full deploy and later compared by the frontend-only deploy ("גו פרונט") to
# prove the local backend is identical to what is currently deployed to the cloud.
#
# Usage:  bash scripts/backend-fingerprint.sh            # prints the digest
#         FP="$(bash scripts/backend-fingerprint.sh)"
#
# This is the single source of truth for the computation — both the full deploy
# (which records the marker) and the short deploy (which checks it) call this.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

[ -d "$BACKEND_DIR" ] || { echo "backend dir not found: $BACKEND_DIR" >&2; exit 1; }

# Pick a sha256 tool (macOS has `shasum`, Linux has `sha256sum`).
if command -v sha256sum >/dev/null 2>&1; then
  SHA() { sha256sum "$@"; }
elif command -v shasum >/dev/null 2>&1; then
  SHA() { shasum -a 256 "$@"; }
else
  echo "no sha256 tool found (need sha256sum or shasum)" >&2; exit 1
fi

cd "$BACKEND_DIR"

# Excludes mirror backend/.gcloudignore. Directories are pruned; file globs are
# filtered. Keep this list in sync with backend/.gcloudignore.
#   venv/ .venv/ data/ __pycache__/ tests/ .pytest_cache/ .git/ node_modules/
#   *.pyc *.pyo *.db *.sqlite *.sqlite3 .env .env.* .DS_Store
FILES="$(
  find . \
    \( -type d \( \
         -name venv -o -name .venv -o -name data -o -name __pycache__ \
         -o -name tests -o -name .pytest_cache -o -name .git -o -name node_modules \
       \) -prune \) -o \
    \( -type f \
       ! -name '*.pyc' ! -name '*.pyo' \
       ! -name '*.db' ! -name '*.sqlite' ! -name '*.sqlite3' \
       ! -name '.env' ! -name '.env.*' ! -name '.DS_Store' \
       -print \)
)"

# Stable order regardless of filesystem/locale, then hash "<digest>  <path>" lines
# and hash that aggregate. LC_ALL=C guarantees byte-wise sort consistency.
DIGEST="$(
  printf '%s\n' "$FILES" \
    | LC_ALL=C sort \
    | while IFS= read -r f; do
        [ -n "$f" ] || continue
        SHA "$f"
      done \
    | SHA - \
    | awk '{print $1}'
)"

printf '%s\n' "$DIGEST"
