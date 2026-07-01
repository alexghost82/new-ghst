# Ghost Internal Interface

Local-first AI chat platform for Ghost employees with advanced memory engine, knowledge base, and OpenAI integration.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Zustand
- **Backend**: Python 3.9+, FastAPI, Pydantic v2, Uvicorn
- **Database**: SQLite (core data) + ChromaDB (vector embeddings)
- **AI**: OpenAI API (chat: gpt-4o, embeddings: text-embedding-3-small). Optional [local VLM](./docs/local-vlm.md) for on-prem or GPU-hosted vision.

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env — set your OPENAI_API_KEY

# Start server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:8888 in your browser (the Vite dev server proxies `/api`
to the backend on port 8000). There are two entry points: `/` (marketing site)
and `/app.html` (operational console).

### Required environment (backend `.env`)

| Var | Purpose |
| --- | --- |
| `GHOST_MASTER_KEY` | **Required.** Fernet key encrypting operator API keys. The server refuses to boot with the placeholder/invalid value. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. |
| `GHOST_DEMO_API_KEY` | Shared demo/trial OpenAI key — server-side only, never shipped to the browser. Required for the public trial / demo flows. |
| `GHOST_ADMIN_TOKEN` | Guards internal PII endpoints (download leads, applications, trial roster, magic-link minting). Sent by the client via `X-Ghost-Admin-Token`. Empty ⇒ those endpoints are closed. |
| `GHOST_GM_CODE` | Operator-provisioning authorization code (server-verified). Empty disables provisioning. |
| `SENTRY_DSN` | Optional — enables error reporting when set. |

See `backend/.env.example` for the full list.

### Quality gates

CI (`.github/workflows/ci.yml`) runs on every PR: secret scan, frontend
type-check + build + unit tests, backend ruff lint + smoke tests. Run locally:

```bash
# frontend
cd frontend && npm run build && npm test
# backend
cd backend && ruff check . && python tests/test_migrations_smoke.py
# repo-wide secret scan
bash scripts/check-secrets.sh
```

## Features

- Multi-user support with encrypted API key storage
- Conversation management with per-chat system prompts
- Streaming chat responses via SSE
- Conversation memory engine (automatic fact/preference extraction)
- Knowledge base (PDF, DOCX, TXT, JSON upload with semantic search)
- Memory + Knowledge context injection into every prompt
- Optional local VLM provider (vLLM, Ollama, or Cloud Run GPU) — off by default; see [docs/local-vlm.md](./docs/local-vlm.md)
