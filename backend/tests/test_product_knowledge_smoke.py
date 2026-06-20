"""Smoke tests for Ghost product self-knowledge.

Verifies that the generated capabilities snapshot
(``backend/app/data/ghost_capabilities.json``, produced from the frontend
``capabilities.ts`` by ``scripts/gen-ghost-knowledge.mjs``) is present and
well-formed, and that the rendered system block + few-shot expose all nine
capabilities in both interface languages.

Runs with plain ``python tests/test_product_knowledge_smoke.py`` (no pytest
dependency), matching the other smoke tests in this folder.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

TEST_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(TEST_ROOT.parent))

from app.services.product_knowledge import (  # noqa: E402
    build_capabilities_block,
    build_self_knowledge,
    capability_few_shot,
    looks_like_capability_query,
)

DATA_PATH = TEST_ROOT.parent / "app" / "data" / "ghost_capabilities.json"

# The 9 ids must match frontend/src/data/capabilities.ts exactly.
EXPECTED_IDS = [
    "chat",
    "cameras",
    "organize",
    "systemPrompt",
    "memory",
    "siteScan",
    "history",
    "broadcast",
    "alerts",
]


def test_json_snapshot_present_and_complete() -> None:
    assert DATA_PATH.exists(), (
        f"{DATA_PATH} missing. Run `npm run gen:knowledge` in frontend/ "
        "(it is also part of `npm run build`)."
    )
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    caps = data.get("capabilities")
    assert isinstance(caps, list), "capabilities must be a list"
    assert [c["id"] for c in caps] == EXPECTED_IDS, "capability ids drifted from capabilities.ts"
    for cap in caps:
        for loc in ("he", "en"):
            copy = cap["copy"][loc]
            assert copy["title"].strip(), f"{cap['id']} missing {loc} title"
            assert copy["simple"].strip(), f"{cap['id']} missing {loc} simple"
    print("OK: snapshot has 9 complete capabilities")


def test_self_knowledge_contains_all_titles() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    for loc in ("he", "en"):
        block = build_self_knowledge(loc)
        for cap in data["capabilities"]:
            title = cap["copy"][loc]["title"]
            assert title in block, f"{loc}: title '{title}' missing from self-knowledge block"
        # Numbered list 1..9 present.
        for i in range(1, 10):
            assert f"{i}." in block, f"{loc}: numbered item {i} missing"
    print("OK: self-knowledge block lists all 9 titles in both languages")


def test_capabilities_block_no_invented_extras() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    for loc in ("he", "en"):
        block = build_capabilities_block(loc)
        # Exactly 9 numbered bullets.
        numbered = [ln for ln in block.splitlines() if ln[:2] in {f"{i}." for i in range(1, 10)}]
        assert len(numbered) == len(data["capabilities"]) == 9, f"{loc}: expected 9 bullets"
    print("OK: capabilities block renders exactly 9 bullets")


def test_capability_query_detection() -> None:
    assert looks_like_capability_query("מה אתה יודע לעשות?")
    assert looks_like_capability_query("מי אתה?")
    assert looks_like_capability_query("what can you do?")
    assert looks_like_capability_query("who are you")
    assert not looks_like_capability_query("כמה אנשים בפריים?")
    assert not looks_like_capability_query("describe the white car")
    print("OK: capability-query detection behaves")


def test_few_shot_answers_from_titles() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    for loc in ("he", "en"):
        _user, assistant = capability_few_shot(loc)
        for cap in data["capabilities"]:
            title = cap["copy"][loc]["title"]
            assert title in assistant, f"{loc}: few-shot missing '{title}'"
    print("OK: few-shot answer is built from the 9 titles")


if __name__ == "__main__":
    test_json_snapshot_present_and_complete()
    test_self_knowledge_contains_all_titles()
    test_capabilities_block_no_invented_extras()
    test_capability_query_detection()
    test_few_shot_answers_from_titles()
    print("\nAll product-knowledge smoke tests passed.")
