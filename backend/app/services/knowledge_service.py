from __future__ import annotations

import logging
import sqlite3

from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from app.schemas.responses import error_response
from app.services.file_parser import chunk_text, parse_file
from app.services.openai_client import get_embeddings
from app.storage.knowledge_store import (
    create_knowledge_chunk,
    create_knowledge_source,
    delete_knowledge_source,
    get_chunk_ids_for_source,
    update_chunk_count,
)
from app.storage.vector_store import VectorStore

logger = logging.getLogger("ghost.knowledge")

# Upload hardening: cap size and restrict to the parseable types we support,
# so a malicious / accidental large or binary upload can't exhaust memory or
# burn embedding cost on garbage.
MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_KNOWLEDGE_EXTENSIONS = {"pdf", "docx", "txt", "md", "json"}


def _validate_upload(filename: str, file_bytes: bytes) -> None:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_KNOWLEDGE_EXTENSIONS:
        error_response(
            "UNSUPPORTED_FILE_TYPE",
            f"Unsupported file type '.{ext}'. Allowed: "
            + ", ".join(sorted(ALLOWED_KNOWLEDGE_EXTENSIONS)),
            400,
        )
    if len(file_bytes) == 0:
        error_response("EMPTY_FILE", "Uploaded file is empty", 400)
    if len(file_bytes) > MAX_KNOWLEDGE_FILE_BYTES:
        error_response(
            "FILE_TOO_LARGE",
            f"File exceeds the {MAX_KNOWLEDGE_FILE_BYTES // (1024 * 1024)}MB limit",
            413,
        )


async def ingest_file(
    user_id: str,
    file: UploadFile,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
    tags: list[str] | None = None,
) -> dict:
    file_bytes = await file.read()
    filename = file.filename or "unknown"
    _validate_upload(filename, file_bytes)
    # PDF/DOCX parsing is CPU-bound and synchronous; run it off the event loop
    # so a large document upload doesn't stall every other in-flight request.
    text = await run_in_threadpool(parse_file, file_bytes, filename)

    source = create_knowledge_source(
        db,
        user_id=user_id,
        source_type="file",
        filename=filename,
        original_size=len(file_bytes),
        tags=tags,
    )

    chunks = chunk_text(text)
    if not chunks:
        return source

    embeddings = await get_embeddings(chunks, api_key)

    for i, (chunk_text_content, embedding) in enumerate(zip(chunks, embeddings)):
        chunk = create_knowledge_chunk(
            db,
            source_id=source["id"],
            user_id=user_id,
            content=chunk_text_content,
            chunk_index=i,
        )
        vector_store.add_knowledge(
            user_id=user_id,
            chunk_id=chunk["id"],
            content=chunk_text_content,
            embedding=embedding,
            metadata={"source_id": source["id"], "chunk_index": i},
        )

    update_chunk_count(db, source["id"], len(chunks))
    source["chunk_count"] = len(chunks)
    logger.info(
        "Ingested file '%s' → %d chunks for user %s",
        filename,
        len(chunks),
        user_id,
    )
    return source


async def ingest_text(
    user_id: str,
    text: str,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
    tags: list[str] | None = None,
) -> dict:
    source = create_knowledge_source(
        db,
        user_id=user_id,
        source_type="text",
        original_size=len(text.encode("utf-8")),
        tags=tags,
    )

    chunks = chunk_text(text)
    if not chunks:
        return source

    embeddings = await get_embeddings(chunks, api_key)

    for i, (chunk_text_content, embedding) in enumerate(zip(chunks, embeddings)):
        chunk = create_knowledge_chunk(
            db,
            source_id=source["id"],
            user_id=user_id,
            content=chunk_text_content,
            chunk_index=i,
        )
        vector_store.add_knowledge(
            user_id=user_id,
            chunk_id=chunk["id"],
            content=chunk_text_content,
            embedding=embedding,
            metadata={"source_id": source["id"], "chunk_index": i},
        )

    update_chunk_count(db, source["id"], len(chunks))
    source["chunk_count"] = len(chunks)
    logger.info(
        "Ingested text → %d chunks for user %s",
        len(chunks),
        user_id,
    )
    return source


async def re_ingest_text(
    source_id: str,
    user_id: str,
    text: str,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
) -> dict:
    """Replace chunks and embeddings for a text source with new content."""
    chunk_ids = get_chunk_ids_for_source(db, source_id)
    if chunk_ids:
        vector_store.delete_knowledge_source(user_id, chunk_ids)

    db.execute("DELETE FROM knowledge_chunks WHERE source_id = ?", (source_id,))
    db.commit()

    chunks = chunk_text(text)
    if not chunks:
        update_chunk_count(db, source_id, 0)
        from app.storage.knowledge_store import get_knowledge_source
        return get_knowledge_source(db, source_id) or {}

    embeddings = await get_embeddings(chunks, api_key)

    for i, (chunk_text_content, embedding) in enumerate(zip(chunks, embeddings)):
        chunk = create_knowledge_chunk(
            db,
            source_id=source_id,
            user_id=user_id,
            content=chunk_text_content,
            chunk_index=i,
        )
        vector_store.add_knowledge(
            user_id=user_id,
            chunk_id=chunk["id"],
            content=chunk_text_content,
            embedding=embedding,
            metadata={"source_id": source_id, "chunk_index": i},
        )

    update_chunk_count(db, source_id, len(chunks))
    logger.info(
        "Re-ingested text source %s → %d chunks for user %s",
        source_id,
        len(chunks),
        user_id,
    )
    from app.storage.knowledge_store import get_knowledge_source
    source = get_knowledge_source(db, source_id) or {}
    source["chunk_count"] = len(chunks)
    return source


async def retrieve_relevant(
    user_id: str,
    query: str,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
    top_k: int = 5,
) -> list[dict]:
    try:
        from app.services.openai_client import get_embedding

        query_embedding = await get_embedding(query, api_key)
    except Exception:
        logger.exception("Failed to embed query for knowledge retrieval")
        return []

    return vector_store.search_knowledge(
        user_id=user_id,
        query_embedding=query_embedding,
        top_k=top_k,
    )


async def retrieve_self_knowledge(
    query: str,
    api_key: str,
    vector_store: VectorStore,
    top_k: int = 6,
) -> list[dict]:
    """Search Ghost's global, bounded professional self-knowledge collection.

    This is the authoritative source set for "what can Ghost do / how do I use
    it" answers. Returns [] when the collection is empty (not yet seeded) so
    the chat path degrades gracefully to the always-injected 9-capability
    block."""
    try:
        from app.services.openai_client import get_embedding

        query_embedding = await get_embedding(query, api_key)
    except Exception:
        logger.exception("Failed to embed query for self-knowledge retrieval")
        return []

    return vector_store.search_self_knowledge(
        query_embedding=query_embedding,
        top_k=top_k,
    )


def delete_source(
    user_id: str,
    source_id: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
) -> bool:
    chunk_ids = get_chunk_ids_for_source(db, source_id)
    if chunk_ids:
        vector_store.delete_knowledge_source(user_id, chunk_ids)
    return delete_knowledge_source(db, source_id)
