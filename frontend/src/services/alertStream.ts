/**
 * Server-Sent Events consumer for the alert push channel.
 *
 * Opens a single ``EventSource`` per active user and forwards every alert
 * event into the alert store so the overlay can be shown the moment the
 * backend creates the event — no more waiting for the HTTP scan POST to
 * round-trip back through ``submitScan``.
 *
 * The stream auto-reconnects with exponential backoff on transient errors.
 * Calling :func:`startAlertStream` is idempotent per ``userId``; calling it
 * with a *different* ``userId`` cleanly switches over to the new one.
 */

import type { IncidentEventStreamPayload } from "../types/api";
import { useAlertStore } from "../stores/alertStore";
import { useAlertRuntimeStore } from "../stores/alertRuntimeStore";
import { useIncidentStore } from "../stores/incidentStore";
import { useTaskStore } from "../stores/taskStore";
import { useConversationActivityStore } from "../stores/conversationActivityStore";

const RECONNECT_INITIAL_MS = 500;
const RECONNECT_MAX_MS = 5000;

let activeUserId: string | null = null;
let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = RECONNECT_INITIAL_MS;
let manuallyStopped = false;

function clearReconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSource(): void {
  if (source) {
    try {
      source.close();
    } catch {
      // ignore
    }
    source = null;
  }
}

function scheduleReconnect(userId: string): void {
  clearReconnect();
  if (manuallyStopped || activeUserId !== userId) return;
  const delay = backoffMs;
  backoffMs = Math.min(backoffMs * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (manuallyStopped || activeUserId !== userId) return;
    openStream(userId);
  }, delay);
}

function openStream(userId: string): void {
  closeSource();
  const url = `/api/users/${encodeURIComponent(userId)}/alerts/stream`;
  const es = new EventSource(url);
  source = es;

  es.onopen = () => {
    backoffMs = RECONNECT_INITIAL_MS;
    useAlertRuntimeStore.getState().setSseConnected(true);
  };

  es.onmessage = (ev) => {
    if (!ev.data || typeof ev.data !== "string") return;
    try {
      const parsed = JSON.parse(ev.data) as IncidentEventStreamPayload;
      if (!parsed || typeof parsed !== "object") return;
      switch (parsed.type) {
        case "alert_event":
          if (parsed.event) {
            useAlertStore.getState()._receivePushedEvent({
              event: parsed.event,
              conversation_id: parsed.conversation_id,
              conversation_title_hint: parsed.conversation_title_hint,
            });
            if (parsed.conversation_id) {
              useConversationActivityStore
                .getState()
                .markActivity(parsed.conversation_id, "alert");
            }
          }
          break;
        case "task_report":
          if (parsed.report) {
            useTaskStore.getState()._receiveTaskReport({
              report: parsed.report,
              conversation_id: parsed.conversation_id,
            });
          }
          break;
        case "incident_event":
          if (parsed.incident) {
            useIncidentStore.getState()._receiveCreated(parsed.incident);
          }
          break;
        case "incident_update":
          if (parsed.incident_id) {
            useIncidentStore
              .getState()
              ._receiveUpdate(parsed.incident_id, parsed.patch || {});
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.warn("[alertStream] failed to parse SSE payload:", err);
    }
  };

  es.onerror = () => {
    // EventSource fires onerror on the first failed connect and on every
    // dropped connection. Native auto-reconnect can be flaky behind dev
    // proxies, so we close + reopen with our own backoff schedule.
    useAlertRuntimeStore.getState().setSseConnected(false);
    closeSource();
    scheduleReconnect(userId);
  };
}

/** Start (or restart) the alert push stream for ``userId``. */
export function startAlertStream(userId: string): void {
  if (!userId) return;
  if (activeUserId === userId && source) return;
  manuallyStopped = false;
  activeUserId = userId;
  backoffMs = RECONNECT_INITIAL_MS;
  clearReconnect();
  openStream(userId);
}

/** Stop the active stream (if any). Idempotent. */
export function stopAlertStream(): void {
  manuallyStopped = true;
  activeUserId = null;
  clearReconnect();
  closeSource();
  backoffMs = RECONNECT_INITIAL_MS;
  useAlertRuntimeStore.getState().setSseConnected(false);
}

/** Test/diagnostic helper. */
export function getAlertStreamState(): {
  userId: string | null;
  connected: boolean;
} {
  return {
    userId: activeUserId,
    connected: source !== null && source.readyState === EventSource.OPEN,
  };
}
