#!/usr/bin/env bash
#
# Ghost — sync the shared demo/admin agent ("ghostdemo") key into a target DB.
# -----------------------------------------------------------------------------
# WHY THIS EXISTS
#   The login screen's hidden 8+0 chord ("Legacy shared account" / demo-admin)
#   and the public "Talk to Ghost" trial both log in as the pre-seeded
#   `ghostdemo` agent using the single key defined in
#   frontend/src/config/demoAccess.ts (DEMO_NICKNAME / DEMO_API_KEY).
#
#   The backend stores that key ENCRYPTED (Fernet) in its own SQLite DB the
#   FIRST time the agent is seeded — and never updates it afterwards. Each
#   environment has its own DB:
#     - local  → backend/data/ghost.db
#     - cloud  → SQLite on the GCS bucket ghst-ebb50-data (persists across deploys)
#
#   So when the key in demoAccess.ts is rotated, the LOCAL db gets fixed (we
#   tested against it), but the CLOUD db keeps the OLD key → legacy/admin login
#   returns 401 "Demo access unavailable" in production even after a deploy.
#   Deploying the frontend alone can NEVER fix this; the DB must be re-synced.
#
# WHAT THIS DOES (idempotent, safe to re-run)
#   1. Reads DEMO_NICKNAME + DEMO_API_KEY from frontend/src/config/demoAccess.ts
#      (single source of truth — no duplicated secret here).
#   2. Talks to the target environment's PUBLIC /api:
#        - login first: if it already returns 200, nothing to do.
#        - else find ghostdemo's id via GET /api/users; PATCH /api/users/{id}
#          with the api_key (re-encrypts with THAT env's master key), or POST
#          /api/users to create it if missing.
#   3. Re-verifies login returns 200, else exits non-zero.
#
#   No master key / decryption needed: the backend re-encrypts on PATCH/POST,
#   so this works regardless of per-environment GHOST_MASTER_KEY differences.
#
# Usage:
#   bash scripts/sync-demo-admin.sh                 # default target = cloud
#   API_BASE="http://127.0.0.1:8000" bash scripts/sync-demo-admin.sh   # local
#
set -euo pipefail

API_BASE="${API_BASE:-https://ghst-ebb50.web.app}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEMO_FILE="$REPO_ROOT/frontend/src/config/demoAccess.ts"

say()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m%s\033[0m\n" "$*"; }
die()  { printf "\n\033[1;31mERROR: %s\033[0m\n" "$*" >&2; exit 1; }

command -v python3 >/dev/null || die "python3 required"
[ -f "$DEMO_FILE" ] || die "demoAccess.ts not found at $DEMO_FILE"

# ---- 1. Parse the single source of truth ------------------------------------
read -r DEMO_NICKNAME DEMO_API_KEY < <(python3 - "$DEMO_FILE" <<'PY'
import re, sys
src = open(sys.argv[1], encoding="utf-8").read()
def grab(name):
    m = re.search(r'export\s+const\s+%s\s*=\s*\n?\s*"([^"]+)"' % name, src)
    if not m:
        raise SystemExit(f"could not parse {name} from demoAccess.ts")
    return m.group(1)
print(grab("DEMO_NICKNAME"), grab("DEMO_API_KEY"))
PY
)
[ -n "${DEMO_NICKNAME:-}" ] && [ -n "${DEMO_API_KEY:-}" ] || die "failed to read DEMO_NICKNAME/DEMO_API_KEY"
say "Syncing '$DEMO_NICKNAME' against $API_BASE (key …${DEMO_API_KEY: -4})"

# ---- 2/3. Sync + verify via the public API ----------------------------------
API_BASE="$API_BASE" DEMO_NICKNAME="$DEMO_NICKNAME" DEMO_API_KEY="$DEMO_API_KEY" python3 - <<'PY'
import json, os, sys, urllib.request, urllib.error

base = os.environ["API_BASE"].rstrip("/")
nick = os.environ["DEMO_NICKNAME"]
key  = os.environ["DEMO_API_KEY"]

def call(method, path, payload=None, timeout=30):
    url = base + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode()
            return r.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try: body = json.loads(body)
        except Exception: pass
        return e.code, body

def login_ok():
    st, _ = call("POST", "/api/users/login", {"nickname": nick, "api_key": key})
    return st == 200

# Fast path: already correct.
if login_ok():
    print(f"  login already OK (200) — '{nick}' key already in sync")
    sys.exit(0)

print(f"  login 401 — '{nick}' stored key is stale; syncing…")

# Find existing user id.
st, body = call("GET", "/api/users")
if st != 200:
    print(f"  ERROR: GET /api/users -> HTTP {st}: {body}", file=sys.stderr); sys.exit(1)
users = body.get("data", []) if isinstance(body, dict) else []
match = next((u for u in users if u.get("nickname") == nick), None)

if match:
    uid = match["id"]
    st, body = call("PATCH", f"/api/users/{uid}", {"api_key": key})
    if st not in (200, 201):
        print(f"  ERROR: PATCH /api/users/{uid} -> HTTP {st}: {body}", file=sys.stderr); sys.exit(1)
    print(f"  PATCHed stored key for existing '{nick}' (id {uid})")
else:
    st, body = call("POST", "/api/users", {"nickname": nick, "api_key": key})
    if st not in (200, 201):
        print(f"  ERROR: POST /api/users -> HTTP {st}: {body}", file=sys.stderr); sys.exit(1)
    print(f"  Created '{nick}' (was missing)")

# Re-verify.
if login_ok():
    print(f"  VERIFIED: login now returns 200 for '{nick}'")
    sys.exit(0)
print(f"  ERROR: login still failing after sync for '{nick}'", file=sys.stderr)
sys.exit(1)
PY

ok "Demo/admin agent '$DEMO_NICKNAME' is in sync on $API_BASE"
