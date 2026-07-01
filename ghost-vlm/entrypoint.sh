#!/usr/bin/env bash
# Ghost VLM — vLLM OpenAI-compatible server for Cloud Run GPU.
# Secrets (HF_TOKEN, LOCAL_VLM_API_KEY) must come from runtime env / Secret Manager only.
set -euo pipefail

MODEL_NAME="${MODEL_NAME:-Qwen/Qwen3-VL-8B-Instruct}"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "warning: HF_TOKEN is not set; gated models or Hugging Face rate limits may fail" >&2
fi

args=(
  serve
  "${MODEL_NAME}"
  --host "${HOST}"
  --port "${PORT}"
  --dtype auto
)

if [[ -n "${LOCAL_VLM_API_KEY:-}" ]]; then
  args+=(--api-key "${LOCAL_VLM_API_KEY}")
fi

if [[ -n "${VLLM_EXTRA_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  extra=( ${VLLM_EXTRA_ARGS} )
  args+=("${extra[@]}")
fi

echo "Starting vLLM OpenAI server: model=${MODEL_NAME} host=${HOST} port=${PORT} bearer_auth=$([[ -n "${LOCAL_VLM_API_KEY:-}" ]] && echo enabled || echo disabled)"
exec vllm "${args[@]}"
