# ghost-vlm

GPU-backed **local VLM** service for the Ghost project. Runs [vLLM](https://docs.vllm.ai/) with the official `vllm/vllm-openai` image and exposes an **OpenAI-compatible HTTP API** so the Ghost backend can route vision workloads here instead of the OpenAI API.

Ghost backend configuration lives in `docs/local-vlm.md` and `backend/.env.example` (Agent D owns Cloud Run deploy wiring in `cloudrun/`).

## Architecture

```
Ghost backend (:8000)  --POST /v1/chat/completions-->  ghost-vlm (:PORT)
         LOCAL_VLM_BASE_URL                              vLLM + Qwen3-VL
         LOCAL_VLM_API_KEY (optional bearer)
```

- **Default model:** `Qwen/Qwen3-VL-8B-Instruct` (fits a single Cloud Run L4 / 24 GB GPU class).
- **Heavy variant:** `Qwen/Qwen3-VL-32B-Instruct` — needs substantially more VRAM (often 2× GPU or A100-class). Set `MODEL_NAME` and tune `VLLM_EXTRA_ARGS` (for example `--tensor-parallel-size 2`, lower `--max-model-len`). Expect longer cold starts and higher cost; validate alert quality before production.
- **No weights in repo:** the container downloads the model from Hugging Face on first start. Use `HF_TOKEN` for gated models and higher rate limits.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/v1/models` | List loaded models (OpenAI-compatible). **Recommended Cloud Run startup/liveness probe.** |
| `POST` | `/v1/chat/completions` | Multimodal chat (images via `image_url` content parts). Primary inference path used by Ghost. |
| `GET` | `/health` | **Not provided by stock vLLM.** Do not point Cloud Run health checks at `/health` unless you add a reverse proxy. Use `GET /v1/models` instead (returns 200 when the server is up). |

Example chat request:

```bash
curl -s "https://ghost-vlm-XXXX.run.app/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${LOCAL_VLM_API_KEY}" \
  -d '{
    "model": "Qwen/Qwen3-VL-8B-Instruct",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}},
        {"type": "text", "text": "Describe the scene."}
      ]
    }]
  }'
```

Omit the `Authorization` header when `LOCAL_VLM_API_KEY` is unset (local dev only; not recommended on the public internet).

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Listen port. Cloud Run sets this automatically; the entrypoint always binds vLLM to it. |
| `HOST` | `0.0.0.0` | Bind address inside the container. |
| `MODEL_NAME` | `Qwen/Qwen3-VL-8B-Instruct` | Hugging Face model id passed to `vllm serve`. |
| `HF_TOKEN` | *(unset)* | Hugging Face token for model download. **Inject via Secret Manager / env only — never commit or bake into the image.** |
| `LOCAL_VLM_API_KEY` | *(unset)* | When set, passed to vLLM as `--api-key` (bearer auth MVP). Ghost backend sends the same value in `Authorization: Bearer …`. |
| `VLLM_EXTRA_ARGS` | *(unset)* | Optional extra CLI flags (space-separated), e.g. `--max-model-len 8192`. |

## Build and run locally (GPU host)

```bash
cd ghost-vlm

docker build -t ghost-vlm:local .

docker run --rm --gpus all --ipc=host \
  -p 8080:8080 \
  -e HF_TOKEN="${HF_TOKEN}" \
  -e LOCAL_VLM_API_KEY="${LOCAL_VLM_API_KEY:-}" \
  -e MODEL_NAME="Qwen/Qwen3-VL-8B-Instruct" \
  -v "${HOME}/.cache/huggingface:/root/.cache/huggingface" \
  ghost-vlm:local
```

Smoke test:

```bash
curl -s http://127.0.0.1:8080/v1/models
```

## Cloud Run notes

- Deploy on a **GPU** instance type (L4 minimum for 8B; plan larger for 32B).
- Mount `HF_TOKEN` and optionally `LOCAL_VLM_API_KEY` from **Secret Manager**.
- Set **startup probe** to `GET /v1/models` (model load can take several minutes on cold start).
- Consider **min instances ≥ 1** if Ghost `LOCAL_VLM_TIMEOUT_SECONDS` is tight.
- Restrict ingress (IAM, VPC, or internal load balancer); pair with Ghost `LOCAL_VLM_API_KEY` when exposed beyond a private network.

Ghost backend (separate service):

```env
LOCAL_VLM_ENABLED=true
LOCAL_VLM_BASE_URL=https://ghost-vlm-XXXX.run.app
LOCAL_VLM_MODEL=Qwen/Qwen3-VL-8B-Instruct
LOCAL_VLM_API_KEY=<same-as-container>
GHOST_VISION_PROVIDER=auto
```

## Files

| File | Role |
| --- | --- |
| `Dockerfile` | Extends `vllm/vllm-openai:latest`; no extra Python deps. |
| `entrypoint.sh` | Starts `vllm serve` with `MODEL_NAME`, `PORT`, optional `--api-key`. |
| `.dockerignore` | Excludes weights, caches, secrets, and large binaries from build context. |

No `requirements.txt` — dependencies come from the official vLLM image.
