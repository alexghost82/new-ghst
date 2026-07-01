#!/usr/bin/env bash
#
# Deploy ghost-vlm — Cloud Run GPU (NVIDIA L4) for OpenAI-compatible vision inference.
#
# Prerequisites:
#   gcloud auth login && gcloud config set project "$PROJECT_ID"
#   export HF_TOKEN=hf_...              # Hugging Face (gated models)
#   export LOCAL_VLM_API_KEY=...        # Shared bearer; validated by ghost-vlm container
#
# Optional: source cloudrun/ghost-vlm.env.example values into your shell first.
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ghst-ebb50}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-ghost-vlm}"
MEMORY="${MEMORY:-32Gi}"
CPU="${CPU:-8}"
TIMEOUT="${TIMEOUT:-3600}"
CONCURRENCY="${CONCURRENCY:-1}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-2}"
LOCAL_VLM_MODEL="${LOCAL_VLM_MODEL:-Qwen/Qwen3-VL-8B-Instruct}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${GHOST_VLM_SOURCE:-$REPO_ROOT/ghost-vlm}"

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
[ -d "$SOURCE_DIR" ] || die "ghost-vlm source not found at $SOURCE_DIR (Agent C: ghost-vlm/)"
[ -n "${HF_TOKEN:-}" ] || die "HF_TOKEN not set"
[ -n "${LOCAL_VLM_API_KEY:-}" ] || die "LOCAL_VLM_API_KEY not set"

ACTIVE_GACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
[ -n "$ACTIVE_GACCOUNT" ] || die "gcloud not authenticated. Run: gcloud auth login"

gcloud config set project "$PROJECT_ID" >/dev/null

say "Enabling APIs for Cloud Run GPU"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

upsert_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=-
  else
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic
  fi
}

say "Storing HF_TOKEN and LOCAL_VLM_API_KEY in Secret Manager"
upsert_secret HF_TOKEN "$HF_TOKEN"
upsert_secret LOCAL_VLM_API_KEY "$LOCAL_VLM_API_KEY"

PROJECT_NUM="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
for s in HF_TOKEN LOCAL_VLM_API_KEY; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null 2>&1 || true
done

# MVP: application-layer bearer (LOCAL_VLM_API_KEY). Cloud Run ingress stays public so
# ghst-api can call the URL with only the shared bearer (no identity-token change in backend).
# Harden later: --no-allow-unauthenticated + roles/run.invoker on ghst-api SA (see cloudrun/README.md).
ALLOW_FLAG=(--allow-unauthenticated)
if [ "${GHOST_VLM_NO_PUBLIC_INGRESS:-}" = "1" ]; then
  ALLOW_FLAG=(--no-allow-unauthenticated)
  say "Granting ghst-api runtime SA invoker on $SERVICE (IAM mode)"
  gcloud run services add-iam-policy-binding "$SERVICE" \
    --region "$REGION" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/run.invoker" >/dev/null 2>&1 || true
fi

say "Deploying $SERVICE (GPU L4, ${MEMORY}, timeout ${TIMEOUT}s, min-instances ${MIN_INSTANCES})"
gcloud run deploy "$SERVICE" \
  --source "$SOURCE_DIR" \
  --region "$REGION" \
  --platform managed \
  "${ALLOW_FLAG[@]}" \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu "$CPU" \
  --memory "$MEMORY" \
  --no-cpu-throttling \
  --timeout "$TIMEOUT" \
  --concurrency "$CONCURRENCY" \
  --min-instances "$MIN_INSTANCES" \
  --max-instances "$MAX_INSTANCES" \
  --set-env-vars="MODEL=${LOCAL_VLM_MODEL},LOCAL_VLM_MODEL=${LOCAL_VLM_MODEL}" \
  --set-secrets="HF_TOKEN=HF_TOKEN:latest,LOCAL_VLM_API_KEY=LOCAL_VLM_API_KEY:latest"

VLM_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
say "ghost-vlm deployed: $VLM_URL"
echo
echo "Next: export LOCAL_VLM_API_KEY (same value) and run:"
echo "  GHOST_VLM_URL=$VLM_URL bash scripts/deploy-ghost-api.sh"
