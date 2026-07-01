# Ghost VLM — GPU Cloud Run service (OpenAI-compatible vLLM server).
# Model weights are downloaded at runtime from Hugging Face; never baked into the image.
FROM vllm/vllm-openai:latest

ENV PORT=8080
ENV HOST=0.0.0.0
ENV MODEL_NAME=Qwen/Qwen3-VL-8B-Instruct

# HF_TOKEN and LOCAL_VLM_API_KEY are injected at deploy time (Secret Manager / Cloud Run env).
# Do not set or hardcode secrets in this Dockerfile.

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
