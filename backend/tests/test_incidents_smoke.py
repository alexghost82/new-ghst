"""Smoke tests for the incident pipeline.

Runs against a throwaway SQLite database written under
``backend/data/incidents_smoke.db``. Designed to run with plain
``python tests/test_incidents_smoke.py`` (no pytest dependency).

The AI-driven paths (severity scoring, summary generation) are
exercised in their *fallback* mode — ``api_key=None`` short-circuits
the OpenAI call so the test stays offline. The real call paths are
covered by manual smoke testing with a configured API key.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
import time
from pathlib import Path

# Point the SQLite DB at an isolated file before importing project modules,
# so the migration + connection logic targets our temp file rather than
# the developer's local database.
TEST_ROOT = Path(__file__).resolve().parent
SCRATCH = TEST_ROOT.parent / "data" / "_smoke"
if SCRATCH.exists():
    shutil.rmtree(SCRATCH)
SCRATCH.mkdir(parents=True, exist_ok=True)

os.environ["DATABASE_PATH"] = str(SCRATCH / "ghost.db")
os.environ["CHROMA_PATH"] = str(SCRATCH / "chroma")
os.environ["UPLOAD_PATH"] = str(SCRATCH / "uploads")

sys.path.insert(0, str(TEST_ROOT.parent))

# Now the project imports are safe:
from app.config import settings  # noqa: E402
from app.storage.database import get_db, run_migrations  # noqa: E402
from app.storage.user_store import create_user  # noqa: E402
from app.storage.incident_store import (  # noqa: E402
    add_evidence,
    add_note,
    append_activity,
    create_incident,
    find_merge_candidate,
    get_incident,
    get_kpi_stats,
    list_activity,
    list_incidents,
    update_incident_assignment,
    update_incident_status,
)
from app.services import incident_service  # noqa: E402

# Override settings paths because Settings() already cached them at import.
settings.database_path = os.environ["DATABASE_PATH"]
settings.chroma_path = os.environ["CHROMA_PATH"]
settings.upload_path = os.environ["UPLOAD_PATH"]
settings.ensure_directories()


PASSED = 0
FAILED = 0


def expect(name: str, cond: bool, detail: str = "") -> None:
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  PASS  {name}")
    else:
        FAILED += 1
        print(f"  FAIL  {name}{(': ' + detail) if detail else ''}")


def setup_user() -> str:
    db = get_db()
    try:
        try:
            user = create_user(db, "smoke-tester", "sk-test-1234")
        except ValueError:
            row = db.execute(
                "SELECT id FROM users WHERE nickname = ?", ("smoke-tester",)
            ).fetchone()
            return row["id"]
        return user["id"]
    finally:
        db.close()


def setup_second_user() -> str:
    db = get_db()
    try:
        try:
            user = create_user(db, "smoke-investigator", "sk-test-5678")
            return user["id"]
        except ValueError:
            row = db.execute(
                "SELECT id FROM users WHERE nickname = ?",
                ("smoke-investigator",),
            ).fetchone()
            return row["id"]
    finally:
        db.close()


def test_migrations_apply() -> None:
    print("\n[migrations]")
    run_migrations()
    db = get_db()
    try:
        tables = {
            row["name"]
            for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
    finally:
        db.close()
    expect("incident_events table", "incident_events" in tables)
    expect("incident_activity table", "incident_activity" in tables)
    expect("incident_notes table", "incident_notes" in tables)
    expect("incident_evidence table", "incident_evidence" in tables)


def test_create_and_status_transitions(user_id: str) -> None:
    print("\n[status transitions]")
    db = get_db()
    try:
        incident = create_incident(
            db,
            user_id=user_id,
            title="Person at fence",
            source_camera_label="Fence-East-12",
            severity="high",
            ai_reasoning="Person observed near restricted perimeter.",
            tags=["intrusion", "perimeter"],
        )
        expect("incident created", incident["status"] == "new")
        expect("severity persisted", incident["severity"] == "high")
        expect("tags persisted", incident["tags"] == ["intrusion", "perimeter"])

        append_activity(
            db,
            incident_id=incident["id"],
            activity_type="created",
            actor="system",
            content="opened",
        )

        moved = update_incident_status(
            db,
            incident["id"],
            new_status="handling",
            actor=user_id,
        )
        expect("status moved to handling", moved and moved["status"] == "handling")
        expect("handling_started_at set", bool(moved and moved["handling_started_at"]))

        activity = list_activity(db, incident["id"])
        types = [a["type"] for a in activity]
        expect("status_changed activity row", "status_changed" in types)

        # Invalid status -> ValueError
        bad = False
        try:
            update_incident_status(
                db, incident["id"], new_status="garbage", actor=user_id
            )
        except ValueError:
            bad = True
        expect("rejects invalid status", bad)
    finally:
        db.close()


def test_assignment_fk(user_id: str, other_user_id: str) -> None:
    print("\n[assignment]")
    db = get_db()
    try:
        incident = create_incident(
            db,
            user_id=user_id,
            title="Vehicle loitering",
            source_camera_label="Gate-South",
        )
        updated = update_incident_assignment(
            db,
            incident["id"],
            assignee_id=other_user_id,
            actor=user_id,
        )
        expect(
            "assignment persisted",
            updated and updated["assigned_to"] == other_user_id,
        )

        # Service-level invalid FK
        invalid = False
        try:
            incident_service.assign_incident(
                incident_id=incident["id"],
                user_id=user_id,
                assignee_id="does-not-exist",
                actor=user_id,
            )
        except ValueError:
            invalid = True
        expect("rejects unknown assignee", invalid)
    finally:
        db.close()


def test_auto_merge_window(user_id: str) -> None:
    print("\n[auto-merge]")
    db = get_db()
    try:
        camera = "Camera-Merge-1"
        first = create_incident(
            db,
            user_id=user_id,
            title="Initial sighting",
            source_camera_label=camera,
        )

        candidate = find_merge_candidate(
            db,
            user_id=user_id,
            source_camera_label=camera,
            window_seconds=20,
        )
        expect(
            "merge candidate found within window",
            candidate is not None and candidate["id"] == first["id"],
        )

        # Different camera -> no merge
        other = find_merge_candidate(
            db,
            user_id=user_id,
            source_camera_label="UnrelatedCamera",
            window_seconds=20,
        )
        expect("no merge across cameras", other is None)
    finally:
        db.close()


async def test_create_from_alert_no_api_key(user_id: str) -> None:
    print("\n[create_from_alert (no API key)]")
    # The real call site (alert_service.scan_frame) persists the
    # alert_event row before invoking incident_service, so the FK target
    # always exists. We replicate that here with a real conversation +
    # alert rule + alert event.
    from app.storage.alert_store import create_event, create_rule
    from app.storage.conversation_store import create_conversation

    db = get_db()
    try:
        conv = create_conversation(
            db,
            user_id=user_id,
            title="Smoke alert source",
            system_prompt="",
        )
        rule = create_rule(
            db, conversation_id=conv["id"], description="Person at gate"
        )
        alert_event = create_event(
            db,
            conversation_id=conv["id"],
            rule_id=rule["id"],
            matched_description="Person at restricted gate",
            ai_description="Person observed at gate after hours.",
            frame_path=None,
            confidence="high",
        )
    finally:
        db.close()

    # Unique camera label avoids the auto-merge path (verified separately
    # in test_auto_merge_window) so we can exercise the fresh-create flow.
    result = await incident_service.create_incident_from_alert(
        alert_event=alert_event,
        conversation_id=conv["id"],
        user_id=user_id,
        api_key=None,
        camera_label="Camera-FromAlert-Unique",
        locale="he",
    )
    expect("incident_service returns an incident", result is not None)
    if result:
        expect("title uses matched rule", "Person at" in result["title"])
        expect(
            "severity defaults to medium",
            result["severity"] == "medium",
        )
        expect(
            "ai_reasoning uses fallback",
            "Ghost" in (result["ai_reasoning"] or ""),
        )


def test_kpi_stats(user_id: str) -> None:
    print("\n[kpi]")
    db = get_db()
    try:
        stats = get_kpi_stats(db, user_id, window_hours=24)
        expect("kpi total non-negative", stats["total"] >= 0)
        expect("kpi has critical_count", "critical_count" in stats)
        expect("kpi has hot_cameras list", isinstance(stats["hot_cameras"], list))
        expect("kpi has by_status dict", isinstance(stats["by_status"], dict))
    finally:
        db.close()


def test_notes_and_evidence(user_id: str) -> None:
    print("\n[notes + evidence]")
    db = get_db()
    try:
        incident = create_incident(
            db,
            user_id=user_id,
            title="Notes/evidence target",
            source_camera_label="Camera-Notes-1",
        )
        n = add_note(
            db,
            incident_id=incident["id"],
            author=user_id,
            content="First responder is en route.",
        )
        expect("note persisted", n["content"] == "First responder is en route.")

        e = add_evidence(
            db,
            incident_id=incident["id"],
            evidence_type="snapshot",
            image_path="/api/frames/conv-x/abc.jpg",
            metadata={"source": "smoke_test"},
        )
        expect("evidence persisted", e["type"] == "snapshot")
        expect("evidence metadata parsed", e["metadata"]["source"] == "smoke_test")
    finally:
        db.close()


def test_filtering_and_search(user_id: str) -> None:
    print("\n[filters / search]")
    db = get_db()
    try:
        for sev in ("low", "medium", "high", "critical"):
            create_incident(
                db,
                user_id=user_id,
                title=f"{sev}-test-incident",
                source_camera_label=f"Cam-{sev}",
                severity=sev,
            )

        critical_only = list_incidents(
            db, user_id, severity="critical", limit=50
        )
        expect(
            "severity filter narrows to critical",
            all(i["severity"] == "critical" for i in critical_only),
        )

        searched = list_incidents(db, user_id, search="critical-test")
        expect(
            "search hits by title fragment",
            any("critical-test-incident" in i["title"] for i in searched),
        )

        invalid = False
        try:
            list_incidents(db, user_id, status="bogus")
        except ValueError:
            invalid = True
        expect("rejects invalid status filter", invalid)
    finally:
        db.close()


def test_close_persists_resolution_as_summary(user_id: str) -> None:
    print("\n[close persists resolution as summary]")
    db = get_db()
    try:
        incident = create_incident(
            db,
            user_id=user_id,
            title="Close-summary target",
            source_camera_label="Camera-CloseTest-1",
        )
    finally:
        db.close()

    resolution_text = "המאבטח אישש שזה הולך רגל לגיטימי, לא חריג."
    closed = incident_service.close_incident(
        incident_id=incident["id"],
        user_id=user_id,
        actor=user_id,
        resolution=resolution_text,
    )
    expect("close returns row", closed is not None)
    if closed:
        expect("status is closed", closed["status"] == "closed")
        expect(
            "summary equals operator resolution",
            closed["summary"] == resolution_text,
        )
        expect(
            "manual_resolution flag set",
            closed.get("manual_resolution") is True,
        )
        expect("closed_at populated", bool(closed["closed_at"]))

    # And the timeline must record the closure with a note.
    db = get_db()
    try:
        notes = db.execute(
            "SELECT content FROM incident_notes WHERE incident_id = ?",
            (incident["id"],),
        ).fetchall()
        contents = [n["content"] for n in notes]
        expect(
            "resolution stored as a note",
            any("[resolution]" in c and resolution_text in c for c in contents),
        )
        activity_types = [
            row["type"]
            for row in db.execute(
                "SELECT type FROM incident_activity WHERE incident_id = ?",
                (incident["id"],),
            ).fetchall()
        ]
        expect(
            "status_changed activity row for close",
            "status_changed" in activity_types,
        )
    finally:
        db.close()


def test_close_without_resolution_keeps_summary_empty(user_id: str) -> None:
    print("\n[close without resolution skips manual summary]")
    db = get_db()
    try:
        incident = create_incident(
            db,
            user_id=user_id,
            title="No-resolution close",
            source_camera_label="Camera-CloseTest-2",
        )
    finally:
        db.close()

    closed = incident_service.close_incident(
        incident_id=incident["id"],
        user_id=user_id,
        actor=user_id,
        resolution=None,
    )
    expect("close returns row", closed is not None)
    if closed:
        expect("status is closed", closed["status"] == "closed")
        expect("summary unchanged (None)", closed["summary"] is None)
        expect(
            "manual_resolution flag falsey",
            not closed.get("manual_resolution"),
        )


def test_correlate_no_observations(user_id: str) -> None:
    print("\n[correlation - empty]")
    incident = None
    db = get_db()
    try:
        incident = create_incident(
            db,
            user_id=user_id,
            title="Correlation target",
            source_camera_label="Camera-Correlate",
        )
    finally:
        db.close()

    assert incident is not None
    result = incident_service.correlate_entities(
        incident_id=incident["id"], user_id=user_id
    )
    expect("correlation returns dict", isinstance(result, dict))
    if isinstance(result, dict):
        expect(
            "correlation entities list",
            isinstance(result.get("entities"), list),
        )
        expect(
            "correlation suggested cameras list",
            isinstance(result.get("suggested_cameras"), list),
        )


def test_perf_5000_incidents(user_id: str) -> None:
    print("\n[performance - 5000 incidents]")
    db = get_db()
    try:
        start = time.time()
        db.execute("BEGIN")
        for i in range(5000):
            create_incident(
                db,
                user_id=user_id,
                title=f"Perf-test {i}",
                source_camera_label=f"Cam-{i % 30}",
                severity=("critical", "high", "medium", "low")[i % 4],
            )
        db.commit()
        insert_seconds = time.time() - start
        print(f"  insert 5000 incidents: {insert_seconds:.2f}s")
        expect(
            "5000 inserts under 30s",
            insert_seconds < 30.0,
            f"took {insert_seconds:.2f}s",
        )

        start = time.time()
        rows = list_incidents(db, user_id, limit=1000)
        list_seconds = time.time() - start
        print(
            f"  list 1000 incidents: {list_seconds * 1000:.1f}ms (got {len(rows)} rows)"
        )
        expect("list 1000 under 250ms", list_seconds < 0.25)

        start = time.time()
        stats = get_kpi_stats(db, user_id, window_hours=24)
        kpi_seconds = time.time() - start
        print(f"  kpi compute: {kpi_seconds * 1000:.1f}ms")
        expect("kpi under 250ms", kpi_seconds < 0.25)
        expect("kpi total >= 5000", stats["total"] >= 5000)
    finally:
        db.close()


def main() -> int:
    print("Incident smoke tests")
    test_migrations_apply()
    user_id = setup_user()
    other_user = setup_second_user()
    test_create_and_status_transitions(user_id)
    test_assignment_fk(user_id, other_user)
    test_auto_merge_window(user_id)
    asyncio.run(test_create_from_alert_no_api_key(user_id))
    test_notes_and_evidence(user_id)
    test_filtering_and_search(user_id)
    test_kpi_stats(user_id)
    test_close_persists_resolution_as_summary(user_id)
    test_close_without_resolution_keeps_summary_empty(user_id)
    test_correlate_no_observations(user_id)
    test_perf_5000_incidents(user_id)

    print(f"\nRESULTS  passed={PASSED}  failed={FAILED}")
    return 0 if FAILED == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
