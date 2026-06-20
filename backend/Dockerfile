# Ghost backend (FastAPI) — Cloud Run container
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

# System libraries required by OpenCV (ultralytics/cv2) and pdfplumber.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app

# Data dir for SQLite + ChromaDB + uploads + YOLO weights.
# Overridable via env; mounted to a GCS volume in production.
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/ghost.db \
    CHROMA_PATH=/app/data/chroma \
    UPLOAD_PATH=/app/data/uploads \
    YOLO_MODELS_DIR=/app/data/models

EXPOSE 8080

# Cloud Run injects $PORT (defaults to 8080). Bind to it explicitly.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
