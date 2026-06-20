CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('fact', 'preference', 'instruction', 'entity')),
    content TEXT NOT NULL,
    relevance_score REAL NOT NULL DEFAULT 1.0,
    access_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_conversation ON memory_items(conversation_id);
