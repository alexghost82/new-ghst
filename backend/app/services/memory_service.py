from __future__ import annotations

import logging
import sqlite3

from app.services.openai_client import extract_memory, get_embedding
from app.storage.memory_store import (
    create_memory_item,
    delete_memory_item,
    get_stale_memories,
    increment_access_count,
)
from app.storage.vector_store import VectorStore

logger = logging.getLogger("ghost.memory")


async def extract_and_save(
    conversation_id: str,
    user_message: str,
    assistant_message: str,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
) -> list[dict]:
    items = await extract_memory(user_message, assistant_message, api_key)
    if not items:
        return []

    saved = []
    for item in items:
        record = create_memory_item(
            db,
            conversation_id=conversation_id,
            item_type=item["type"],
            content=item["content"],
        )
        try:
            embedding = await get_embedding(item["content"], api_key)
            vector_store.add_memory(
                conversation_id=conversation_id,
                memory_id=record["id"],
                content=item["content"],
                embedding=embedding,
            )
        except Exception:
            logger.exception("Failed to embed memory %s", record["id"])
        saved.append(record)

    logger.info(
        "Extracted and saved %d memory items for conversation %s",
        len(saved),
        conversation_id,
    )
    return saved


async def retrieve_relevant(
    conversation_id: str,
    query: str,
    api_key: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
    top_k: int = 5,
) -> list[dict]:
    try:
        query_embedding = await get_embedding(query, api_key)
    except Exception:
        logger.exception("Failed to embed query for memory retrieval")
        return []

    results = vector_store.search_memory(
        conversation_id=conversation_id,
        query_embedding=query_embedding,
        top_k=top_k,
    )

    if results:
        hit_ids = [r["id"] for r in results]
        increment_access_count(db, hit_ids)

    return results


async def cleanup_stale(
    conversation_id: str,
    db: sqlite3.Connection,
    vector_store: VectorStore,
) -> int:
    stale = get_stale_memories(db, conversation_id)
    removed = 0
    for item in stale:
        delete_memory_item(db, item["id"])
        vector_store.delete_memory(conversation_id, item["id"])
        removed += 1

    if removed:
        logger.info(
            "Cleaned up %d stale memories from conversation %s",
            removed,
            conversation_id,
        )
    return removed
