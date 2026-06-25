#!/usr/bin/env bash
#
# Ghost — full Firebase deploy (project: ghst-ebb50)
# ---------------------------------------------------
# Frontend (Vite: index.html marketing + app.html operational) -> Firebase Hosting
# Backend  (FastAPI heavy: YOLO/torch + ChromaDB + SSE)         -> Cloud Run (ghst-api)
# Wired via Hosting rewrites (/api/**, /uploads/**) -> Cloud Run, same-origin.
#
# PREREQUISITE (run once, interactively, in your own terminal):
#   firebase login            # as omer@ghost-il.com
#   gcloud auth login         # as omer@ghost-il.com
#
# Then provide secrets and run this script:
#   export OPENAI_API_KEY="sk-..."           # required
#   export GHOST_MASTER_KEY="$(...)"         # optional: auto-generated if unset
#   export BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"   # optional: needed only on first create
#   bash scripts/deploy-firebase.sh
#
set -euo pipefail

# ---- Config -----------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-ghst-ebb50}"
PROJECT_DISPLAY="${PROJECT_DISPLAY:-ghst}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-ghst-api}"
USE_GCS_VOLUME="${USE_GCS_VOLUME:-1}"          # 1 = persistent /app/data on a GCS bucket
GCS_BUCKET="${GCS_BUCKET:-${PROJECT_ID}-data}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PATH="$HOME/google-cloud-sdk/bin:$PATH"
# gcloud requires Python 3.10-3.14; the system `python3` may be 3.9 (which makes gcloud
# fail to load and falsely report "not authenticated"). Pick a compatible interpreter if
# CLOUDSDK_PYTHON isn't already set; if none is found, leave it unset so gcloud auto-resolves.
if [ -z "${CLOUDSDK_PYTHON:-}" ]; then
  for _py in python3.12 python3.11 python3.13 python3.10 python3.14; do
    if command -v "$_py" >/dev/null 2>&1; then
      export CLOUDSDK_PYTHON="$(command -v "$_py")"; break
    fi
  done
fi

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
die() { printf "\n\033[1;31mERROR: %s\033[0m\n" "$*" >&2; exit 1; }

command -v firebase >/dev/null || die "firebase CLI not found"
command -v gcloud   >/dev/null || die "gcloud CLI not found (expected ~/google-cloud-sdk/bin)"

# ---- 1. Auth sanity ---------------------------------------------------------
say "Checking auth"
firebase projects:list >/dev/null 2>&1 || die "Firebase not authenticated. Run: firebase login --reauth"
ACTIVE_GACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
[ -n "$ACTIVE_GACCOUNT" ] || die "gcloud not authenticated. Run: gcloud auth login"
echo "Firebase OK | gcloud active account: $ACTIVE_GACCOUNT"

# ---- 2. Project -------------------------------------------------------------
# Treat an existing project as success. We probe via gcloud (authoritative for
# the GCP project) and fall back to firebase's list; if creation still runs and
# the project already exists, that "already exists" error is non-fatal.
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 \
  || firebase projects:list 2>/dev/null | grep -qw "$PROJECT_ID"; then
  say "Project $PROJECT_ID already exists"
else
  say "Creating Firebase project $PROJECT_ID ($PROJECT_DISPLAY)"
  firebase projects:create "$PROJECT_ID" --display-name "$PROJECT_DISPLAY" \
    || say "Project $PROJECT_ID already exists (create skipped)"
fi
gcloud config set project "$PROJECT_ID" >/dev/null

# ---- 3. Billing (Blaze) -----------------------------------------------------
BILLING_ENABLED="$(gcloud beta billing projects describe "$PROJECT_ID" \
  --format='value(billingEnabled)' 2>/dev/null || echo False)"
if [ "$BILLING_ENABLED" != "True" ]; then
  if [ -n "${BILLING_ACCOUNT:-}" ]; then
    say "Linking billing account $BILLING_ACCOUNT"
    gcloud beta billing projects link "$PROJECT_ID" --billing-account "$BILLING_ACCOUNT"
  else
    die "Billing not enabled. Set BILLING_ACCOUNT=... (see: gcloud beta billing accounts list) or enable Blaze in the Firebase console, then re-run."
  fi
fi

# ---- 4. Enable required APIs ------------------------------------------------
say "Enabling Google Cloud APIs"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com

# ---- 5. Secrets -------------------------------------------------------------
[ -n "${OPENAI_API_KEY:-}" ] || die "OPENAI_API_KEY not set in environment"
[ -n "${GHOST_DEMO_API_KEY:-}" ] || die "GHOST_DEMO_API_KEY not set (server-side demo/trial key)"
if [ -z "${GHOST_MASTER_KEY:-}" ]; then
  say "Generating GHOST_MASTER_KEY (Fernet) and storing it in Secret Manager only"
  GHOST_MASTER_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())' 2>/dev/null || true)"
  [ -n "$GHOST_MASTER_KEY" ] || GHOST_MASTER_KEY="$(python3 -c 'import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')"
  # NEVER echo the key value — it would leak into CI/terminal logs. It is
  # persisted to Secret Manager below, which is the source of truth.
  say "GHOST_MASTER_KEY generated (value withheld from logs; stored in Secret Manager)"
fi
# Admin token guards internal PII endpoints; generate one if not supplied.
if [ -z "${GHOST_ADMIN_TOKEN:-}" ]; then
  GHOST_ADMIN_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  say "GHOST_ADMIN_TOKEN generated (value withheld; stored in Secret Manager)"
fi
GHOST_GM_CODE="${GHOST_GM_CODE:-}"

upsert_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic
  fi
}
say "Storing secrets in Secret Manager"
upsert_secret OPENAI_API_KEY   "$OPENAI_API_KEY"
upsert_secret GHOST_MASTER_KEY "$GHOST_MASTER_KEY"
upsert_secret GHOST_DEMO_API_KEY "$GHOST_DEMO_API_KEY"
upsert_secret GHOST_ADMIN_TOKEN  "$GHOST_ADMIN_TOKEN"
[ -n "$GHOST_GM_CODE" ] && upsert_secret GHOST_GM_CODE "$GHOST_GM_CODE"

# Grant the Cloud Run runtime SA (Compute default) access to the secrets.
PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
SECRET_NAMES="OPENAI_API_KEY GHOST_MASTER_KEY GHOST_DEMO_API_KEY GHOST_ADMIN_TOKEN"
[ -n "$GHOST_GM_CODE" ] && SECRET_NAMES="$SECRET_NAMES GHOST_GM_CODE"
for s in $SECRET_NAMES; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
done

# ---- 6. Optional persistent data bucket (GCS volume) ------------------------
VOLUME_ARGS=()
if [ "$USE_GCS_VOLUME" = "1" ]; then
  if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" >/dev/null 2>&1; then
    say "Creating GCS bucket gs://${GCS_BUCKET} for persistent /app/data"
    gcloud storage buckets create "gs://${GCS_BUCKET}" --location="$REGION"
  fi
  gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
    --member="serviceAccount:${RUNTIME_SA}" --role="roles/storage.objectAdmin" >/dev/null 2>&1 || true
  VOLUME_ARGS=(
    --add-volume="name=data,type=cloud-storage,bucket=${GCS_BUCKET}"
    --add-volume-mount="volume=data,mount-path=/app/data"
  )
fi

# ---- 6c. Regenerate Ghost product-knowledge snapshot ------------------------
# Ghost answers "who are you / what can you do" ONLY from the 9 marketing
# capabilities. The authoritative list lives in the frontend
# (frontend/src/data/capabilities.ts) and is exported to
# backend/app/data/ghost_capabilities.json. Regenerate it BEFORE the backend
# deploy so the Cloud Run image bundles the current capabilities (the frontend
# build at step 8 regenerates it again, which is fine — same output).
say "Regenerating Ghost capabilities knowledge (frontend -> backend JSON)"
( cd "$REPO_ROOT/frontend" && npm install && npm run gen:knowledge )

# ---- 7. Deploy backend to Cloud Run -----------------------------------------
say "Deploying backend to Cloud Run ($SERVICE) — first build is slow (torch/Chroma)"
gcloud run deploy "$SERVICE" \
  --source "$REPO_ROOT/backend" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 1 \
  --concurrency 40 \
  --set-secrets="$(
    s="OPENAI_API_KEY=OPENAI_API_KEY:latest,GHOST_MASTER_KEY=GHOST_MASTER_KEY:latest"
    s="$s,GHOST_DEMO_API_KEY=GHOST_DEMO_API_KEY:latest,GHOST_ADMIN_TOKEN=GHOST_ADMIN_TOKEN:latest"
    [ -n "$GHOST_GM_CODE" ] && s="$s,GHOST_GM_CODE=GHOST_GM_CODE:latest"
    printf '%s' "$s"
  )" \
  "${VOLUME_ARGS[@]}"

# ---- 7b. Record the deployed backend fingerprint ----------------------------
# After a successful Cloud Run deploy, the local backend source IS what now runs
# in the cloud. Record its fingerprint so the frontend-only deploy ("גו פרונט")
# can later verify the local backend still matches what is deployed before it
# ships a hosting-only release. This is the source of truth for that gate.
MARKER="$REPO_ROOT/.cursor/skills/rashi-deploy/.last_backend_deploy"
mkdir -p "$(dirname "$MARKER")"
if BACKEND_FP="$(bash "$REPO_ROOT/scripts/backend-fingerprint.sh" 2>/dev/null)"; then
  {
    echo "$BACKEND_FP"
    echo "# deployed: $(date -u '+%Y-%m-%dT%H:%M:%SZ') | service: $SERVICE | region: $REGION"
  } > "$MARKER"
  say "Recorded backend fingerprint → $MARKER ($BACKEND_FP)"
else
  warn() { printf "\n\033[1;33mWARN: %s\033[0m\n" "$*" >&2; }
  warn "could not compute backend fingerprint — 'גו פרונט' will require a full deploy first"
fi

# ---- 8. Build frontend + deploy Hosting -------------------------------------
say "Building frontend"
( cd "$REPO_ROOT/frontend" && npm install && npm run build )

say "Deploying Firebase Hosting"
firebase deploy --only hosting --project "$PROJECT_ID"

# ---- 9. Verify --------------------------------------------------------------
TARGET="https://${PROJECT_ID}.web.app"
say "Verifying $TARGET"
sleep 3
echo "Root status: $(curl -s -o /dev/null -w '%{http_code}' "$TARGET")"
echo "API health : $(curl -s "$TARGET/api/health" || true)"

# ---- 9b. Verify the shared demo/admin agent ("ghostdemo") ------------------
# The demo OpenAI key is now SERVER-SIDE only (GHOST_DEMO_API_KEY in Secret
# Manager, deployed in step 5). The hidden 8+0 chord and the public trial both
# log in through dedicated backend endpoints that use that key — no client-side
# key and no cross-env DB key-sync needed anymore. So we just smoke-test the
# demo-admin endpoint returns 200.
say "Verifying demo/admin (ghostdemo) login endpoint"
DEMO_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$TARGET/api/users/demo/admin-login" -H 'Content-Type: application/json' || echo 000)"
if [ "$DEMO_CODE" = "200" ]; then
  ok "Demo/admin (ghostdemo) login OK (200) — 8+0 chord + public trial will work"
else
  die "Demo/admin login returned HTTP $DEMO_CODE (expected 200). Check GHOST_DEMO_API_KEY in Secret Manager."
fi

echo
say "Done. App: $TARGET  |  Operational UI: $TARGET/app.html"
