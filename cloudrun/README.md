# Ghost Cloud Run — local VLM stack

Deploy **ghost-vlm** (GPU vision inference) and **ghst-api** (Ghost backend, no GPU) as separate Cloud Run services. Firebase Hosting serves the frontend and proxies `/api/**` to **ghst-api** only — **ghost-vlm is never exposed through Hosting**.

## Architecture

```
Browser / Firebase Hosting
        │
        │  /api/**  →  ghst-api (Cloud Run, CPU, public via Hosting rewrite)
        │
        ▼
   ghst-api ──LOCAL_VLM_BASE_URL + LOCAL_VLM_API_KEY──► ghost-vlm (Cloud Run GPU L4)
                                                              OpenAI-compatible /v1/chat/completions
```

| Service | Cloud Run name | GPU | Public via Hosting |
| --- | --- | --- | --- |
| Ghost backend | `ghst-api` | No | Yes (`/api/**`, `/uploads/**`) |
| Local VLM (vLLM) | `ghost-vlm` | NVIDIA L4 × 1 | **No** — backend calls URL directly |

### Naming: `ghst-api` vs `ghost-api`

- **Cloud Run service ID** in production is **`ghst-api`** (historical; see `firebase.json` and `scripts/deploy-firebase.sh`).
- **Logical name** in docs and env files is **ghost-api** (the FastAPI app under `backend/`).
- Deploy scripts default `SERVICE=ghst-api` so Hosting rewrites keep working without changing `firebase.json`.

`firebase.json` rewrites (unchanged):

```json
{ "source": "/api/**", "run": { "serviceId": "ghst-api", "region": "us-central1" } }
```

Do **not** add a Hosting rewrite for `ghost-vlm`. Operators reach vision only through ghst-api (`GHOST_VISION_PROVIDER=auto` tries local VLM first, then OpenAI).

## Deploy order

1. **Secrets** — export `HF_TOKEN`, `LOCAL_VLM_API_KEY`, and ghst-api secrets (`OPENAI_API_KEY`, `GHOST_DEMO_API_KEY`, …).
2. **`ghost-vlm`** — `bash scripts/deploy-ghost-vlm.sh` (GPU service; slow first build).
3. **`ghst-api`** — `bash scripts/deploy-ghost-api.sh` (wires `LOCAL_VLM_*` from ghost-vlm URL).
4. **Hosting** (optional refresh) — `bash scripts/deploy-firebase.sh` or `firebase deploy --only hosting`.

Agent C owns `ghost-vlm/` (Dockerfile + vLLM entrypoint). Agent D owns only `cloudrun/` and `scripts/deploy-ghost-*.sh`.

## Quick start

```bash
# 1. VLM GPU service
export HF_TOKEN=hf_...
export LOCAL_VLM_API_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
# optional: export MIN_INSTANCES=1   # warmer GPU, higher cost
bash scripts/deploy-ghost-vlm.sh

# 2. Backend with local VLM enabled
export OPENAI_API_KEY=sk-...
export GHOST_DEMO_API_KEY=...
# LOCAL_VLM_API_KEY same as step 1
bash scripts/deploy-ghost-api.sh

# 3. Frontend + Hosting (if needed)
bash scripts/deploy-firebase.sh
```

Copy `cloudrun/ghost-vlm.env.example` and `cloudrun/ghost-api.env.example` for variable reference.

## ghost-vlm (GPU)

| Setting | Default | Notes |
| --- | --- | --- |
| GPU | `1 × nvidia-l4` | Requires Blaze billing; region `us-central1` (see [GPU regions](https://cloud.google.com/run/docs/configuring/services/gpu)) |
| Memory | `32Gi` | 24–32Gi typical for Qwen3-VL-8B; minimum platform rule is 16Gi |
| CPU | `8` | `--no-cpu-throttling` for inference |
| Timeout | `3600` s | Model load + long generations |
| Concurrency | `1` | One in-flight request per GPU instance |
| `MIN_INSTANCES` | `0` | `0` = scale to zero (cold start). `1` = always-warm GPU (~continuous cost) |

### gcloud (equivalent to deploy script)

```bash
gcloud run deploy ghost-vlm \
  --source ./ghost-vlm \
  --region us-central1 \
  --allow-unauthenticated \
  --gpu 1 --gpu-type nvidia-l4 \
  --cpu 8 --memory 32Gi --no-cpu-throttling \
  --timeout 3600 --concurrency 1 --min-instances 0 --max-instances 2 \
  --set-env-vars="MODEL=Qwen/Qwen3-VL-8B-Instruct,LOCAL_VLM_MODEL=Qwen/Qwen3-VL-8B-Instruct" \
  --set-secrets="HF_TOKEN=HF_TOKEN:latest,LOCAL_VLM_API_KEY=LOCAL_VLM_API_KEY:latest"
```

Secrets `HF_TOKEN` and `LOCAL_VLM_API_KEY` must exist in Secret Manager before deploy.

## ghost-api / ghst-api (no GPU)

Environment wired by `scripts/deploy-ghost-api.sh`:

| Variable | Example | Purpose |
| --- | --- | --- |
| `LOCAL_VLM_ENABLED` | `true` | Master switch |
| `LOCAL_VLM_BASE_URL` | `https://ghost-vlm-xxx.run.app` | **No `/v1` suffix** — backend adds `/v1/chat/completions` |
| `LOCAL_VLM_MODEL` | `Qwen/Qwen3-VL-8B-Instruct` | Must match model loaded on ghost-vlm |
| `GHOST_VISION_PROVIDER` | `auto` | Try local VLM, fall back to OpenAI |
| `LOCAL_VLM_API_KEY` | *(secret)* | Bearer sent to ghost-vlm |
| `LOCAL_VLM_TIMEOUT_SECONDS` | `180` | Increase if cold starts exceed 60s default |

### gcloud (equivalent excerpt)

```bash
VLM_URL="$(gcloud run services describe ghost-vlm --region us-central1 --format='value(status.url)')"

gcloud run deploy ghst-api \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi --cpu 2 --timeout 300 --min-instances 1 \
  --set-env-vars="LOCAL_VLM_ENABLED=true,LOCAL_VLM_BASE_URL=${VLM_URL},LOCAL_VLM_MODEL=Qwen/Qwen3-VL-8B-Instruct,GHOST_VISION_PROVIDER=auto,LOCAL_VLM_TIMEOUT_SECONDS=180" \
  --set-secrets="...,LOCAL_VLM_API_KEY=LOCAL_VLM_API_KEY:latest"
```

## Security (MVP)

**Application bearer (default):**

- `LOCAL_VLM_API_KEY` is generated once and stored in Secret Manager.
- Injected into **both** services; ghost-vlm rejects requests without `Authorization: Bearer <key>`.
- ghst-api sends that bearer on every local VLM call.
- ghost-vlm Cloud Run URL is not linked from the public site; only ghst-api knows it.

**IAM hardening (optional, documented for later):**

```bash
# Deploy ghost-vlm without public invoke:
export GHOST_VLM_NO_PUBLIC_INGRESS=1
bash scripts/deploy-ghost-vlm.sh

# Grant only ghst-api's runtime SA permission to invoke:
gcloud run services add-iam-policy-binding ghost-vlm \
  --region us-central1 \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker"
```

For IAM-only ingress, ghst-api must also send a **Google identity token** on requests to ghost-vlm (in addition to or instead of the shared bearer). That requires a small backend change; until then use MVP bearer + obscure URL.

**Never** add `ghost-vlm` to `firebase.json` rewrites.

## Verification

```bash
# ghst-api health (via Hosting)
curl -s "https://ghst-ebb50.web.app/api/health"

# Local VLM diagnostic (authenticated Ghost API key required)
curl -s -X POST "https://ghst-ebb50.web.app/api/vision/local-analyze" \
  -H "Authorization: Bearer <operator-api-key>" \
  -F "image=@frame.jpg"
```

Direct ghost-vlm probe (should 401 without bearer):

```bash
VLM_URL="$(gcloud run services describe ghost-vlm --region us-central1 --format='value(status.url)')"
curl -s -o /dev/null -w '%{http_code}\n' "${VLM_URL}/v1/models"
curl -s -H "Authorization: Bearer $LOCAL_VLM_API_KEY" "${VLM_URL}/v1/models"
```

## Related docs

- [docs/local-vlm.md](../docs/local-vlm.md) — provider modes, env reference, fallback behavior
- [scripts/deploy-firebase.sh](../scripts/deploy-firebase.sh) — full stack including Hosting
- [scripts/deploy-ghost-vlm.sh](../scripts/deploy-ghost-vlm.sh) — GPU VLM only
- [scripts/deploy-ghost-api.sh](../scripts/deploy-ghost-api.sh) — ghst-api + `LOCAL_VLM_*` wiring
