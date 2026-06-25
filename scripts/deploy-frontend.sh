#!/usr/bin/env bash
#
# Ghost — "גו פרונט" short deploy (frontend / Firebase Hosting only)
# ------------------------------------------------------------------------------
# Fast path (~1 min) for changes that live ENTIRELY under frontend/. It rebuilds
# the Vite bundle and publishes a Hosting release, WITHOUT touching the heavy
# Cloud Run backend (whose image build dominates a full deploy at ~13-15 min).
#
# HARD BACKEND GATE (vs. what is deployed in the cloud):
#   Before deploying anything, it compares the current local backend fingerprint
#   against the fingerprint recorded by the last successful FULL deploy
#   (.cursor/skills/rashi-deploy/.last_backend_deploy). If they differ — or the
#   marker is missing — it ABORTS without deploying and tells you to run the full
#   "גו דיפלוי" first. This guarantees "גו פרונט" never ships a frontend that is
#   out of sync with an un-deployed backend change.
#
# Usage:  bash scripts/deploy-frontend.sh
#
# Prereq: firebase login (as omer@ghost-il.com). gcloud auth is NOT needed for a
#         hosting-only deploy.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ghst-ebb50}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MARKER="$REPO_ROOT/.cursor/skills/rashi-deploy/.last_backend_deploy"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

say()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m%s\033[0m\n" "$*"; }
die()  { printf "\n\033[1;31mERROR: %s\033[0m\n" "$*" >&2; exit 1; }

command -v firebase >/dev/null || die "firebase CLI not found"

# ---- 1. Auth sanity (firebase only) -----------------------------------------
say "Checking Firebase auth"
firebase projects:list >/dev/null 2>&1 \
  || die "Firebase not authenticated. Run: firebase login --reauth (as omer@ghost-il.com)"
ok "Firebase authenticated"

# ---- 2. HARD backend gate: local backend must equal what is deployed --------
say "Verifying backend is unchanged vs. the deployed cloud version"
[ -f "$MARKER" ] || die "No backend baseline found ($MARKER).
  The cloud backend fingerprint is unknown, so a frontend-only deploy is unsafe.
  Run a full deploy once to establish it:  bash scripts/deploy-firebase.sh  (\"גו דיפלוי\")"

DEPLOYED_FP="$(head -n 1 "$MARKER" | tr -d '[:space:]')"
[ -n "$DEPLOYED_FP" ] || die "Backend baseline marker is empty ($MARKER). Run a full deploy (\"גו דיפלוי\")."

CURRENT_FP="$(bash "$REPO_ROOT/scripts/backend-fingerprint.sh")" \
  || die "Failed to compute the current backend fingerprint."

if [ "$CURRENT_FP" != "$DEPLOYED_FP" ]; then
  die "Local backend DIFFERS from what is deployed in the cloud — aborting the short deploy.
  deployed: $DEPLOYED_FP
  current : $CURRENT_FP
  Run a FULL deploy so backend+frontend ship together:  bash scripts/deploy-firebase.sh  (\"גו דיפלוי\")"
fi
ok "Backend matches the deployed cloud version ($CURRENT_FP) — safe to ship frontend only"

# ---- 3. Build frontend ------------------------------------------------------
say "Building frontend (Vite)"
( cd "$REPO_ROOT/frontend" && npm install && npm run build )
[ -f "$REPO_ROOT/frontend/dist/index.html" ] || die "frontend/dist/index.html missing after build"

# ---- 4. Deploy Hosting ------------------------------------------------------
say "Deploying Firebase Hosting (frontend only)"
firebase deploy --only hosting --project "$PROJECT_ID"

# ---- 5. Verify --------------------------------------------------------------
TARGET="https://${PROJECT_ID}.web.app"
say "Verifying $TARGET"
sleep 3
ROOT_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$TARGET" || echo 000)"
APP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$TARGET/app.html" || echo 000)"
echo "root:     $ROOT_CODE"
echo "app.html: $APP_CODE"
if [ "$ROOT_CODE" = "200" ] && [ "$APP_CODE" = "200" ]; then
  ok "Short deploy done. App: $TARGET  |  Operational UI: $TARGET/app.html"
else
  die "Live verify failed (root=$ROOT_CODE, app.html=$APP_CODE; expected 200/200). Check the Hosting release."
fi

# ---- 6. Verify the shared demo/admin agent ("ghostdemo") -------------------
# The demo key is server-side only (GHOST_DEMO_API_KEY in Secret Manager), so a
# frontend-only deploy can't affect it. Just smoke-test that demo-admin login
# still returns 200 against the live API.
say "Verifying demo/admin (ghostdemo) login endpoint"
DEMO_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$TARGET/api/users/demo/admin-login" -H 'Content-Type: application/json' || echo 000)"
if [ "$DEMO_CODE" = "200" ]; then
  ok "Demo/admin (ghostdemo) login OK (200)"
else
  die "Demo/admin login returned HTTP $DEMO_CODE (expected 200). Run a full deploy and check GHOST_DEMO_API_KEY."
fi
