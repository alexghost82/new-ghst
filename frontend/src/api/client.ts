import type {
  AlertEvent,
  AlertRule,
  AlertScanResult,
  ApiResponse,
  AutomationDraft,
  AutomationKind,
  AutomationConfirmResult,
  ChatStreamEvent,
  ExpertReport,
  User,
  Conversation,
  Message,
  MemoryItem,
  KnowledgeSource,
  KnowledgeChunk,
  SavedCamera,
  CameraFramePayload,
  CameraSetupItem,
  VisualMemoryResponse,
  IncidentEvent,
  IncidentDetail,
  IncidentActivity,
  IncidentNote,
  IncidentEvidence,
  IncidentCorrelation,
  IncidentKPI,
  IncidentStatus,
  IncidentSeverity,
  IncidentSummaryResult,
  IncidentInvestigationResult,
  DetectionBatchStatus,
  DetectionEvent,
  DetectionFlushResult,
  DetectionObjectsResponse,
  DetectionScanResult,
  DownloadLead,
  JobApplication,
  ScheduledTask,
  TaskReport,
  TaskTrigger,
  TrialAccount,
  PersonaTone,
  Proactivity,
  OperatorProfile,
  EscalationContact,
} from "../types/api";
import { sanitizeBrand } from "../utils/sanitize";
import type { VisionProvider } from "../stores/visionProviderStore";

export interface LocalVisionAnalyzeResult {
  provider: string;
  model: string;
  text?: string;
  analysis?: string;
  content?: string;
}

const BASE = "/api";

// ---------------------------------------------------------------------------
// Active operator id — set by the user store on every session establishment.
// Used to stamp ``user_id`` onto ownership-guarded mutations (rename/delete
// conversation, auto-title, delete memory) so the backend can reject IDOR
// attempts. Kept here (not in the bundle) so call sites stay terse.
// ---------------------------------------------------------------------------
let activeUserId: string | null = null;

export function setApiActiveUser(id: string | null): void {
  activeUserId = id;
}

// ---------------------------------------------------------------------------
// Admin token — guards internal PII/admin endpoints. NEVER embedded in the
// bundle; an operator supplies it at runtime (the demo-admin / downloads
// chords prompt for it) and it is held only in sessionStorage for the tab.
// ---------------------------------------------------------------------------
const ADMIN_TOKEN_KEY = "ghost.adminToken";

export function getAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // sessionStorage unavailable — admin actions will prompt again.
  }
}

/**
 * Run an admin-guarded request, prompting the operator for the admin token if
 * it is missing or rejected. The token is held only in sessionStorage and is
 * never embedded in the bundle. Returns the (possibly retried) response.
 */
export async function withAdminRetry<T>(
  fn: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  if (!getAdminToken() && typeof window !== "undefined") {
    const entered = window.prompt("Ghost admin token");
    if (entered) setAdminToken(entered.trim());
  }
  let res = await fn();
  if (
    !res.ok &&
    res.error?.code === "ADMIN_FORBIDDEN" &&
    typeof window !== "undefined"
  ) {
    const entered = window.prompt(
      "Admin token rejected — re-enter Ghost admin token",
    );
    if (entered) {
      setAdminToken(entered.trim());
      res = await fn();
    }
  }
  return res;
}

function withUserId(path: string): string {
  if (!activeUserId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}user_id=${encodeURIComponent(activeUserId)}`;
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(adminToken ? { "X-Ghost-Admin-Token": adminToken } : {}),
        ...options?.headers,
      },
      ...options,
    });
    const json = await res.json();
    if (!res.ok) {
      // FastAPI wraps ``HTTPException`` in ``{"detail": <whatever was passed>}``.
      // ``error_response`` passes our envelope ``{ok: false, error: {...}}``
      // through, so ``json.detail`` is usually an object — not a string. We
      // must unwrap it before treating any field as a string, otherwise
      // ``sanitizeBrand`` blows up with "text.replace is not a function".
      const detail = json?.detail;
      const detailError =
        detail && typeof detail === "object" ? detail.error : null;
      const detailString = typeof detail === "string" ? detail : null;
      const errorEnvelope = json?.error ?? detailError ?? null;
      const fallbackMessage =
        errorEnvelope?.message ??
        detailString ??
        (typeof res.statusText === "string" ? res.statusText : "Request failed");
      const safeMessage =
        typeof fallbackMessage === "string"
          ? fallbackMessage
          : JSON.stringify(fallbackMessage);
      return {
        ok: false,
        error: errorEnvelope
          ? {
              ...errorEnvelope,
              message: sanitizeBrand(
                typeof errorEnvelope.message === "string"
                  ? errorEnvelope.message
                  : safeMessage,
              ),
            }
          : { code: "UNKNOWN", message: sanitizeBrand(safeMessage) },
      };
    }
    return { ok: true, data: json.data ?? json };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }
}

/**
 * Parse a Ghost SSE response body into a typed stream of {@link ChatStreamEvent}.
 * Shared by the per-conversation chat endpoint and the ephemeral area/group
 * broadcast endpoint, which speak the same ``camera_start`` / ``token`` /
 * ``camera_done`` / ``done`` protocol.
 */
function createChatStream(res: Response): ReadableStream<ChatStreamEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<ChatStreamEvent>({
    async start(controller) {
      let buffer = "";
      let currentEvent: string | null = null;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
              currentEvent = null;
              continue;
            }
            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.slice(6).trim();
              continue;
            }
            if (trimmed.startsWith("data:")) {
              const data = trimmed.slice(5).trimStart();
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (currentEvent === "done") {
                  controller.enqueue({
                    type: "done",
                    message_id: parsed.message_id,
                    user_message_id: parsed.user_message_id,
                    user_image_path: parsed.user_image_path ?? null,
                    expert_ready: parsed.expert_ready ?? false,
                  });
                } else if (currentEvent === "user_message") {
                  controller.enqueue({
                    type: "user_message",
                    user_message_id: parsed.user_message_id,
                    camera_count: parsed.camera_count,
                  });
                } else if (currentEvent === "camera_start") {
                  controller.enqueue({
                    type: "camera_start",
                    label: parsed.label,
                    index: parsed.index,
                    conversation_id: parsed.conversation_id ?? null,
                  });
                } else if (currentEvent === "camera_done") {
                  controller.enqueue({
                    type: "camera_done",
                    label: parsed.label,
                    message_id: parsed.message_id,
                    image_path: parsed.image_path ?? null,
                    conversation_id: parsed.conversation_id ?? null,
                  });
                } else if (currentEvent === "error" || parsed.code) {
                  controller.error(
                    new Error(parsed.message || parsed.code || "Stream error"),
                  );
                  return;
                } else if (parsed.token !== undefined) {
                  controller.enqueue({
                    type: "token",
                    token: parsed.token,
                    camera_label: parsed.camera_label ?? null,
                  });
                }
              } catch {
                // ignore malformed data lines
              }
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

export const api = {
  // Users
  createUser(
    nickname: string,
    apiKey: string,
    extras?: {
      origin?: "standard" | "trial";
      lead_name?: string;
      lead_email?: string;
      lead_phone?: string;
    },
  ) {
    // Self-service registration: nickname + API key, no admin token required.
    return request<User>("/users", {
      method: "POST",
      body: JSON.stringify({ nickname, api_key: apiKey, ...extras }),
    });
  },

  // Public trial: the server holds the shared demo key, so the browser sends
  // only the visitor's contact details.
  createTrialUser(lead: { name: string; email: string; phone: string }) {
    return request<User>("/users/demo/trial", {
      method: "POST",
      body: JSON.stringify({
        lead_name: lead.name,
        lead_email: lead.email,
        lead_phone: lead.phone,
      }),
    });
  },

  // Legacy shared demo account — server logs in / seeds it with its own key.
  demoAdminLogin() {
    return request<User>("/users/demo/admin-login", { method: "POST" });
  },

  // Server-side check of the operator-provisioning authorization code.
  verifyGmCode(code: string) {
    return request<{ valid: boolean }>("/users/verify-gm", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  // Demo accounts opened through the public trial gate, newest first, with
  // the visitor's contact details. Feeds the demo-admin (8+0) picker.
  // Requires an admin token (X-Ghost-Admin-Token).
  listTrialAccounts() {
    return request<TrialAccount[]>("/users/trial-accounts");
  },

  loginUser(nickname: string, apiKey: string) {
    return request<User>("/users/login", {
      method: "POST",
      body: JSON.stringify({ nickname, api_key: apiKey }),
    });
  },

  createMagicLink(userId: string, ttlMinutes?: number) {
    return request<{
      token: string;
      user_id: string;
      expires_at: string;
      expires_in_seconds: number;
      login_path: string;
    }>(`/users/${userId}/magic-link`, {
      method: "POST",
      body: JSON.stringify(ttlMinutes ? { ttl_minutes: ttlMinutes } : {}),
    });
  },

  loginWithMagicToken(token: string) {
    return request<User>("/users/login/magic", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  listUsers() {
    return request<User[]>("/users");
  },

  // Public document-download lead capture + internal review.
  trackDownload(
    lead: {
      email?: string;
      phone?: string;
      name?: string;
      company?: string;
      file?: string;
    },
  ) {
    const body: Record<string, string> = {};
    if (lead.email) body.email = lead.email;
    if (lead.phone) body.phone = lead.phone;
    if (lead.name) body.name = lead.name;
    if (lead.company) body.company = lead.company;
    if (lead.file) body.file = lead.file;
    return request<DownloadLead>("/downloads/track", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listDownloads() {
    return request<DownloadLead[]>("/downloads");
  },

  // Public Careers-page job application (multipart — carries a CV file).
  async submitApplication(application: {
    name: string;
    phone: string;
    email?: string;
    role?: string;
    message?: string;
    cv: File;
  }): Promise<ApiResponse<JobApplication>> {
    try {
      const formData = new FormData();
      formData.append("name", application.name);
      formData.append("phone", application.phone);
      if (application.email) formData.append("email", application.email);
      if (application.role) formData.append("role", application.role);
      if (application.message) formData.append("message", application.message);
      formData.append("cv", application.cv);

      const res = await fetch(`${BASE}/applications`, {
        method: "POST",
        body: formData,
      });
      let json: Record<string, unknown>;
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      if (!res.ok) {
        const err =
          (json.detail as Record<string, unknown>)?.error ?? json.error;
        const envelope = err as { code: string; message: string } | undefined;
        return {
          ok: false,
          error: envelope
            ? { ...envelope, message: sanitizeBrand(envelope.message) }
            : {
                code: "APPLICATION_FAILED",
                message: sanitizeBrand(res.statusText || "Submission failed"),
              },
        };
      }
      return { ok: true, data: (json.data ?? json) as JobApplication };
    } catch (err) {
      return {
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : "Submission failed",
        },
      };
    }
  },

  updateUser(id: string, data: Partial<{ nickname: string; api_key: string }>) {
    return request<User>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Conversations
  createConversation(
    userId: string,
    title?: string,
    systemPrompt?: string,
    lead?: { name?: string; email?: string; phone?: string },
  ) {
    return request<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        title: title || "New conversation",
        system_prompt: systemPrompt,
        lead_name: lead?.name,
        lead_email: lead?.email,
        lead_phone: lead?.phone,
      }),
    });
  },

  listConversations(userId: string, scopeByIp = false) {
    const scope = scopeByIp ? "&scope_ip=1" : "";
    return request<Conversation[]>(`/conversations?user_id=${userId}${scope}`);
  },

  getConversation(id: string) {
    return request<Conversation>(`/conversations/${id}`);
  },

  deleteConversation(id: string) {
    return request<void>(withUserId(`/conversations/${id}`), { method: "DELETE" });
  },

  updateConversation(
    id: string,
    data: Partial<{
      title: string;
      system_prompt: string;
      accuracy_level: number;
      response_length: "short" | "medium" | "long";
      image_detail: "low" | "high";
      title_source: "default" | "auto" | "manual";
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
    }>,
  ) {
    return request<Conversation>(withUserId(`/conversations/${id}`), {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Ask the server to (re)generate a short summary title from the
  // conversation's recent turns and persist it with title_source='auto'.
  generateAutoTitle(
    id: string,
    opts: { locale: string; max_words: number },
  ) {
    return request<Conversation>(`/conversations/${id}/auto-title`, {
      method: "POST",
      body: JSON.stringify({ ...opts, user_id: activeUserId ?? "" }),
    });
  },

  // Messages
  getMessages(conversationId: string, userId?: string) {
    const params = userId ? `?user_id=${userId}` : "";
    return request<Message[]>(`/conversations/${conversationId}/messages${params}`);
  },

  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    imageBase64?: string,
    cameraFrames?: CameraFramePayload[],
    locale?: string,
    mode?: "chat" | "site_intelligence" | "expert",
    taskContext?: { task_id: string; camera_label?: string },
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatStreamEvent>> {
    const payload: Record<string, unknown> = { user_id: userId, content };
    if (imageBase64) payload.image_base64 = imageBase64;
    if (cameraFrames && cameraFrames.length > 0) {
      payload.camera_frames = cameraFrames;
    }
    if (locale) payload.locale = locale;
    if (mode && mode !== "chat") payload.mode = mode;
    if (taskContext) {
      payload.task_id = taskContext.task_id;
      if (taskContext.camera_label) {
        payload.camera_label = taskContext.camera_label;
      }
    }

    const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(sanitizeBrand(text || res.statusText));
    }

    return createChatStream(res);
  },

  // Ghost Expert — generate the structured recommendation set (8 tasks + 8
  // alerts) for a conversation from the interrogation history + a live frame.
  generateExpert(
    conversationId: string,
    userId: string,
    imageBase64?: string,
    locale?: string,
  ) {
    const payload: Record<string, unknown> = { user_id: userId };
    if (imageBase64) payload.image_base64 = imageBase64;
    if (locale) payload.locale = locale;
    return request<ExpertReport>(
      `/conversations/${conversationId}/expert/generate`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  },

  getExpertReport(conversationId: string, reportId: string, userId: string) {
    return request<ExpertReport>(
      `/conversations/${conversationId}/expert/reports/${reportId}?user_id=${encodeURIComponent(userId)}`,
    );
  },

  // Materialise an Expert report's recommendations as INACTIVE draft tasks +
  // alert rules in the conversation.
  applyExpert(conversationId: string, userId: string, reportId: string) {
    return request<{ created_tasks: number; created_alerts: number }>(
      `/conversations/${conversationId}/expert/apply`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId, report_id: reportId }),
      },
    );
  },

  async sendBroadcastMessage(
    userId: string,
    content: string,
    cameraFrames: CameraFramePayload[],
    locale?: string,
    scopeLabel?: string,
  ): Promise<ReadableStream<ChatStreamEvent>> {
    const payload: Record<string, unknown> = {
      user_id: userId,
      content,
      camera_frames: cameraFrames,
    };
    if (locale) payload.locale = locale;
    if (scopeLabel) payload.scope_label = scopeLabel;

    const res = await fetch(`${BASE}/broadcast/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(sanitizeBrand(text || res.statusText));
    }

    return createChatStream(res);
  },

  async sendBroadcastExplore(
    userId: string,
    content: string,
    conversationIds: string[],
    locale?: string,
    scopeLabel?: string,
  ): Promise<ReadableStream<ChatStreamEvent>> {
    const payload: Record<string, unknown> = {
      user_id: userId,
      content,
      conversation_ids: conversationIds,
    };
    if (locale) payload.locale = locale;
    if (scopeLabel) payload.scope_label = scopeLabel;

    const res = await fetch(`${BASE}/broadcast/explore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(sanitizeBrand(text || res.statusText));
    }

    return createChatStream(res);
  },

  // Cameras (saved per-conversation setup)
  listCameras(conversationId: string, userId: string) {
    return request<SavedCamera[]>(
      `/conversations/${conversationId}/cameras?user_id=${userId}`,
    );
  },

  saveCameras(
    conversationId: string,
    userId: string,
    cameras: CameraSetupItem[],
  ) {
    return request<SavedCamera[]>(
      `/conversations/${conversationId}/cameras`,
      {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, cameras }),
      },
    );
  },

  clearCameras(conversationId: string, userId: string) {
    return request<{ deleted: number }>(
      `/conversations/${conversationId}/cameras?user_id=${userId}`,
      { method: "DELETE" },
    );
  },

  // Memory
  getMemoryItems(conversationId: string, userId: string) {
    return request<MemoryItem[]>(
      `/conversations/${conversationId}/memory?user_id=${encodeURIComponent(userId)}`,
    );
  },

  deleteMemoryItem(conversationId: string, memoryId: string) {
    return request<void>(
      withUserId(`/conversations/${conversationId}/memory/${memoryId}`),
      { method: "DELETE" },
    );
  },

  getVisualMemory(conversationId: string, userId: string) {
    return request<VisualMemoryResponse>(
      `/conversations/${conversationId}/visual-memory?user_id=${encodeURIComponent(userId)}`,
    );
  },

  // Knowledge
  async uploadKnowledgeFile(
    userId: string,
    file: File,
    tags?: string[],
  ): Promise<ApiResponse<KnowledgeSource>> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", userId);
      formData.append("source_type", "file");
      if (tags?.length) formData.append("tags", JSON.stringify(tags));

      const res = await fetch(`${BASE}/knowledge/sources`, {
        method: "POST",
        body: formData,
      });
      let json: Record<string, unknown>;
      try { json = await res.json(); } catch { json = {}; }
      if (!res.ok) {
        const err = (json.detail as Record<string, unknown>)?.error ?? json.error;
        return {
          ok: false,
          error: (err as { code: string; message: string }) ?? { code: "UPLOAD_FAILED", message: res.statusText },
        };
      }
      return { ok: true, data: (json.data ?? json) as KnowledgeSource };
    } catch (err) {
      return { ok: false, error: { code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Upload failed" } };
    }
  },

  async createKnowledgeText(userId: string, content: string, tags?: string[]): Promise<ApiResponse<KnowledgeSource>> {
    try {
      const formData = new FormData();
      formData.append("user_id", userId);
      formData.append("source_type", "text");
      formData.append("content", content);
      if (tags?.length) formData.append("tags", JSON.stringify(tags));

      const res = await fetch(`${BASE}/knowledge/sources`, {
        method: "POST",
        body: formData,
      });
      let json: Record<string, unknown>;
      try { json = await res.json(); } catch { json = {}; }
      if (!res.ok) {
        const err = (json.detail as Record<string, unknown>)?.error ?? json.error;
        return {
          ok: false,
          error: (err as { code: string; message: string }) ?? { code: "CREATE_FAILED", message: res.statusText },
        };
      }
      return { ok: true, data: (json.data ?? json) as KnowledgeSource };
    } catch (err) {
      return { ok: false, error: { code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Create failed" } };
    }
  },

  listKnowledgeSources(userId: string) {
    return request<KnowledgeSource[]>(`/knowledge/sources?user_id=${userId}`);
  },

  deleteKnowledgeSource(id: string, userId: string) {
    return request<void>(`/knowledge/sources/${id}?user_id=${userId}`, { method: "DELETE" });
  },

  updateKnowledgeSource(
    id: string,
    userId: string,
    data: Partial<{ is_active: boolean; tags: string[]; filename: string; content: string }>,
  ) {
    return request<KnowledgeSource>(`/knowledge/sources/${id}?user_id=${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getKnowledgeChunks(sourceId: string, userId: string) {
    return request<KnowledgeChunk[]>(`/knowledge/sources/${sourceId}/chunks?user_id=${userId}`);
  },

  // Alerts
  listAlertRules(conversationId: string, userId: string) {
    return request<AlertRule[]>(
      `/conversations/${conversationId}/alerts/rules?user_id=${userId}`,
    );
  },

  createAlertRule(
    conversationId: string,
    userId: string,
    description: string,
  ) {
    return request<AlertRule>(
      `/conversations/${conversationId}/alerts/rules`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId, description }),
      },
    );
  },

  updateAlertRule(
    ruleId: string,
    userId: string,
    data: Partial<{ description: string; is_active: boolean }>,
  ) {
    return request<AlertRule>(`/alerts/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  },

  deleteAlertRule(ruleId: string, userId: string) {
    return request<{ deleted: boolean }>(
      `/alerts/rules/${ruleId}?user_id=${userId}`,
      { method: "DELETE" },
    );
  },

  setAlertMode(conversationId: string, userId: string, enabled: boolean) {
    return request<{ alert_mode_enabled: boolean }>(
      `/conversations/${conversationId}/alerts/mode`,
      {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, enabled }),
      },
    );
  },

  scanAlertFrame(
    conversationId: string,
    userId: string,
    imageBase64: string,
    locale?: string,
    deviceId?: string,
    cameraLabel?: string,
  ) {
    const payload: Record<string, unknown> = {
      user_id: userId,
      image_base64: imageBase64,
    };
    if (locale) payload.locale = locale;
    if (deviceId) payload.device_id = deviceId;
    if (cameraLabel) payload.camera_label = cameraLabel;
    return request<AlertScanResult>(
      `/conversations/${conversationId}/alerts/scan`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  listAlertEvents(
    conversationId: string,
    userId: string,
    limit: number = 50,
  ) {
    return request<AlertEvent[]>(
      `/conversations/${conversationId}/alerts/events?user_id=${userId}&limit=${limit}`,
    );
  },

  acknowledgeAlertEvent(eventId: string, userId: string) {
    return request<AlertEvent>(`/alerts/events/${eventId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  // Scheduled tasks (משימות)
  listTasks(conversationId: string, userId: string) {
    return request<ScheduledTask[]>(
      `/conversations/${conversationId}/tasks?user_id=${encodeURIComponent(userId)}`,
    );
  },

  createTask(
    conversationId: string,
    userId: string,
    data: {
      name: string;
      prompt_text: string;
      schedule_type: "once" | "interval" | "daily";
      run_at?: string;
      interval_seconds?: number;
      daily_time?: string;
      include_camera?: boolean;
    },
  ) {
    return request<ScheduledTask>(`/conversations/${conversationId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  },

  updateTask(
    taskId: string,
    userId: string,
    data: Partial<{
      name: string;
      prompt_text: string;
      schedule_type: "once" | "interval" | "daily";
      run_at: string;
      interval_seconds: number;
      daily_time: string;
      include_camera: boolean;
      is_active: boolean;
    }>,
  ) {
    return request<ScheduledTask>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  },

  deleteTask(taskId: string, userId: string) {
    return request<{ deleted: boolean }>(
      `/tasks/${taskId}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },

  // Atomic run claim — 200 means this tab runs the task now, 409 (TASK_NOT_DUE)
  // means it is not due or another tab/device already claimed it.
  claimTask(taskId: string, userId: string) {
    return request<ScheduledTask>(`/tasks/${taskId}/claim`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  createTaskTrigger(
    taskId: string,
    userId: string,
    phrase: string,
    alertKind: "critical" | "report",
  ) {
    return request<TaskTrigger>(`/tasks/${taskId}/triggers`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        phrase,
        alert_kind: alertKind,
      }),
    });
  },

  updateTaskTrigger(
    triggerId: string,
    userId: string,
    data: Partial<{
      phrase: string;
      alert_kind: "critical" | "report";
      is_active: boolean;
    }>,
  ) {
    return request<TaskTrigger>(`/tasks/triggers/${triggerId}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  },

  deleteTaskTrigger(triggerId: string, userId: string) {
    return request<{ deleted: boolean }>(
      `/tasks/triggers/${triggerId}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },

  listTaskReports(conversationId: string, userId: string, limit = 100) {
    return request<TaskReport[]>(
      `/conversations/${conversationId}/tasks/reports?user_id=${encodeURIComponent(
        userId,
      )}&limit=${limit}`,
    );
  },

  // Conversational automations (free-language alert/task builder)
  parseAutomation(
    conversationId: string,
    userId: string,
    kind: AutomationKind,
    text: string,
    locale: "he" | "en",
    clientNow: string,
  ) {
    return request<AutomationDraft>(
      `/conversations/${conversationId}/automations/parse`,
      {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          kind,
          text,
          locale,
          client_now: clientNow,
        }),
      },
    );
  },

  listAutomationDrafts(conversationId: string, userId: string) {
    return request<AutomationDraft[]>(
      `/conversations/${conversationId}/automations/drafts?user_id=${encodeURIComponent(
        userId,
      )}`,
    );
  },

  updateAutomationDraft(
    draftId: string,
    userId: string,
    payload: Record<string, unknown>,
  ) {
    return request<AutomationDraft>(`/automations/drafts/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, payload }),
    });
  },

  confirmAutomationDraft(draftId: string, userId: string, activate: boolean) {
    return request<AutomationConfirmResult>(
      `/automations/drafts/${draftId}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId, activate }),
      },
    );
  },

  dismissAutomationDraft(draftId: string, userId: string) {
    return request<{ draft: AutomationDraft }>(
      `/automations/drafts/${draftId}/dismiss?user_id=${encodeURIComponent(
        userId,
      )}`,
      { method: "POST" },
    );
  },

  // Object Tracking (Detection Engine)
  setTrackingMode(conversationId: string, userId: string, enabled: boolean) {
    return request<{ tracking_enabled: boolean }>(
      `/conversations/${conversationId}/detection/mode`,
      {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, enabled }),
      },
    );
  },

  getTrackingMode(conversationId: string, userId: string) {
    return request<{ tracking_enabled: boolean }>(
      `/conversations/${conversationId}/detection/mode?user_id=${encodeURIComponent(
        userId,
      )}`,
    );
  },

  scanDetectionFrame(
    conversationId: string,
    userId: string,
    imageBase64: string,
    deviceId?: string,
    cameraLabel?: string,
    capturedAt?: string,
  ) {
    const payload: Record<string, unknown> = {
      user_id: userId,
      image_base64: imageBase64,
    };
    if (deviceId) payload.device_id = deviceId;
    if (cameraLabel) payload.camera_label = cameraLabel;
    if (capturedAt) payload.captured_at = capturedAt;
    return request<DetectionScanResult>(
      `/conversations/${conversationId}/detection/scan`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  listDetectionEvents(
    conversationId: string,
    userId: string,
    limit: number = 100,
  ) {
    return request<DetectionEvent[]>(
      `/conversations/${conversationId}/detection/events?user_id=${encodeURIComponent(
        userId,
      )}&limit=${limit}`,
    );
  },

  listDetectedObjects(
    conversationId: string,
    userId: string,
    limit: number = 200,
  ) {
    return request<DetectionObjectsResponse>(
      `/conversations/${conversationId}/detection/objects?user_id=${encodeURIComponent(
        userId,
      )}&limit=${limit}`,
    );
  },

  getDetectionBatchStatus(conversationId: string, userId: string) {
    return request<DetectionBatchStatus>(
      `/conversations/${conversationId}/detection/batch?user_id=${encodeURIComponent(
        userId,
      )}`,
    );
  },

  setDetectionBatchTarget(
    conversationId: string,
    userId: string,
    target: number,
  ) {
    return request<{ target_count: number }>(
      `/conversations/${conversationId}/detection/batch/target`,
      {
        method: "PUT",
        body: JSON.stringify({ user_id: userId, target }),
      },
    );
  },

  flushDetectionBatch(conversationId: string, userId: string) {
    return request<DetectionFlushResult>(
      `/conversations/${conversationId}/detection/batch/flush`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      },
    );
  },

  // Incidents
  listIncidents(
    userId: string,
    options: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      assignedTo?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const params = new URLSearchParams({ user_id: userId });
    if (options.status) params.set("status", options.status);
    if (options.severity) params.set("severity", options.severity);
    if (options.assignedTo) params.set("assigned_to", options.assignedTo);
    if (options.search) params.set("search", options.search);
    if (options.limit !== undefined)
      params.set("limit", String(options.limit));
    if (options.offset !== undefined)
      params.set("offset", String(options.offset));
    return request<IncidentEvent[]>(`/incidents?${params.toString()}`);
  },

  getIncident(incidentId: string, userId: string) {
    return request<IncidentDetail>(
      `/incidents/${incidentId}?user_id=${encodeURIComponent(userId)}`,
    );
  },

  updateIncident(
    incidentId: string,
    userId: string,
    data: Partial<{
      status: IncidentStatus;
      severity: IncidentSeverity;
      tags: string[];
      assigned_to: string | null;
      clear_assignment: boolean;
    }>,
  ) {
    return request<IncidentEvent>(`/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  },

  assignIncident(
    incidentId: string,
    userId: string,
    assigneeId: string | null,
  ) {
    return request<IncidentEvent>(`/incidents/${incidentId}/assign`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, assignee_id: assigneeId }),
    });
  },

  addIncidentNote(incidentId: string, userId: string, content: string) {
    return request<IncidentNote>(`/incidents/${incidentId}/notes`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, content }),
    });
  },

  addIncidentEvidence(
    incidentId: string,
    userId: string,
    data: {
      type: string;
      image_path?: string;
      observation_id?: string;
      entity_id?: string;
      alert_event_id?: string;
    },
  ) {
    return request<IncidentEvidence>(`/incidents/${incidentId}/evidence`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, ...data }),
    });
  },

  closeIncident(incidentId: string, userId: string, resolution?: string) {
    return request<IncidentEvent>(`/incidents/${incidentId}/close`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, resolution }),
    });
  },

  getIncidentTimeline(incidentId: string, userId: string) {
    return request<IncidentActivity[]>(
      `/incidents/${incidentId}/timeline?user_id=${encodeURIComponent(userId)}`,
    );
  },

  getIncidentEvidence(incidentId: string, userId: string) {
    return request<IncidentEvidence[]>(
      `/incidents/${incidentId}/evidence?user_id=${encodeURIComponent(userId)}`,
    );
  },

  getIncidentCorrelation(incidentId: string, userId: string) {
    return request<IncidentCorrelation>(
      `/incidents/${incidentId}/correlated?user_id=${encodeURIComponent(userId)}`,
    );
  },

  investigateIncident(incidentId: string, userId: string, locale?: string) {
    return request<IncidentInvestigationResult>(
      `/incidents/${incidentId}/investigate`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId, locale }),
      },
    );
  },

  regenerateIncidentSummary(
    incidentId: string,
    userId: string,
    locale?: string,
  ) {
    return request<IncidentSummaryResult>(`/incidents/${incidentId}/summary`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, locale }),
    });
  },

  getIncidentKPI(userId: string, windowHours: number = 24) {
    return request<IncidentKPI>(
      `/incidents/kpi?user_id=${encodeURIComponent(userId)}&window_hours=${windowHours}`,
    );
  },

  analyzeLocalVision(params: {
    user_id: string;
    image_base64: string;
    prompt?: string;
    conversation_id?: string;
    camera_id?: string;
    provider?: VisionProvider;
  }) {
    const payload: Record<string, unknown> = {
      user_id: params.user_id,
      image_base64: params.image_base64,
    };
    if (params.prompt) payload.prompt = params.prompt;
    if (params.conversation_id) payload.conversation_id = params.conversation_id;
    if (params.camera_id) payload.camera_id = params.camera_id;
    if (params.provider) payload.provider = params.provider;
    return request<LocalVisionAnalyzeResult>("/vision/local-analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
