from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: str
    nickname: str
    api_key_encrypted: str
    created_at: str
    # 'standard' for operator accounts, 'trial' for accounts auto-created by
    # the public trial gate (which also stamps the visitor's contact below).
    origin: str = "standard"
    lead_name: Optional[str] = None
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None


class Conversation(BaseModel):
    id: str
    user_id: str
    title: str = ""
    system_prompt: str = ""
    message_count: int = 0
    created_at: str
    updated_at: str
    title_source: str = "default"


class Message(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    token_estimate: int = 0
    created_at: str
    sequence_number: int


class MemoryItem(BaseModel):
    id: str
    conversation_id: str
    type: str
    content: str
    relevance_score: float = 1.0
    access_count: int = 0
    created_at: str
    updated_at: str


class KnowledgeSource(BaseModel):
    id: str
    user_id: str
    source_type: str
    filename: Optional[str] = None
    original_size: Optional[int] = None
    chunk_count: int = 0
    is_active: bool = True
    tags: str = "[]"
    created_at: str


class KnowledgeChunk(BaseModel):
    id: str
    source_id: str
    user_id: str
    content: str
    chunk_index: int
    created_at: str
