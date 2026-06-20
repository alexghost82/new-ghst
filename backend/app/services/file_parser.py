from __future__ import annotations

import io
import json
import logging

import pdfplumber
import tiktoken
from docx import Document

logger = logging.getLogger("ghost.parser")

_enc = tiktoken.get_encoding("cl100k_base")


def parse_pdf(file_bytes: bytes) -> str:
    pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages)


def parse_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def parse_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace")


def parse_json(file_bytes: bytes) -> str:
    data = json.loads(file_bytes.decode("utf-8", errors="replace"))
    return json.dumps(data, indent=2, ensure_ascii=False)


def parse_file(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    parsers = {
        "pdf": parse_pdf,
        "docx": parse_docx,
        "txt": parse_txt,
        "md": parse_txt,
        "json": parse_json,
    }
    parser = parsers.get(ext)
    if not parser:
        logger.warning("Unsupported file type: %s, treating as plain text", ext)
        return parse_txt(file_bytes)
    return parser(file_bytes)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    tokens = _enc.encode(text)
    if len(tokens) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(_enc.decode(chunk_tokens))
        if end >= len(tokens):
            break
        start = end - overlap

    return chunks
