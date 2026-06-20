/**
 * Admin API client for the Owner / Super-Admin console.
 *
 * Talks ONLY to the JWT-protected `/api/admin/*` surface. Distinct from the
 * operator client (`src/api/client.ts`) which uses the trust-the-client
 * `user_id` model — the admin client carries a short-lived Bearer access token
 * and transparently rotates it via the refresh token on a 401.
 */

const BASE = "/api/admin";
const STORAGE_KEY = "ghost.admin.session.v1";

export interface AdminProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  totp_enabled: boolean;
  last_login_at: string | null;
  permissions: string[];
}

export interface AdminSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  admin: AdminProfile;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  status: number;
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------
let _session: AdminSession | null = null;

function loadSession(): AdminSession | null {
  if (_session) return _session;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) _session = JSON.parse(raw) as AdminSession;
  } catch {
    _session = null;
  }
  return _session;
}

export function getStoredSession(): AdminSession | null {
  return loadSession();
}

export function setSession(session: AdminSession): void {
  _session = session;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage full / blocked — session still held in memory */
  }
}

export function clearSession(): void {
  _session = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Core request with one-shot refresh-on-401
// ---------------------------------------------------------------------------
let _refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const session = loadSession();
  if (!session?.refresh_token) return false;
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const body = await res.json();
      if (body?.ok && body.data?.access_token) {
        setSession(body.data as AdminSession);
        return true;
      }
      clearSession();
      return false;
    } catch {
      return false;
    } finally {
      _refreshing = null;
    }
  })();
  return _refreshing;
}

interface RequestOpts {
  auth?: boolean; // attach Bearer (default true)
  _retried?: boolean;
}

export async function request<T>(
  path: string,
  init?: RequestInit,
  opts: RequestOpts = {},
): Promise<ApiResult<T>> {
  const auth = opts.auth !== false;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const session = loadSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    return {
      ok: false,
      status: 0,
      error: { code: "NETWORK", message: "Network error — could not reach the server" },
    };
  }

  // Transparent refresh on a single 401, then retry once.
  if (res.status === 401 && auth && !opts._retried) {
    const refreshed = await doRefresh();
    if (refreshed) {
      return request<T>(path, init, { ...opts, _retried: true });
    }
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }

  const envelope = body as { ok?: boolean; data?: T; error?: { code: string; message: string } } | null;
  if (res.ok && envelope?.ok) {
    return { ok: true, data: envelope.data, status: res.status };
  }
  return {
    ok: false,
    status: res.status,
    error: envelope?.error ?? { code: "ERROR", message: `Request failed (${res.status})` },
  };
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------
export interface LoginResult {
  stage: "mfa" | "mfa_setup";
  mfa_token: string;
  totp_secret?: string;
  otpauth_uri?: string;
}

export const adminApi = {
  login(email: string, password: string) {
    return request<LoginResult>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      { auth: false },
    );
  },
  verifyMfa(mfa_token: string, code: string) {
    return request<AdminSession>(
      "/auth/mfa",
      { method: "POST", body: JSON.stringify({ mfa_token, code }) },
      { auth: false },
    );
  },
  me() {
    return request<AdminProfile>("/auth/me");
  },
  logout(all = false) {
    const session = loadSession();
    return request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session?.refresh_token, all_sessions: all }),
    });
  },
};

// ---------------------------------------------------------------------------
// Users admin
// ---------------------------------------------------------------------------
export interface AdminUserRow {
  id: string;
  nickname: string;
  created_at: string;
  origin: string;
  status: string;
  last_login_at: string | null;
  deleted_at: string | null;
  admin_note: string | null;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  conversation_count: number;
  last_conversation_at: string | null;
}

export interface AdminUserProfile extends Omit<AdminUserRow, "conversation_count" | "last_conversation_at"> {
  stats: { conversations: number; knowledge_sources: number; incidents: number };
  last_conversation_at: string | null;
}

export interface UsersListResponse {
  items: AdminUserRow[];
  total: number;
  limit: number;
  offset: number;
  status_breakdown: Record<string, number>;
}

export interface UsersQuery {
  search?: string;
  status?: string;
  origin?: string;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
}

export const usersApi = {
  list(q: UsersQuery = {}) {
    const params = new URLSearchParams();
    if (q.search) params.set("search", q.search);
    if (q.status) params.set("status", q.status);
    if (q.origin) params.set("origin", q.origin);
    if (q.include_deleted) params.set("include_deleted", "true");
    params.set("limit", String(q.limit ?? 50));
    params.set("offset", String(q.offset ?? 0));
    return request<UsersListResponse>(`/users?${params.toString()}`);
  },
  get(id: string) {
    return request<AdminUserProfile>(`/users/${id}`);
  },
  update(id: string, body: { nickname?: string; admin_note?: string }) {
    return request<AdminUserProfile>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  setStatus(id: string, status: string, reason?: string) {
    return request<AdminUserProfile>(`/users/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    });
  },
  softDelete(id: string, reason: string) {
    return request<AdminUserProfile>(`/users/${id}/delete`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  restore(id: string) {
    return request<AdminUserProfile>(`/users/${id}/restore`, { method: "POST" });
  },
  magicLink(id: string) {
    return request<{ login_path: string; expires_in_seconds: number }>(
      `/users/${id}/magic-link`,
      { method: "POST" },
    );
  },
  impersonate(id: string, reason: string, code: string) {
    return request<{ login_path: string; expires_in_seconds: number }>(
      `/users/${id}/impersonate`,
      { method: "POST", body: JSON.stringify({ reason, code }) },
    );
  },
  create(body: { nickname: string; tier: "trial" | "production"; api_key?: string }) {
    return request<AdminUserProfile>("/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  setTier(id: string, tier: "trial" | "production", reason?: string) {
    return request<AdminUserProfile>(`/users/${id}/tier`, {
      method: "POST",
      body: JSON.stringify({ tier, reason }),
    });
  },
};

/** UI tier <-> DB origin mapping helpers. */
export function originToTier(origin: string): "trial" | "production" {
  return origin === "trial" ? "trial" : "production";
}
export const TIER_LABEL_HE: Record<string, string> = {
  trial: "ניסיון",
  production: "תשלום",
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export interface AuditEntry {
  id: string;
  actor_admin_id: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  status: string;
  reason: string | null;
  before_json: string | null;
  after_json: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditListResponse {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export const auditApi = {
  list(q: { search?: string; action?: string; status?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (q.search) params.set("search", q.search);
    if (q.action) params.set("action", q.action);
    if (q.status) params.set("status", q.status);
    params.set("limit", String(q.limit ?? 100));
    params.set("offset", String(q.offset ?? 0));
    return request<AuditListResponse>(`/audit?${params.toString()}`);
  },
};

// ---------------------------------------------------------------------------
// Usage & analytics
// ---------------------------------------------------------------------------
export interface UsageMetrics {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  dormant_30d: number;
  total_conversations: number;
  total_messages: number;
  messages_7d: number;
  trial_users: number;
}

export interface TopUser {
  id: string;
  nickname: string;
  origin: string;
  conversation_count: number;
  last_active: string | null;
}

export interface UsageOverview {
  metrics: UsageMetrics;
  top_users: TopUser[];
  signups: { day: string; count: number }[];
}

export const usageApi = {
  overview() {
    return request<UsageOverview>("/usage/overview");
  },
};

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------
export interface CostsOverview {
  month_to_date_usd: number;
  today_usd: number;
  last_7d_usd: number;
  total_calls: number;
  by_model: { model: string; calls: number; total_tokens: number; cost_usd: number }[];
  by_action: { action: string; calls: number; cost_usd: number }[];
  top_users: { user_id: string; nickname: string | null; cost_usd: number; calls: number }[];
  daily: { day: string; cost_usd: number }[];
  tracking_active: boolean;
}

export const costsApi = {
  overview() {
    return request<CostsOverview>("/costs/overview");
  },
};

// ---------------------------------------------------------------------------
// Errors & failed processes
// ---------------------------------------------------------------------------
export interface ErrorEvent {
  id: string;
  severity: string;
  source: string;
  route: string | null;
  user_id: string | null;
  environment: string;
  message: string;
  stack_hash: string | null;
  created_at: string;
}

export interface ErrorsSummary {
  last_24h: number;
  last_7d: number;
  by_severity: Record<string, number>;
}

export const errorsApi = {
  summary() {
    return request<ErrorsSummary>("/errors/summary");
  },
  list(q: { severity?: string; search?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (q.severity) params.set("severity", q.severity);
    if (q.search) params.set("search", q.search);
    params.set("limit", String(q.limit ?? 100));
    params.set("offset", String(q.offset ?? 0));
    return request<{ items: ErrorEvent[]; total: number }>(`/errors?${params.toString()}`);
  },
};

// ---------------------------------------------------------------------------
// System health
// ---------------------------------------------------------------------------
export interface SystemHealth {
  status: "ok" | "warning" | "critical";
  environment: string;
  checks: Record<string, boolean>;
  queue: { queue_size?: number; inflight?: number; consecutive_failures?: number } | null;
  counts: Record<string, number>;
  errors: { last_24h: number; critical_total: number };
}

export const systemApi = {
  health() {
    return request<SystemHealth>("/system/health");
  },
};
