export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

export interface User {
  id: string;
  nickname: string;
  created_at: string;
  // 'standard' for operator accounts, 'trial' for accounts auto-created by
  // the public trial gate.
  origin?: "standard" | "trial";
}

// A demo account opened by a visitor through the "Talk to Ghost" trial gate,
// with the contact details they left. Consumed by the demo-admin (8+0) picker.
export interface TrialAccount {
  id: string;
  nickname: string;
  created_at: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  conversation_count: number;
}

export interface DownloadLead {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  company: string | null;
  file: string;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  download_count: number;
}

export interface JobApplication {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string | null;
  message: string | null;
  cv_filename: string | null;
  cv_path: string | null;
  cv_size: number | null;
  cv_type: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  system_prompt: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  // Where the title came from: 'default' (date/time placeholder, eligible for
  // auto-naming), 'auto' (system summary), or 'manual' (operator-locked).
  title_source?: "default" | "auto" | "manual";
  camera_count?: number;
  alert_mode_enabled?: boolean;
  tracking_enabled?: boolean;
  // Answer accuracy tier (1-4). Higher == stronger/pricier model. Defaults to 4.
  accuracy_level?: number;
  // How long a reply may run before it must wrap up. Defaults to "long".
  response_length?: "short" | "medium" | "long";
  // How finely a camera frame is examined. Defaults to "high".
  image_detail?: "low" | "high";
  // Public-trial lead contact of the visitor who opened the conversation from
  // the site (visible to the admin/8+0 session in the chat header).
  lead_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  // --- Ghost Character (structured per-conversation persona) -------------
  agent_name?: string;
  role_mission?: string;
  site_type?: string;
  focus_priorities?: string;
  ignore_scope?: string;
  site_baseline?: string;
  persona_tone?: PersonaTone;
  dry_humor?: boolean;
  proactivity?: Proactivity;
  operator_profile?: OperatorProfile;
  critical_event_definition?: string;
  escalation_contacts?: EscalationContact[];
  quiet_hours?: string;
}

export type PersonaTone = "" | "terse" | "friendly" | "formal";
export type Proactivity = "" | "on_demand" | "flag_anomalies" | "continuous";
export type OperatorProfile = "" | "guard" | "shift_manager" | "owner";
export type ContactSeverity = "critical" | "important";

export interface EscalationContact {
  name: string;
  role: string;
  phone: string;
  min_severity: ContactSeverity;
}

/** Mutable Ghost Character payload — the subset of conversation fields the
 *  per-conversation character editor can patch in one save. */
export interface ConversationCharacter {
  agent_name: string;
  role_mission: string;
  site_type: string;
  focus_priorities: string;
  ignore_scope: string;
  site_baseline: string;
  persona_tone: PersonaTone;
  dry_humor: boolean;
  proactivity: Proactivity;
  operator_profile: OperatorProfile;
  critical_event_definition: string;
  escalation_contacts: EscalationContact[];
  quiet_hours: string;
  // Legacy free-text rules — reused as the "additional site rules" layer.
  system_prompt: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_estimate: number;
  created_at: string;
  sequence_number: number;
  image_path?: string | null;
  camera_label?: string | null;
}

export interface SavedCamera {
  id: string;
  conversation_id: string;
  device_id: string;
  label: string;
  position: number;
  created_at: string;
}

export interface CameraFramePayload {
  device_id: string;
  label: string;
  image_base64: string;
}

export interface CameraSetupItem {
  device_id: string;
  label: string;
  position?: number;
}

export interface MemoryItem {
  id: string;
  conversation_id: string;
  type: "fact" | "preference" | "instruction" | "entity";
  content: string;
  relevance_score: number;
  access_count: number;
  created_at: string;
}

export type VisualEntityType =
  | "person"
  | "vehicle"
  | "environment"
  | "object";

export interface VisualAttributes {
  clothing?: string;
  colors?: string[];
  vehicle_type?: string;
  vehicle_color?: string;
  facial_hair?: string;
  objects_held?: string[];
  environmental_details?: string[];
  [key: string]: unknown;
}

export interface VisualEntity {
  id: string;
  conversation_id: string;
  entity_type: VisualEntityType;
  signature: string;
  canonical_description: string;
  visual_attributes: VisualAttributes;
  cameras_seen: string[];
  first_seen: string;
  last_seen: string;
  times_seen: number;
  last_match_confidence: number | null;
}

export interface VisualObservation {
  id: string;
  conversation_id: string;
  message_id: string;
  entity_id: string | null;
  entity_type: VisualEntityType;
  camera_label: string | null;
  camera_device_id: string | null;
  description: string;
  visual_attributes: VisualAttributes;
  position_in_frame: string | null;
  direction: string | null;
  activity: string | null;
  confidence: number;
  semantic_tags: string[];
  image_path: string | null;
  observed_at: string;
}

export interface VisualMemorySummary {
  by_entity_type: Partial<Record<VisualEntityType, number>>;
  total_entities: number;
  total_observations: number;
}

export interface VisualMemoryResponse {
  entities: VisualEntity[];
  observations: VisualObservation[];
  summary: VisualMemorySummary;
}

export interface KnowledgeSource {
  id: string;
  user_id: string;
  source_type: "file" | "text";
  filename: string | null;
  chunk_count: number;
  is_active: boolean;
  tags: string[];
  created_at: string;
}

export interface KnowledgeChunk {
  id: string;
  source_id: string;
  content: string;
  chunk_index: number;
}

export interface SSEEvent {
  event: string;
  data: string;
}

export interface AlertRule {
  id: string;
  conversation_id: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertEvent {
  id: string;
  conversation_id: string;
  rule_id: string;
  matched_description: string;
  ai_description: string;
  frame_path: string | null;
  confidence: string;
  acknowledged: boolean;
  created_at: string;
  // 'camera' (default) = fired by the camera scan loop; 'task' = fired by a
  // scheduled-task trigger match on Ghost's reply. Optional for backwards
  // compatibility with events created before migration 023.
  source?: "camera" | "task";
  task_id?: string | null;
  trigger_id?: string | null;
}

export type TaskScheduleType = "once" | "interval" | "daily";
export type TaskTriggerKind = "critical" | "report";

export interface TaskTrigger {
  id: string;
  task_id: string;
  phrase: string;
  alert_kind: TaskTriggerKind;
  is_active: boolean;
  alert_rule_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTask {
  id: string;
  conversation_id: string;
  name: string;
  prompt_text: string;
  schedule_type: TaskScheduleType;
  run_at: string | null;
  interval_seconds: number | null;
  daily_time: string | null;
  include_camera: boolean;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  triggers?: TaskTrigger[];
}

export interface TaskReport {
  id: string;
  task_id: string;
  trigger_id: string | null;
  conversation_id: string;
  message_id: string | null;
  task_name: string;
  prompt_text: string;
  matched_phrase: string;
  summary: string;
  reply_text: string;
  frame_path: string | null;
  camera_label: string | null;
  created_at: string;
}

export type AutomationKind = "alert" | "task";
export type AutomationDraftStatus = "draft" | "created" | "dismissed";

export interface AutomationAlertPayload {
  kind: "alert";
  description: string;
}

export interface AutomationTaskPayload {
  kind: "task";
  name: string;
  prompt_text: string;
  schedule_type: TaskScheduleType;
  run_at: string | null;
  interval_seconds: number | null;
  daily_time: string | null;
  include_camera: boolean;
  is_check: boolean;
  report_phrase: string;
}

export type AutomationPayload =
  | AutomationAlertPayload
  | AutomationTaskPayload;

export interface AutomationDraft {
  id: string;
  conversation_id: string;
  kind: AutomationKind;
  status: AutomationDraftStatus;
  payload: AutomationPayload;
  source_text: string;
  message_id: string | null;
  created_task_id: string | null;
  created_rule_id: string | null;
  activated: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationConfirmResult {
  draft: AutomationDraft;
  task?: ScheduledTask;
  rule?: AlertRule;
}

export interface AlertScanResult {
  detected: boolean;
  event?: AlertEvent;
  skipped?: boolean;
  error?: boolean;
  detected_at?: string;
}

export type IncidentStatus =
  | "new"
  | "handling"
  | "investigation"
  | "closed";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface IncidentEvent {
  id: string;
  user_id: string;
  conversation_id: string | null;
  alert_event_id: string | null;
  title: string;
  summary: string | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  assigned_to: string | null;
  source_camera_label: string | null;
  preview_image_path: string | null;
  confidence: string | null;
  ai_reasoning: string | null;
  tags: string[];
  handling_started_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface IncidentActivity {
  id: string;
  incident_id: string;
  type: string;
  actor: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IncidentNote {
  id: string;
  incident_id: string;
  author: string | null;
  content: string;
  created_at: string;
}

export interface IncidentEvidence {
  id: string;
  incident_id: string;
  type: string;
  image_path: string | null;
  observation_id: string | null;
  entity_id: string | null;
  alert_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IncidentDetail {
  incident: IncidentEvent;
  timeline: IncidentActivity[];
  notes: IncidentNote[];
  evidence: IncidentEvidence[];
}

export interface IncidentCorrelation {
  entities: VisualEntity[];
  suggested_cameras: string[];
  observations: VisualObservation[];
}

export interface IncidentKPI {
  window_hours: number;
  total: number;
  critical_count: number;
  avg_time_to_handle_sec: number;
  avg_time_to_close_sec: number;
  hot_cameras: Array<{ label: string; count: number }>;
  by_status: Partial<Record<IncidentStatus, number>>;
}

export interface IncidentSummaryResult {
  summary: string;
  key_observations: string[];
}

export interface IncidentInvestigationResult {
  incident_id: string;
  conversation_id: string;
  created: boolean;
}

export type IncidentEventStreamPayload =
  | {
      type: "alert_event";
      event: AlertEvent;
      conversation_id: string;
      conversation_title_hint?: string | null;
    }
  | {
      type: "task_report";
      report: TaskReport;
      conversation_id: string;
    }
  | { type: "incident_event"; incident: IncidentEvent }
  | {
      type: "incident_update";
      incident_id: string;
      patch: Partial<IncidentEvent> & {
        note_added?: IncidentNote;
        evidence_added?: IncidentEvidence;
        merged_alert_event_id?: string;
        evidence?: IncidentEvidence;
      };
    };

export type DetectedObjectType =
  | "person"
  | "vehicle"
  | "bicycle"
  | "motorcycle"
  | "truck"
  | "animal"
  | "object";

export interface DetectionSceneContext {
  environment_type?: string;
  lighting_conditions?: string;
  weather_conditions?: string;
  crowd_density?: string;
  camera_angle?: string;
  visibility_quality?: string;
  motion_intensity?: string;
}

export interface DetectionEvent {
  id: string;
  conversation_id: string;
  camera_device_id: string | null;
  camera_label: string | null;
  timestamp_utc: string;
  captured_at: string | null;
  frame_path: string | null;
  scene_context: DetectionSceneContext;
  object_count: number;
  quick_check_signature: string | null;
  created_at: string;
}

export interface DetectedObject {
  id: string;
  event_id: string;
  conversation_id: string;
  entity_id: string | null;
  tracking_id: string;
  signature: string;
  object_type: DetectedObjectType | string;
  gender_estimation: string | null;
  age_range: string | null;
  clothing_summary: string | null;
  carried_items: string[];
  distinctive_identifiers: string[];
  vehicle_type: string | null;
  manufacturer: string | null;
  model_name: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  license_plate_partial: string | null;
  vehicle_identifiers: string[];
  position_description: string | null;
  activity_description: string | null;
  deep_description: string;
  confidence: number;
  security_relevance_score: number | null;
  full_profile: Record<string, unknown>;
  camera_device_id: string | null;
  camera_label: string | null;
  frame_path: string | null;
  timestamp_utc: string;
  created_at: string;
  // Fast Path / Enrichment Path (migration 026). Optional so legacy
  // payloads and existing constructions stay valid.
  source?: string;
  enrichment_status?: EnrichmentStatus | null;
  seen_count?: number;
  last_seen_at?: string | null;
  retry_count?: number;
  next_retry_at?: string | null;
  last_error?: string | null;
}

export type EnrichmentStatus =
  | "pending_enrichment"
  | "enriching"
  | "enriched"
  | "enrichment_failed"
  | "duplicate_suppressed";

export interface DetectionSummary {
  by_object_type: Partial<Record<DetectedObjectType | string, number>>;
  total_objects: number;
  total_events: number;
}

export interface DetectionObjectsResponse {
  objects: DetectedObject[];
  summary: DetectionSummary;
}

export type DetectionScanStatus =
  | "no_motion"
  | "no_objects"
  | "duplicate"
  | "queued"
  | "fast_objects_created"
  | "batch_ready"
  | "batch_sent"
  | "paused_for_alert"
  | "error";

export interface DetectionDuplicateSuppressed {
  matched_object_id: string;
  reason: string;
  seen_count: number;
  last_seen_at: string | null;
}

export interface DetectionBatch {
  id: string;
  conversation_id: string;
  collage_path: string | null;
  target_count: number;
  crop_count: number;
  triggered_by: string;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
  response: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

export interface DetectionBatchStatus {
  pending_count: number;
  target_count: number;
  max_target: number;
  default_target: number;
  recent_batches: DetectionBatch[];
}

export interface DetectionFlushResult {
  status: "empty" | "sent" | "failed";
  batch: DetectionBatch | null;
  objects: DetectedObject[];
  error?: string | null;
}

export interface DetectionScanResult {
  status: DetectionScanStatus;
  queued: number;
  pending_count: number;
  target_count: number;
  objects?: DetectedObject[];
  batch?: DetectionBatch | null;
  fast_objects_created?: DetectedObject[];
  duplicates_suppressed?: DetectionDuplicateSuppressed[];
  pending_enrichment_count?: number;
  message?: string;
  trace_id?: string;
  timings?: Record<string, string>;
}

export interface ExpertTask {
  name: string;
  prompt: string;
  schedule_hint?: string;
  domain?: string;
}

export interface ExpertAlert {
  description: string;
  domain?: string;
}

export interface ExpertReport {
  report_id: string;
  summary: string;
  tasks: ExpertTask[];
  alerts: ExpertAlert[];
  user_message_id?: string;
  assistant_message_id?: string;
  user_image_path?: string | null;
  applied?: boolean;
}

export type ChatStreamEvent =
  | { type: "token"; token: string; camera_label?: string | null }
  | {
      type: "user_message";
      user_message_id: string;
      camera_count: number;
    }
  | {
      type: "camera_start";
      label: string;
      index: number;
      conversation_id?: string | null;
    }
  | {
      type: "camera_done";
      label: string;
      message_id: string;
      image_path?: string | null;
      conversation_id?: string | null;
    }
  | {
      type: "done";
      message_id: string;
      user_message_id?: string;
      user_image_path?: string | null;
      /** Ghost Expert: the interrogation gathered enough to ask for a frame. */
      expert_ready?: boolean;
    };
