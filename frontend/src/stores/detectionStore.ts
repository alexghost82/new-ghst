/**
 * Object Tracking Engine — frontend store.
 *
 * Holds:
 *   - ``trackingEnabled`` per conversation (mirrors the backend column)
 *   - ``objects`` per conversation (the rows rendered in MemoryPanel)
 *   - ``batchStatus`` per conversation: pending/target counts, recent
 *     batches, and flushing flag for the "send now" button
 *   - in-flight scan flags so the engine loop doesn't double-submit
 *
 * The store is intentionally lean — heavy lifting (frame capture, dedup,
 * scan submission) lives in ``detectionEngine.ts``. The store just owns
 * state, REST sync, and the merge logic so new scan results stitch in
 * without duplicating ``id``s.
 */

import { create } from "zustand";
import type {
  DetectedObject,
  DetectionBatchStatus,
  DetectionDuplicateSuppressed,
  DetectionScanResult,
  DetectionScanStatus,
  DetectionSummary,
} from "../types/api";
import { api } from "../api/client";
import { sanitizeBrand } from "../utils/sanitize";

export type SubmitDetectionOutcome =
  | {
      status: "ok";
      detected: boolean;
      objects: DetectedObject[];
      fast_objects_created: number;
      pending_count: number;
      target_count: number;
      scan_status: DetectionScanResult["status"];
    }
  | {
      status: "skipped";
      reason: DetectionScanStatus;
      pending_count: number;
      target_count: number;
    }
  | { status: "error"; message: string };

type FlushOutcome =
  | { ok: true; persisted: number }
  | { ok: false; message: string };

interface DetectionState {
  trackingEnabled: Record<string, boolean>;
  objects: Record<string, DetectedObject[]>;
  summaries: Record<string, DetectionSummary>;
  batchStatus: Record<string, DetectionBatchStatus>;
  isLoading: Record<string, boolean>;
  scanning: Record<string, boolean>;
  flushing: Record<string, boolean>;
  // Latest scan status + pending-enrichment count per conversation — drive
  // the Pipeline Status panel ("watching / checking duplicate / added /
  // enriching ...") so the operator always sees what the engine is doing.
  lastScanStatus: Record<string, DetectionScanStatus>;
  pendingEnrichmentCount: Record<string, number>;
  error: string | null;

  setTrackingEnabledFromConversation: (
    conversationId: string,
    enabled: boolean,
  ) => void;
  toggleTracking: (
    conversationId: string,
    userId: string,
    enabled: boolean,
  ) => Promise<{ ok: boolean; errorMessage?: string }>;

  fetchObjects: (
    conversationId: string,
    userId: string,
  ) => Promise<void>;
  fetchBatchStatus: (
    conversationId: string,
    userId: string,
  ) => Promise<void>;
  setBatchSize: (
    conversationId: string,
    userId: string,
    target: number,
  ) => Promise<{ ok: boolean; errorMessage?: string; target?: number }>;
  flushBatchNow: (
    conversationId: string,
    userId: string,
  ) => Promise<FlushOutcome>;

  submitScan: (
    conversationId: string,
    userId: string,
    imageBase64: string,
    deviceId?: string,
    cameraLabel?: string,
    capturedAt?: string,
  ) => Promise<SubmitDetectionOutcome>;

  clearForConversation: (conversationId: string) => void;
  clearError: () => void;
}

const BATCH_TARGET_MAX = 88;
const BATCH_TARGET_MIN = 1;

function clampTarget(target: number): number {
  if (!Number.isFinite(target)) return BATCH_TARGET_MIN;
  return Math.min(BATCH_TARGET_MAX, Math.max(BATCH_TARGET_MIN, Math.round(target)));
}

function mergeObjects(
  prev: DetectedObject[],
  incoming: DetectedObject[],
): DetectedObject[] {
  if (incoming.length === 0) return prev;
  // Upsert by id: a Fast Path card is created first (pending_enrichment),
  // then the Vision pass returns the SAME id enriched. Later writes win, so
  // the enriched row replaces the placeholder in place instead of stacking
  // a duplicate card.
  const byId = new Map<string, DetectedObject>();
  for (const obj of prev) byId.set(obj.id, obj);
  for (const obj of incoming) byId.set(obj.id, obj);
  const merged = Array.from(byId.values());
  merged.sort((a, b) => (a.timestamp_utc < b.timestamp_utc ? 1 : -1));
  return merged;
}

function applySuppressions(
  prev: DetectedObject[],
  suppressions: DetectionDuplicateSuppressed[] | undefined,
): DetectedObject[] {
  if (!suppressions || suppressions.length === 0) return prev;
  const patch = new Map(suppressions.map((s) => [s.matched_object_id, s]));
  let changed = false;
  const next = prev.map((obj) => {
    const hit = patch.get(obj.id);
    if (!hit) return obj;
    changed = true;
    // A duplicate was suppressed onto this card — surface "seen again now"
    // instead of dropping the detection or spawning a new card.
    return {
      ...obj,
      seen_count: hit.seen_count,
      last_seen_at: hit.last_seen_at,
    };
  });
  return changed ? next : prev;
}

function patchBatchStatus(
  prev: DetectionBatchStatus | undefined,
  patch: Partial<DetectionBatchStatus>,
): DetectionBatchStatus {
  return {
    pending_count: patch.pending_count ?? prev?.pending_count ?? 0,
    target_count: patch.target_count ?? prev?.target_count ?? 8,
    max_target: patch.max_target ?? prev?.max_target ?? BATCH_TARGET_MAX,
    default_target: patch.default_target ?? prev?.default_target ?? 8,
    recent_batches: patch.recent_batches ?? prev?.recent_batches ?? [],
  };
}

export const useDetectionStore = create<DetectionState>((set, get) => ({
  trackingEnabled: {},
  objects: {},
  summaries: {},
  batchStatus: {},
  isLoading: {},
  scanning: {},
  flushing: {},
  lastScanStatus: {},
  pendingEnrichmentCount: {},
  error: null,

  setTrackingEnabledFromConversation: (conversationId, enabled) =>
    set((s) => ({
      trackingEnabled: { ...s.trackingEnabled, [conversationId]: enabled },
    })),

  toggleTracking: async (conversationId, userId, enabled) => {
    set((s) => ({
      trackingEnabled: { ...s.trackingEnabled, [conversationId]: enabled },
    }));
    const res = await api.setTrackingMode(conversationId, userId, enabled);
    if (!res.ok) {
      set((s) => ({
        trackingEnabled: {
          ...s.trackingEnabled,
          [conversationId]: !enabled,
        },
        error: sanitizeBrand(res.error?.message ?? "Failed to set tracking mode"),
      }));
      return {
        ok: false,
        errorMessage: res.error?.message ?? "Failed to set tracking mode",
      };
    }
    return { ok: true };
  },

  fetchObjects: async (conversationId, userId) => {
    set((s) => ({
      isLoading: { ...s.isLoading, [conversationId]: true },
      error: null,
    }));
    const res = await api.listDetectedObjects(conversationId, userId);
    if (res.ok && res.data) {
      const objects = Array.isArray(res.data.objects) ? res.data.objects : [];
      set((s) => ({
        objects: { ...s.objects, [conversationId]: objects },
        summaries: { ...s.summaries, [conversationId]: res.data!.summary ?? ({} as DetectionSummary) },
        isLoading: { ...s.isLoading, [conversationId]: false },
      }));
    } else {
      set((s) => ({
        isLoading: { ...s.isLoading, [conversationId]: false },
        error: sanitizeBrand(
          res.error?.message ?? "Failed to load detected objects",
        ),
      }));
    }
  },

  fetchBatchStatus: async (conversationId, userId) => {
    const res = await api.getDetectionBatchStatus(conversationId, userId);
    if (res.ok && res.data) {
      set((s) => ({
        batchStatus: {
          ...s.batchStatus,
          [conversationId]: res.data!,
        },
      }));
    }
  },

  setBatchSize: async (conversationId, userId, target) => {
    const clamped = clampTarget(target);
    const res = await api.setDetectionBatchTarget(
      conversationId,
      userId,
      clamped,
    );
    if (!res.ok || !res.data) {
      const msg = res.error?.message ?? "Failed to set batch size";
      set({ error: sanitizeBrand(msg) });
      return { ok: false, errorMessage: msg };
    }
    set((s) => ({
      batchStatus: {
        ...s.batchStatus,
        [conversationId]: patchBatchStatus(s.batchStatus[conversationId], {
          target_count: res.data!.target_count,
        }),
      },
    }));
    return { ok: true, target: res.data.target_count };
  },

  flushBatchNow: async (conversationId, userId) => {
    if (get().flushing[conversationId]) {
      return { ok: false, message: "already_flushing" };
    }
    set((s) => ({
      flushing: { ...s.flushing, [conversationId]: true },
    }));
    const res = await api.flushDetectionBatch(conversationId, userId);
    set((s) => ({
      flushing: { ...s.flushing, [conversationId]: false },
    }));

    if (!res.ok || !res.data) {
      const msg = res.error?.message ?? "Failed to flush batch";
      set({ error: sanitizeBrand(msg) });
      return { ok: false, message: msg };
    }

    const flush = res.data;
    const objects = flush.objects ?? [];
    if (objects.length > 0) {
      set((s) => ({
        objects: {
          ...s.objects,
          [conversationId]: mergeObjects(
            s.objects[conversationId] ?? [],
            objects,
          ),
        },
      }));
    }
    // After a flush the queue should be empty — refresh status so the UI
    // reflects 0 / target instantly without waiting for the next scan.
    await get().fetchBatchStatus(conversationId, userId);

    if (flush.status === "failed" && flush.error) {
      set({ error: sanitizeBrand(String(flush.error)) });
      return { ok: false, message: String(flush.error) };
    }
    if (flush.status === "empty") {
      return { ok: true, persisted: 0 };
    }
    return { ok: true, persisted: objects.length };
  },

  submitScan: async (
    conversationId,
    userId,
    imageBase64,
    deviceId,
    cameraLabel,
    capturedAt,
  ) => {
    if (get().scanning[conversationId]) {
      const status = get().batchStatus[conversationId];
      return {
        status: "skipped",
        reason: "duplicate",
        pending_count: status?.pending_count ?? 0,
        target_count: status?.target_count ?? 8,
      };
    }
    set((s) => ({
      scanning: { ...s.scanning, [conversationId]: true },
    }));

    const res = await api.scanDetectionFrame(
      conversationId,
      userId,
      imageBase64,
      deviceId,
      cameraLabel,
      capturedAt,
    );

    set((s) => ({
      scanning: { ...s.scanning, [conversationId]: false },
    }));

    if (!res.ok || !res.data) {
      const msg = res.error?.message ?? "Detection scan failed";
      set({ error: sanitizeBrand(msg) });
      return { status: "error", message: msg };
    }

    const result: DetectionScanResult = res.data;
    const pending = result.pending_count ?? 0;
    const target = result.target_count ?? 8;

    // Fast Path cards (immediate) + enrichment rows (from an auto-flush)
    // are merged the same way: upsert by id. Fast first so a same-scan
    // enrichment overrides the placeholder. Duplicate suppressions patch
    // the existing card's "seen again" counters. All of this happens
    // regardless of the terminal status below.
    const fastObjects = result.fast_objects_created ?? [];
    const enrichedObjects = result.objects ?? [];
    const incoming = [...fastObjects, ...enrichedObjects];
    const suppressions = result.duplicates_suppressed ?? [];

    set((s) => {
      const prevObjects = s.objects[conversationId] ?? [];
      const afterSuppress = applySuppressions(prevObjects, suppressions);
      const nextObjects =
        incoming.length > 0
          ? mergeObjects(afterSuppress, incoming)
          : afterSuppress;
      return {
        objects:
          nextObjects === prevObjects
            ? s.objects
            : { ...s.objects, [conversationId]: nextObjects },
        batchStatus: {
          ...s.batchStatus,
          [conversationId]: patchBatchStatus(s.batchStatus[conversationId], {
            pending_count: pending,
            target_count: target,
          }),
        },
        lastScanStatus: {
          ...s.lastScanStatus,
          [conversationId]: result.status,
        },
        pendingEnrichmentCount: {
          ...s.pendingEnrichmentCount,
          [conversationId]:
            result.pending_enrichment_count ??
            s.pendingEnrichmentCount[conversationId] ??
            0,
        },
      };
    });

    if (result.status === "error") {
      const msg = result.message ?? "Detection scan failed";
      set({ error: sanitizeBrand(msg) });
      return { status: "error", message: msg };
    }

    if (
      result.status === "no_motion" ||
      result.status === "no_objects" ||
      result.status === "duplicate" ||
      result.status === "queued" ||
      result.status === "paused_for_alert"
    ) {
      return {
        status: "skipped",
        reason: result.status,
        pending_count: pending,
        target_count: target,
      };
    }

    return {
      status: "ok",
      detected: incoming.length > 0,
      objects: incoming,
      fast_objects_created: fastObjects.length,
      pending_count: pending,
      target_count: target,
      scan_status: result.status,
    };
  },

  clearForConversation: (conversationId) =>
    set((s) => {
      const objects = { ...s.objects };
      const summaries = { ...s.summaries };
      const trackingEnabled = { ...s.trackingEnabled };
      const scanning = { ...s.scanning };
      const isLoading = { ...s.isLoading };
      const batchStatus = { ...s.batchStatus };
      const flushing = { ...s.flushing };
      const lastScanStatus = { ...s.lastScanStatus };
      const pendingEnrichmentCount = { ...s.pendingEnrichmentCount };
      delete objects[conversationId];
      delete summaries[conversationId];
      delete trackingEnabled[conversationId];
      delete scanning[conversationId];
      delete isLoading[conversationId];
      delete batchStatus[conversationId];
      delete flushing[conversationId];
      delete lastScanStatus[conversationId];
      delete pendingEnrichmentCount[conversationId];
      return {
        objects,
        summaries,
        trackingEnabled,
        scanning,
        isLoading,
        batchStatus,
        flushing,
        lastScanStatus,
        pendingEnrichmentCount,
      };
    }),

  clearError: () => set({ error: null }),
}));
