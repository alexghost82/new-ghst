#!/usr/bin/env bash
#
# Deploy ghost-api (Cloud Run service ghst-api) — no GPU, wired to ghost-vlm.
#
# Does NOT deploy Firebase Hosting. For a full stack deploy use scripts/deploy-firebase.sh
# after ghost-vlm is up, or run this script to refresh backend env only.
#
# Prerequisites:
#   ghost-vlm already deployed (bash scripts/deploy-ghost-vlm.sh)
#   export OPENAI_API_KEY=... GHOST_DEMO_API_KEY=...  (+ optional GHOST_MASTER_KEY, GHOST_ADMIN_TOKEN)
#   export LOCAL_VLM_API_KEY=...  (same bearer as ghost-vlm)
#
# Optional: source cloudrun/ghost-api.env.example into your shell first.
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ghst-ebb50}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-ghst-api}"
VLM_SERVICE="${VLM_SERVICE:-ghost-vlm}"
LOCAL_VLM_ENABLED="${LOCAL_VLM_ENABLED:-true}"
LOCAL_VLM_MODEL="${LOCAL_VLM_MODEL:-Qwen/Qwen3-VL-8B-Instruct}"
GHOST_VISION_PROVIDER="${GHOST_VISION_PROVIDER:-auto}"
LOCAL_VLM_TIMEOUT_SECONDS="${LOCAL_VLM_TIMEOUT_SECONDS:-180}"
USE_GCS_VOLUME="${USE_GCS_VOLUME:-1}"
GCS_BUCKET="${GCS_BUCKET:-${PROJECT_ID}-data}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export PATH="$HOME/google-cloud-sdk/bin:$PATH"
if [ -z "${CLOUDSDK_PYTHON:-}" ]; then
  for _py in python3.12 python3.11 python3.13 python3.10 python3.14; do
    if command -v "$_py" >/dev/null 2>&1; then
      export CLOUDSDK_PYTHON="$(command -v "$_py")"; break
    fi
  done
fi

say() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
die() { printf "\n\033[1;31mERROR: %s\033[0m\n" "$*" >&2; exit 1; }

command -v gcloud >/dev/null || die "gcloud CLI not found"
[ -n "${OPENAI_API_KEY:-}" ] || die "OPENAI_API_KEY not set"
[ -n "${GHOST_DEMO_API_KEY:-}" ] || die "GHOST_DEMO_API_KEY not set"
[ -n "${LOCAL_VLM_API_KEY:-}" ] || die "LOCAL_VLM_API_KEY not set (must match ghost-vlm)"

ACTIVE_GACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
[ -n "$ACTIVE_GACCOUNT" ] || die "gcloud not authenticated. Run: gcloud auth login"

gcloud config set project "$PROJECT_ID" >/dev/null

if [ -z "${GHOST_VLM_URL:-}" ] && [ -z "${LOCAL_VLM_BASE_URL:-}" ]; then
  if gcloud run services describe "$VLM_SERVICE" --region "$REGION" >/dev/null 2>&1; then
    GHOST_VLM_URL="$(gcloud run services describe "$VLM_SERVICE" --region "$REGION" --format='value(status.url)')"
    say "Discovered $VLM_SERVICE URL: $GHOST_VLM_URL"
  else
    die "Set GHOST_VLM_URL or LOCAL_VLM_BASE_URL, or deploy ghost-vlm first ($VLM_SERVICE not found)"
  fi
fi

LOCAL_VLM_BASE_URL="${LOCAL_VLM_BASE_URL:-${GHOST_VLM_URL:-}}"
LOCAL_VLM_BASE_URL="${LOCAL_VLM_BASE_URL%/}"

if [ -z "${GHOST_MASTER_KEY:-}" ]; then
  say "Generating GHOST_MASTER_KEY (stored in Secret Manager only)"
  GHOST_MASTER_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())' 2>/dev/null || true)"
  [ -n "$GHOST_MASTER_KEY" ] || GHOST_MASTER_KEY="$(python3 -c 'import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')"
fi
if [ -z "${GHOST_ADMIN_TOKEN:-}" ]; then
  GHOST_ADMIN_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  say "GHOST_ADMIN_TOKEN generated (stored in Secret Manager only)"
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
upsert_secret OPENAI_API_KEY "$OPENAI_API_KEY"
upsert_secret GHOST_MASTER_KEY "$GHOST_MASTER_KEY"
upsert_secret GHOST_DEMO_API_KEY "$GHOST_DEMO_API_KEY"
upsert_secret GHOST_ADMIN_TOKEN "$GHOST_ADMIN_TOKEN"
upsert_secret LOCAL_VLM_API_KEY "$LOCAL_VLM_API_KEY"
[ -n "$GHOST_GM_CODE" ] && upsert_secret GHOST_GM_CODE "$GHOST_GM_CODE"

PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
SECRET_NAMES="OPENAI_API_KEY GHOST_MASTER_KEY GHOST_DEMO_API_KEY GHOST_ADMIN_TOKEN LOCAL_VLM_API_KEY"
[ -n "$GHOST_GM_CODE" ] && SECRET_NAMES="$SECRET_NAMES GHOST_GM_CODE"
for s in $SECRET_NAMES; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
done

VOLUME_ARGS=()
if [ "$USE_GCS_VOLUME" = "1" ]; then
  if ! gcloud storage buckets describe "gs://${GCS_BUCKET}" >/dev/null 2>&1; then
    say "Creating GCS bucket gs://${GCS_BUCKET}"
    gcloud storage buckets create "gs://${GCS_BUCKET}" --location="$REGION"
  fi
  gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
    --member="serviceAccount:${RUNTIME_SA}" --role="roles/storage.objectAdmin" >/dev/null 2>&1 || true
  VOLUME_ARGS=(
    --add-volume="name=data,type=cloud-storage,bucket=${GCS_BUCKET}"
    --add-volume-mount="volume=data,mount-path=/app/data"
  )
fi

say "Regenerating Ghost capabilities knowledge"
( cd "$REPO_ROOT/frontend" && npm install && npm run gen:knowledge )

ENV_VARS="LOCAL_VLM_ENABLED=${LOCAL_VLM_ENABLED}"
ENV_VARS="${ENV_VARS},LOCAL_VLM_BASE_URL=${LOCAL_VLM_BASE_URL}"
ENV_VARS="${ENV_VARS},LOCAL_VLM_MODEL=${LOCAL_VLM_MODEL}"
ENV_VARS="${ENV_VARS},GHOST_VISION_PROVIDER=${GHOST_VISION_PROVIDER}"
ENV_VARS="${ENV_VARS},LOCAL_VLM_TIMEOUT_SECONDS=${LOCAL_VLM_TIMEOUT_SECONDS}"

SECRET_BINDINGS="OPENAI_API_KEY=OPENAI_API_KEY:latest"
SECRET_BINDINGS="${SECRET_BINDINGS},GHOST_MASTER_KEY=GHOST_MASTER_KEY:latest"
SECRET_BINDINGS="${SECRET_BINDINGS},GHOST_DEMO_API_KEY=GHOST_DEMO_API_KEY:latest"
SECRET_BINDINGS="${SECRET_BINDINGS},GHOST_ADMIN_TOKEN=GHOST_ADMIN_TOKEN:latest"
SECRET_BINDINGS="${SECRET_BINDINGS},LOCAL_VLM_API_KEY=LOCAL_VLM_API_KEY:latest"
[ -n "$GHOST_GM_CODE" ] && SECRET_BINDINGS="${SECRET_BINDINGS},GHOST_GM_CODE=GHOST_GM_CODE:latest"

say "Deploying $SERVICE (no GPU) → local VLM at $LOCAL_VLM_BASE_URL"
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
  --set-env-vars="$ENV_VARS" \
  --set-secrets="$SECRET_BINDINGS" \
  "${VOLUME_ARGS[@]}"

API_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
say "$SERVICE deployed: $API_URL"
echo
echo "Firebase Hosting still rewrites /api/** → $SERVICE (see firebase.json)."
echo "ghost-vlm is NOT exposed via Hosting — internal vision backend only."
echo "Smoke test (after Hosting deploy): curl -s https://${PROJECT_ID}.web.app/api/health"
