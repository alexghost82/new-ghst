from __future__ import annotations

import logging

import chromadb

logger = logging.getLogger("ghost.vector")


class VectorStore:
    def __init__(self, persist_dir: str):
        self._client = chromadb.PersistentClient(path=persist_dir)
        logger.info("ChromaDB initialised at %s", persist_dir)

    def _memory_collection_name(self, conversation_id: str) -> str:
        return f"memory_{conversation_id}"

    def _knowledge_collection_name(self, user_id: str) -> str:
        return f"knowledge_{user_id}"

    # Global, single-tenant collection holding Ghost's own bounded professional
    # self-knowledge (the operator-training / shared-language / architecture
    # source documents). Unlike ``knowledge_{user_id}`` this is NOT per-user —
    # it is the authoritative set every operator's "what can Ghost do / how do
    # I use it" answer is allowed to draw from. Seeded by
    # ``scripts/seed_self_knowledge.py``.
    _SELF_KNOWLEDGE_COLLECTION = "ghost_self_knowledge"

    # ── Memory ──────────────────────────────────────────────────

    def add_memory(
        self,
        conversation_id: str,
        memory_id: str,
        content: str,
        embedding: list[float],
    ) -> None:
        col = self._client.get_or_create_collection(
            name=self._memory_collection_name(conversation_id)
        )
        col.add(
            ids=[memory_id],
            embeddings=[embedding],
            documents=[content],
        )
        logger.debug("Added memory %s to collection %s", memory_id, col.name)

    def search_memory(
        self,
        conversation_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        name = self._memory_collection_name(conversation_id)
        try:
            col = self._client.get_collection(name=name)
        except Exception:
            return []

        if col.count() == 0:
            return []

        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
        )

        items = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                items.append(
                    {
                        "id": doc_id,
                        "content": results["documents"][0][i] if results["documents"] else "",
                        "distance": results["distances"][0][i] if results["distances"] else 0,
                    }
                )
        return items

    def delete_memory(self, conversation_id: str, memory_id: str) -> None:
        name = self._memory_collection_name(conversation_id)
        try:
            col = self._client.get_collection(name=name)
            col.delete(ids=[memory_id])
        except Exception:
            logger.warning("Could not delete memory %s from %s", memory_id, name)

    def delete_conversation_memory(self, conversation_id: str) -> None:
        name = self._memory_collection_name(conversation_id)
        try:
            self._client.delete_collection(name=name)
            logger.info("Deleted memory collection %s", name)
        except Exception:
            logger.debug("Collection %s does not exist, skipping delete", name)

    # ── Knowledge ───────────────────────────────────────────────

    def add_knowledge(
        self,
        user_id: str,
        chunk_id: str,
        content: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        col = self._client.get_or_create_collection(
            name=self._knowledge_collection_name(user_id)
        )
        col.add(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}],
        )

    def search_knowledge(
        self,
        user_id: str,
        query_embedding: list[float],
        top_k: int = 5,
    ) -> list[dict]:
        name = self._knowledge_collection_name(user_id)
        try:
            col = self._client.get_collection(name=name)
        except Exception:
            return []

        if col.count() == 0:
            return []

        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
        )

        items = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                items.append(
                    {
                        "id": doc_id,
                        "content": results["documents"][0][i] if results["documents"] else "",
                        "distance": results["distances"][0][i] if results["distances"] else 0,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    }
                )
        return items

    def delete_knowledge_source(self, user_id: str, chunk_ids: list[str]) -> None:
        if not chunk_ids:
            return
        name = self._knowledge_collection_name(user_id)
        try:
            col = self._client.get_collection(name=name)
            col.delete(ids=chunk_ids)
            logger.info("Deleted %d knowledge chunks from %s", len(chunk_ids), name)
        except Exception:
            logger.warning("Could not delete knowledge chunks from %s", name)

    # ── Ghost self-knowledge (global, bounded source set) ───────────

    def add_self_knowledge(
        self,
        chunk_id: str,
        content: str,
        embedding: list[float],
        metadata: dict | None = None,
    ) -> None:
        col = self._client.get_or_create_collection(
            name=self._SELF_KNOWLEDGE_COLLECTION
        )
        col.add(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}],
        )

    def search_self_knowledge(
        self,
        query_embedding: list[float],
        top_k: int = 6,
    ) -> list[dict]:
        try:
            col = self._client.get_collection(name=self._SELF_KNOWLEDGE_COLLECTION)
        except Exception:
            return []

        if col.count() == 0:
            return []

        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
        )

        items: list[dict] = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                items.append(
                    {
                        "id": doc_id,
                        "content": results["documents"][0][i] if results["documents"] else "",
                        "distance": results["distances"][0][i] if results["distances"] else 0,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    }
                )
        return items

    def count_self_knowledge(self) -> int:
        try:
            col = self._client.get_collection(name=self._SELF_KNOWLEDGE_COLLECTION)
            return col.count()
        except Exception:
            return 0

    def reset_self_knowledge(self) -> None:
        """Drop the global self-knowledge collection so a re-seed starts clean."""
        try:
            self._client.delete_collection(name=self._SELF_KNOWLEDGE_COLLECTION)
            logger.info("Reset self-knowledge collection")
        except Exception:
            logger.debug("Self-knowledge collection absent, skipping reset")
