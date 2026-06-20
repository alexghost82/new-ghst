#!/usr/bin/env python3
"""Seed Ghost's bounded professional self-knowledge into the global
``ghost_self_knowledge`` ChromaDB collection.

Ghost's answers about *itself* — what it can do, how to use it, how something
works in Ghost — are bounded to a fixed set of official source documents
(operator training program + visual appendix, shared-language partners deck,
enterprise architecture). This script parses those PDFs, embeds them, and
loads them into the global collection that the chat path retrieves from.

Run from the ``backend/`` directory:

    python scripts/seed_self_knowledge.py

The source PDFs are read from the repository root by default (override with
``--docs-dir``). Embeddings require an OpenAI key, taken from
``GHOST_DEMO_API_KEY`` / ``OPENAI_API_KEY`` or ``--api-key``. The collection is
reset first so re-running is idempotent (no duplicate chunks).
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Allow ``python scripts/seed_self_knowledge.py`` from the backend dir.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.services.file_parser import chunk_text, parse_file  # noqa: E402
from app.services.openai_client import get_embeddings  # noqa: E402
from app.services.product_knowledge import SELF_KNOWLEDGE_DOCS  # noqa: E402
from app.storage.vector_store import VectorStore  # noqa: E402

# Default location of the source PDFs: the repository root (backend/..).
_DEFAULT_DOCS_DIR = Path(__file__).resolve().parent.parent.parent


def _resolve_api_key(cli_value: str | None) -> str:
    return (
        (cli_value or "").strip()
        or (settings.demo_api_key or "").strip()
        or (settings.openai_api_key or "").strip()
        or os.environ.get("OPENAI_API_KEY", "").strip()
    )


async def _seed(docs_dir: Path, api_key: str) -> int:
    vector_store = VectorStore(settings.chroma_path)
    vector_store.reset_self_knowledge()

    total_chunks = 0
    for doc in SELF_KNOWLEDGE_DOCS:
        path = docs_dir / doc["filename"]
        if not path.exists():
            print(f"  ! missing source: {path}", file=sys.stderr)
            continue

        text = parse_file(path.read_bytes(), doc["filename"])
        chunks = chunk_text(text)
        if not chunks:
            print(f"  ! no extractable text: {doc['filename']}", file=sys.stderr)
            continue

        embeddings = await get_embeddings(chunks, api_key)
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            vector_store.add_self_knowledge(
                chunk_id=f"{doc['id']}::{i}",
                content=chunk,
                embedding=embedding,
                metadata={
                    "doc_id": doc["id"],
                    "title": doc["title"]["en"],
                    "download_path": doc["download_path"],
                    "chunk_index": i,
                },
            )
        total_chunks += len(chunks)
        print(f"  + {doc['id']}: {len(chunks)} chunks")

    print(
        f"Done. {total_chunks} chunks across {len(SELF_KNOWLEDGE_DOCS)} docs; "
        f"collection now holds {vector_store.count_self_knowledge()}."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Ghost self-knowledge into ChromaDB")
    parser.add_argument(
        "--docs-dir",
        default=str(_DEFAULT_DOCS_DIR),
        help="Directory holding the source PDFs (default: repo root)",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="OpenAI key for embeddings (defaults to GHOST_DEMO_API_KEY / OPENAI_API_KEY)",
    )
    args = parser.parse_args()

    api_key = _resolve_api_key(args.api_key)
    if not api_key:
        print(
            "No API key. Set GHOST_DEMO_API_KEY / OPENAI_API_KEY or pass --api-key.",
            file=sys.stderr,
        )
        return 2

    docs_dir = Path(args.docs_dir).expanduser().resolve()
    print(f"Seeding self-knowledge from {docs_dir} -> {settings.chroma_path}")
    return asyncio.run(_seed(docs_dir, api_key))


if __name__ == "__main__":
    raise SystemExit(main())
