from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

IncidentStatus = Literal["new", "handling", "investigation", "closed"]
IncidentSeverity = Literal["low", "medium", "high", "critical"]

# Upper bound on any inbound base64-encoded image. ~14M chars of base64 decode
# to ~10.5MB of binary — comfortably above a high-res JPEG frame while blocking
# multi-MB payload floods that would exhaust memory / inflate vision cost.
MAX_IMAGE_BASE64_LEN = 14_000_000


class CreateUserRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=100)
    api_key: str = Field(..., min_length=1)
    # Public-trial accounts are auto-created with the visitor's name and the
    # contact details left at the trial gate, so the demo admin (8+0) can
    # list every demo account with who opened it.
    origin: Literal["standard", "trial"] = "standard"
    lead_name: Optional[str] = Field(None, max_length=200)
    lead_email: Optional[str] = Field(None, max_length=320)
    lead_phone: Optional[str] = Field(None, max_length=64)


class UpdateUserRequest(BaseModel):
    nickname: Optional[str] = Field(None, min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, min_length=1)


class CreateConversationRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    title: Optional[str] = ""
    system_prompt: Optional[str] = ""
    # Public-trial lead contact, stamped on conversations the visitor opens
    # from the site so the admin (8+0) can see who started each one.
    lead_name: Optional[str] = None
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None


class EscalationContact(BaseModel):
    """A single person Ghost should report to on a qualifying alert. Stored as
    config only — Ghost is told who to notify; actual WhatsApp delivery is a
    separate integration and is out of scope here."""

    name: str = Field("", max_length=120)
    role: str = Field("", max_length=120)
    phone: str = Field("", max_length=64)
    min_severity: Literal["critical", "important"] = "critical"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None
    # Answer accuracy tier (1-4). Higher == stronger/pricier model.
    accuracy_level: Optional[int] = Field(None, ge=1, le=4)
    # How long the reply may run before it must wrap up (output cap tier).
    response_length: Optional[Literal["short", "medium", "long"]] = None
    # How finely a camera frame is examined.
    image_detail: Optional[Literal["low", "high"]] = None
    # Where the title came from. A bare ``title`` rename from the operator is
    # treated as 'manual' by the route unless an explicit source is supplied.
    title_source: Optional[Literal["default", "auto", "manual"]] = None

    # --- Ghost Character (structured per-conversation persona) ------------
    agent_name: Optional[str] = Field(None, max_length=120)
    role_mission: Optional[str] = Field(None, max_length=2000)
    site_type: Optional[str] = Field(None, max_length=80)
    focus_priorities: Optional[str] = Field(None, max_length=2000)
    ignore_scope: Optional[str] = Field(None, max_length=2000)
    site_baseline: Optional[str] = Field(None, max_length=2000)
    persona_tone: Optional[Literal["", "terse", "friendly", "formal"]] = None
    dry_humor: Optional[bool] = None
    proactivity: Optional[
        Literal["", "on_demand", "flag_anomalies", "continuous"]
    ] = None
    operator_profile: Optional[
        Literal["", "guard", "shift_manager", "owner"]
    ] = None
    critical_event_definition: Optional[str] = Field(None, max_length=2000)
    escalation_contacts: Optional[list[EscalationContact]] = None
    quiet_hours: Optional[str] = Field(None, max_length=64)


class AutoTitleRequest(BaseModel):
    """Ask the system to (re)generate a short summary title for a conversation
    from Ghost's replies. Used by the frontend auto-naming orchestrator."""

    # Owner of the conversation — enforced server-side so a caller cannot
    # auto-title (and burn OpenAI quota on) a conversation they do not own.
    user_id: str = Field(..., min_length=1)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")
    max_words: int = Field(6, ge=2, le=10)


class CameraFramePayload(BaseModel):
    device_id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    image_base64: str = Field(..., min_length=1, max_length=MAX_IMAGE_BASE64_LEN)


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    image_base64: Optional[str] = Field(None, max_length=MAX_IMAGE_BASE64_LEN)
    camera_frames: Optional[list[CameraFramePayload]] = None
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")
    mode: Optional[Literal["chat", "site_intelligence", "expert"]] = "chat"
    # Set by the browser task engine when this message is an automated
    # scheduled-task run. Enables the post-reply trigger scan and disables
    # auto-title / memory side effects for this turn.
    task_id: Optional[str] = Field(None, min_length=1, max_length=64)
    # Label of the camera whose frame rides along, for task report metadata.
    camera_label: Optional[str] = Field(None, min_length=1, max_length=120)


class ExpertGenerateRequest(BaseModel):
    """Generate the Ghost Expert recommendation set (8 tasks + 8 alerts) for a
    conversation. The interrogation history is read server-side; an optional
    captured frame sharpens the recommendations."""

    user_id: str = Field(..., min_length=1)
    image_base64: Optional[str] = Field(None, max_length=MAX_IMAGE_BASE64_LEN)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")


class ExpertApplyRequest(BaseModel):
    """Materialise the recommendations from a generated Expert report into
    INACTIVE draft tasks + alert rules in the conversation."""

    user_id: str = Field(..., min_length=1)
    report_id: str = Field(..., min_length=1, max_length=64)


class BroadcastMessageRequest(BaseModel):
    """An ephemeral area/group broadcast: one message fanned out to every
    camera in the scope. Nothing is persisted — there is no conversation
    backing this request, only a transient per-camera analysis turn."""

    content: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    camera_frames: list[CameraFramePayload] = Field(..., min_length=1)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")
    scope_label: Optional[str] = Field(None, max_length=200)
    system_prompt: Optional[str] = Field("", max_length=8000)


class BroadcastExploreRequest(BaseModel):
    """An ephemeral area/group "explore" turn: one message answered from each
    conversation's STORED text history (no live camera frame). Mirrors
    :class:`BroadcastMessageRequest` but carries the conversation ids in scope
    instead of camera frames. Nothing is persisted — each conversation gets a
    single warm, transient reply built from its own history."""

    content: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    conversation_ids: list[str] = Field(..., min_length=1)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")
    scope_label: Optional[str] = Field(None, max_length=200)


class CameraSetupItem(BaseModel):
    device_id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    position: Optional[int] = None


class SaveCameraSetupRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    cameras: list[CameraSetupItem] = Field(default_factory=list)


class CreateKnowledgeSourceRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    source_type: str = Field(..., pattern=r"^(file|text)$")
    content: Optional[str] = None
    tags: Optional[list[str]] = Field(default_factory=list)


class UpdateKnowledgeSourceRequest(BaseModel):
    is_active: Optional[bool] = None
    tags: Optional[list[str]] = None
    filename: Optional[str] = None
    content: Optional[str] = None


class CreateAlertRuleRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1, max_length=500)


class UpdateAlertRuleRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    is_active: Optional[bool] = None


class SetAlertModeRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    enabled: bool


class AlertScanRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    image_base64: str = Field(..., min_length=1, max_length=MAX_IMAGE_BASE64_LEN)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")
    # Camera metadata is optional for backwards compatibility but the frontend
    # now always sends it so alert events / incidents can be tied back to the
    # source camera even before multi-camera scanning lands.
    device_id: Optional[str] = Field(None, min_length=1, max_length=256)
    camera_label: Optional[str] = Field(None, min_length=1, max_length=120)


class AcknowledgeAlertRequest(BaseModel):
    user_id: str = Field(..., min_length=1)


TaskScheduleType = Literal["once", "interval", "daily"]
TaskTriggerKind = Literal["critical", "report"]


class CreateScheduledTaskRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=120)
    prompt_text: str = Field(..., min_length=1, max_length=2000)
    schedule_type: TaskScheduleType
    run_at: Optional[str] = Field(None, max_length=64)
    # Server-side floor of 45 seconds guards against self-DoS / cost runaway
    # (the task engine ticks every 20s, so 45s is the safe practical minimum).
    interval_seconds: Optional[int] = Field(None, ge=45, le=86400)
    daily_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    include_camera: bool = True


class UpdateScheduledTaskRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    prompt_text: Optional[str] = Field(None, min_length=1, max_length=2000)
    schedule_type: Optional[TaskScheduleType] = None
    run_at: Optional[str] = Field(None, max_length=64)
    interval_seconds: Optional[int] = Field(None, ge=45, le=86400)
    daily_time: Optional[str] = Field(None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    include_camera: Optional[bool] = None
    is_active: Optional[bool] = None


class ClaimScheduledTaskRequest(BaseModel):
    user_id: str = Field(..., min_length=1)


class CreateTaskTriggerRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    phrase: str = Field(..., min_length=1, max_length=300)
    alert_kind: TaskTriggerKind = "critical"


class UpdateTaskTriggerRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    phrase: Optional[str] = Field(None, min_length=1, max_length=300)
    alert_kind: Optional[TaskTriggerKind] = None
    is_active: Optional[bool] = None


AutomationKind = Literal["alert", "task"]


class ParseAutomationRequest(BaseModel):
    """Free-language alert/task request typed from the composer in automation
    mode. ``client_now`` carries the operator's local time so relative
    schedule wording resolves against Asia/Jerusalem correctly."""

    user_id: str = Field(..., min_length=1)
    kind: AutomationKind
    text: str = Field(..., min_length=1, max_length=2000)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")
    client_now: Optional[str] = Field(None, max_length=64)


class UpdateAutomationDraftRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    # Partial payload patch merged into the draft (operator edits in the
    # widget). Re-normalised server-side before persisting.
    payload: dict = Field(default_factory=dict)


class ConfirmAutomationDraftRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    # True -> create active + arm/run now; False -> create but keep paused.
    activate: bool = True


class UpdateIncidentRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    status: Optional[IncidentStatus] = None
    severity: Optional[IncidentSeverity] = None
    tags: Optional[list[str]] = None
    # Use a sentinel to differentiate "not provided" from "clear assignment":
    # ``assigned_to=None`` AND ``clear_assignment=True`` -> set NULL in DB.
    assigned_to: Optional[str] = None
    clear_assignment: Optional[bool] = False


class AssignIncidentRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    assignee_id: Optional[str] = None


class AddIncidentNoteRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1, max_length=4000)


class CloseIncidentRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    resolution: Optional[str] = Field(None, max_length=4000)


class InvestigateIncidentRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    locale: Optional[str] = Field("he", pattern=r"^(he|en)$")


class AddIncidentEvidenceRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1, max_length=40)
    image_path: Optional[str] = None
    observation_id: Optional[str] = None
    entity_id: Optional[str] = None
    alert_event_id: Optional[str] = None


class DetectionScanRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    image_base64: str = Field(..., min_length=1, max_length=MAX_IMAGE_BASE64_LEN)
    device_id: Optional[str] = Field(None, min_length=1, max_length=256)
    camera_label: Optional[str] = Field(None, min_length=1, max_length=120)
    captured_at: Optional[str] = Field(None, min_length=1, max_length=64)


class SetTrackingModeRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    enabled: bool


class SetDetectionBatchTargetRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    target: int = Field(..., ge=1, le=88)


class FlushDetectionBatchRequest(BaseModel):
    user_id: str = Field(..., min_length=1)


class TrackDownloadRequest(BaseModel):
    """A public lead captured when a visitor unlocks a gated document.

    The visitor may unlock with an email OR a mobile phone (at least one is
    required — enforced in the route). Full name and company are captured by
    the capabilities popup. The IP, user-agent and geolocation are derived
    server-side from the request so they cannot be spoofed by the caller.
    """

    email: Optional[str] = Field(None, max_length=320)
    phone: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=200)
    company: Optional[str] = Field(None, max_length=200)
    file: Optional[str] = Field(None, max_length=256)


class LocalVisionAnalyzeRequest(BaseModel):
    """Standalone frame analysis via local VLM with optional OpenAI fallback."""

    user_id: str = Field(..., min_length=1)
    image_base64: str = Field(..., min_length=1, max_length=MAX_IMAGE_BASE64_LEN)
    prompt: Optional[str] = Field(None, max_length=8000)
    conversation_id: Optional[str] = Field(None, min_length=1)
    camera_id: Optional[str] = Field(None, min_length=1, max_length=256)
    provider: Optional[Literal["openai", "local_vlm", "auto"]] = None
