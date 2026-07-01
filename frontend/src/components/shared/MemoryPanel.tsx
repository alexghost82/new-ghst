import { useEffect, useMemo, useState } from "react";
import {
  X,
  Trash2,
  Brain,
  Eye,
  Camera,
  Car,
  User,
  Sparkles,
  Activity,
  Truck,
  Bike,
  PawPrint,
  Box,
  Search,
  Send,
} from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useUserStore } from "../../stores/userStore";
import { useDetectionStore } from "../../stores/detectionStore";
import { useLiveStore } from "../../stores/liveStore";
import { useVisionProviderStore, type VisionProvider } from "../../stores/visionProviderStore";
import { api } from "../../api/client";
import type { LocalVisionAnalyzeResult } from "../../api/client";
import type {
  DetectedObject,
  MemoryItem,
  VisualEntity,
  VisualEntityType,
  VisualObservation,
} from "../../types/api";
import { useT } from "../../utils/i18n";
import { confirmDialog, toast } from "../../stores/feedbackStore";
import { captureFrame } from "../../utils/cameraCapture";

interface MemoryPanelProps {
  onClose: () => void;
}

const typeBadgeColors: Record<MemoryItem["type"], string> = {
  fact: "bg-stone-500/20 text-stone-400",
  preference: "bg-amber-700/20 text-amber-600",
  instruction: "bg-yellow-700/20 text-yellow-600",
  entity: "bg-ghost-accent/20 text-ghost-accent",
};

const entityTypeColors: Record<VisualEntityType, string> = {
  person: "bg-ghost-accent/20 text-ghost-accent",
  vehicle: "bg-stone-500/20 text-stone-400",
  environment: "bg-amber-700/20 text-amber-600",
  object: "bg-yellow-700/20 text-yellow-600",
};

const entityTypeIcons: Record<
  VisualEntityType,
  typeof User
> = {
  person: User,
  vehicle: Car,
  environment: Sparkles,
  object: Eye,
};

const entityTypeOrder: VisualEntityType[] = [
  "person",
  "vehicle",
  "environment",
  "object",
];

type Tab = "tracking" | "observations" | "facts";

type TrackingFilter = "all" | "person" | "vehicle" | "other";

const detectedTypeIcons: Record<string, typeof User> = {
  person: User,
  vehicle: Car,
  truck: Truck,
  motorcycle: Bike,
  bicycle: Bike,
  animal: PawPrint,
  object: Box,
};

const detectedTypeColors: Record<string, string> = {
  person: "bg-ghost-accent/20 text-ghost-accent",
  vehicle: "bg-stone-500/20 text-stone-400",
  truck: "bg-stone-500/20 text-stone-400",
  motorcycle: "bg-stone-500/20 text-stone-400",
  bicycle: "bg-stone-500/20 text-stone-400",
  animal: "bg-amber-700/20 text-amber-600",
  object: "bg-yellow-700/20 text-yellow-600",
};

const VISION_PROVIDER_OPTIONS: { key: VisionProvider; label: string }[] = [
  { key: "openai", label: "OpenAI" },
  { key: "local_vlm", label: "Local VLM" },
  { key: "auto", label: "אוטו" },
];

async function framePathToBase64(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error("frame_fetch_failed");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("frame_read_failed"));
    reader.readAsDataURL(blob);
  });
}

function formatHHMM(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatHHMMSS(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

function attributeChips(
  attrs: Record<string, unknown> | null | undefined,
  entityType: VisualEntityType,
): string[] {
  if (!attrs) return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.filter(Boolean).forEach((x) => {
        const s = String(x).trim();
        if (s && !out.includes(s)) out.push(s);
      });
    } else {
      const s = String(v).trim();
      if (s && !out.includes(s)) out.push(s);
    }
  };
  if (entityType === "person") {
    push(attrs.clothing);
    push(attrs.facial_hair);
    push(attrs.colors);
  } else if (entityType === "vehicle") {
    push(attrs.vehicle_color);
    push(attrs.vehicle_type);
  } else if (entityType === "environment") {
    push(attrs.environmental_details);
  } else {
    push(attrs.objects_held);
  }
  return out.slice(0, 4);
}

const EMPTY_OBJECTS: DetectedObject[] = [];

export default function MemoryPanel({ onClose }: MemoryPanelProps) {
  const { activeConversationId } = useConversationStore();
  const { activeUserId } = useUserStore();
  const t = useT();

  const [tab, setTab] = useState<Tab>("tracking");

  const [items, setItems] = useState<MemoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [observations, setObservations] = useState<VisualObservation[]>([]);
  const [entities, setEntities] = useState<VisualEntity[]>([]);
  const [isLoadingVisual, setIsLoadingVisual] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);

  const [trackingFilter, setTrackingFilter] = useState<TrackingFilter>("all");
  const [trackingSearch, setTrackingSearch] = useState("");

  const trackingEnabled = useDetectionStore((s) =>
    activeConversationId ? !!s.trackingEnabled[activeConversationId] : false,
  );
  const detectedObjects = useDetectionStore((s) =>
    activeConversationId
      ? (s.objects[activeConversationId] ?? EMPTY_OBJECTS)
      : EMPTY_OBJECTS,
  );
  const batchStatus = useDetectionStore((s) =>
    activeConversationId ? s.batchStatus[activeConversationId] : undefined,
  );
  const lastScanStatus = useDetectionStore((s) =>
    activeConversationId ? s.lastScanStatus[activeConversationId] : undefined,
  );
  const pendingEnrichmentCount = useDetectionStore((s) =>
    activeConversationId
      ? (s.pendingEnrichmentCount[activeConversationId] ?? 0)
      : 0,
  );
  const isFlushing = useDetectionStore((s) =>
    activeConversationId ? !!s.flushing[activeConversationId] : false,
  );
  const fetchBatchStatus = useDetectionStore((s) => s.fetchBatchStatus);
  const setBatchSize = useDetectionStore((s) => s.setBatchSize);
  const flushBatchNow = useDetectionStore((s) => s.flushBatchNow);

  const [batchSizeDraft, setBatchSizeDraft] = useState<string>("");
  const [batchSizeError, setBatchSizeError] = useState<string | null>(null);

  const [visionAnalyzing, setVisionAnalyzing] = useState(false);
  const [visionResult, setVisionResult] = useState<LocalVisionAnalyzeResult | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [visionNoFrame, setVisionNoFrame] = useState(false);

  const isLoadingTracking = useDetectionStore((s) =>
    activeConversationId
      ? !!s.isLoading[activeConversationId]
      : false,
  );
  const trackingError = useDetectionStore((s) => s.error);

  const toggleTracking = useDetectionStore((s) => s.toggleTracking);
  const fetchDetected = useDetectionStore((s) => s.fetchObjects);
  const getActiveCameras = useLiveStore((s) => s.getActiveCameras);
  const visionProvider = useVisionProviderStore((s) => s.provider);
  const setVisionProvider = useVisionProviderStore((s) => s.setProvider);
  const hasCameraConfigured = useLiveStore((s) => {
    if (!activeConversationId) return false;
    if ((s.liveConversations[activeConversationId] ?? []).length > 0)
      return true;
    return (s.savedCameras[activeConversationId] ?? []).length > 0;
  });

  const filteredDetections = useMemo(() => {
    let filtered = detectedObjects;

    if (trackingFilter === "person") {
      filtered = filtered.filter((o) => (o.object_type || "").toLowerCase() === "person");
    } else if (trackingFilter === "vehicle") {
      filtered = filtered.filter((o) =>
        ["vehicle", "truck", "motorcycle", "bicycle"].includes((o.object_type || "").toLowerCase()),
      );
    } else if (trackingFilter === "other") {
      filtered = filtered.filter(
        (o) =>
          !["person", "vehicle", "truck", "motorcycle", "bicycle"].includes(
            (o.object_type || "").toLowerCase(),
          ),
      );
    }

    if (trackingSearch.trim()) {
      const q = trackingSearch.trim().toLowerCase();
      filtered = filtered.filter((o) => {
        const searchable = [
          o.deep_description,
          o.clothing_summary,
          o.activity_description,
          o.color_primary,
          o.color_secondary,
          o.manufacturer,
          o.model_name,
          o.license_plate_partial,
          o.vehicle_type,
          o.gender_estimation,
          o.age_range,
          ...(o.distinctive_identifiers ?? []),
          ...(o.carried_items ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });
    }

    return filtered;
  }, [detectedObjects, trackingFilter, trackingSearch]);

  useEffect(() => {
    if (!activeConversationId || !activeUserId) return;
    setIsLoadingItems(true);
    setItemsError(null);
    api.getMemoryItems(activeConversationId, activeUserId).then((res) => {
      if (res.ok && res.data) {
        setItems(Array.isArray(res.data) ? res.data : []);
      } else {
        setItemsError(res.error?.message ?? t("failedLoadMemories"));
      }
      setIsLoadingItems(false);
    });
  }, [activeConversationId, activeUserId]);

  useEffect(() => {
    if (!activeConversationId || !activeUserId) {
      setObservations([]);
      setEntities([]);
      return;
    }
    setIsLoadingVisual(true);
    setVisualError(null);
    api.getVisualMemory(activeConversationId, activeUserId).then((res) => {
      if (res.ok && res.data) {
        setObservations(Array.isArray(res.data.observations) ? res.data.observations : []);
        setEntities(Array.isArray(res.data.entities) ? res.data.entities : []);
      } else {
        setVisualError(res.error?.message ?? t("failedLoadObservations"));
      }
      setIsLoadingVisual(false);
    });
  }, [activeConversationId, activeUserId, tab]);

  useEffect(() => {
    if (!activeConversationId || !activeUserId) return;
    if (tab !== "tracking") return;
    void fetchDetected(activeConversationId, activeUserId);
    void fetchBatchStatus(activeConversationId, activeUserId);
  }, [activeConversationId, activeUserId, tab, fetchDetected, fetchBatchStatus]);

  useEffect(() => {
    if (!activeConversationId || !activeUserId) return;
    if (tab !== "tracking") return;
    if (!trackingEnabled) return;
    const handle = setInterval(() => {
      void fetchBatchStatus(activeConversationId, activeUserId);
    }, 2500);
    return () => clearInterval(handle);
  }, [
    activeConversationId,
    activeUserId,
    tab,
    trackingEnabled,
    fetchBatchStatus,
  ]);

  useEffect(() => {
    if (batchStatus) {
      setBatchSizeDraft(String(batchStatus.target_count));
    }
  }, [batchStatus?.target_count]);

  const handleBatchSizeCommit = async () => {
    if (!activeConversationId || !activeUserId) return;
    const parsed = parseInt(batchSizeDraft, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 88) {
      setBatchSizeError(t("batchTargetInvalid"));
      return;
    }
    setBatchSizeError(null);
    const res = await setBatchSize(activeConversationId, activeUserId, parsed);
    if (!res.ok) {
      setBatchSizeError(res.errorMessage ?? t("batchFlushFailed"));
    }
  };

  const handleSendNow = async () => {
    if (!activeConversationId || !activeUserId) return;
    if (isFlushing) return;
    if ((batchStatus?.pending_count ?? 0) <= 0) return;
    setBatchSizeError(null);
    const res = await flushBatchNow(activeConversationId, activeUserId);
    if (!res.ok) {
      setBatchSizeError(res.message ?? t("batchFlushFailed"));
    }
  };

  const handleDelete = async (memoryId: string) => {
    if (!activeConversationId) return;
    const ok = await confirmDialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteGeneric"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    const prevItems = items;
    setItems((prev) => prev.filter((m) => m.id !== memoryId));
    const res = await api.deleteMemoryItem(activeConversationId, memoryId);
    if (!res.ok) {
      setItems(prevItems);
      setItemsError(t("failedDeleteMemory"));
      toast.error(t("actionDeleteFailed"));
      return;
    }
    toast.success(t("actionDeleted"));
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const entityById = useMemo(() => {
    const map = new Map<string, VisualEntity>();
    entities.forEach((e) => map.set(e.id, e));
    return map;
  }, [entities]);

  const observationsByType = useMemo(() => {
    const grouped: Record<VisualEntityType, VisualObservation[]> = {
      person: [],
      vehicle: [],
      environment: [],
      object: [],
    };
    observations.forEach((obs) => {
      if (entityTypeOrder.includes(obs.entity_type)) {
        grouped[obs.entity_type].push(obs);
      }
    });
    return grouped;
  }, [observations]);

  const handleToggleTracking = async () => {
    if (!activeConversationId || !activeUserId) return;
    await toggleTracking(
      activeConversationId,
      activeUserId,
      !trackingEnabled,
    );
  };

  const resolveAnalyzeFrame = async (): Promise<{
    imageBase64: string;
    cameraId?: string;
  } | null> => {
    if (!activeConversationId) return null;

    const cameras = getActiveCameras(activeConversationId);
    if (cameras.length > 0) {
      try {
        const imageBase64 = await captureFrame(cameras[0].device_id);
        return { imageBase64, cameraId: cameras[0].device_id };
      } catch {
        // Fall through to detection frame thumbnail.
      }
    }

    const latestWithFrame = detectedObjects.find(
      (o) => o.frame_path && o.frame_path.startsWith("/api/"),
    );
    if (latestWithFrame?.frame_path) {
      try {
        const imageBase64 = await framePathToBase64(latestWithFrame.frame_path);
        return { imageBase64 };
      } catch {
        return null;
      }
    }

    return null;
  };

  const handleAnalyzeFrame = async () => {
    if (!activeUserId || visionAnalyzing) return;
    setVisionError(null);
    setVisionNoFrame(false);
    setVisionResult(null);

    const frame = await resolveAnalyzeFrame();
    if (!frame) {
      setVisionNoFrame(true);
      return;
    }

    setVisionAnalyzing(true);
    const res = await api.analyzeLocalVision({
      user_id: activeUserId,
      image_base64: frame.imageBase64,
      conversation_id: activeConversationId ?? undefined,
      camera_id: frame.cameraId,
      provider: visionProvider,
    });
    setVisionAnalyzing(false);

    if (!res.ok || !res.data) {
      setVisionError(res.error?.message ?? "ניתוח הפריים נכשל");
      return;
    }
    setVisionResult(res.data);
  };

  const renderTrackingTab = () => {
    const trackingDisabled = !hasCameraConfigured;

    // Pipeline Status — always tell the operator what the engine is doing
    // right now, instead of only the "N / target" batch counter.
    const pipeline: { label: string; tone: "muted" | "active" | "ok" | "alert" } =
      (() => {
        if (!trackingEnabled) return { label: t("pipelineOff"), tone: "muted" };
        if (!hasCameraConfigured)
          return { label: t("pipelineNeedsCamera"), tone: "muted" };
        switch (lastScanStatus) {
          case "paused_for_alert":
            return { label: t("pipelinePausedAlert"), tone: "alert" };
          case "error":
            return { label: t("pipelineError"), tone: "alert" };
          case "queued":
            return { label: t("pipelineDetecting"), tone: "active" };
          case "duplicate":
            return { label: t("pipelineCheckingDup"), tone: "active" };
          case "fast_objects_created":
            return { label: t("pipelineAdded"), tone: "ok" };
          case "batch_sent":
          case "batch_ready":
            return { label: t("pipelineEnriching"), tone: "active" };
          default:
            if (pendingEnrichmentCount > 0)
              return { label: t("pipelineEnriching"), tone: "active" };
            return { label: t("pipelineWatching"), tone: "active" };
        }
      })();
    const pipelineDotClass =
      pipeline.tone === "ok"
        ? "bg-ghost-success"
        : pipeline.tone === "alert"
          ? "bg-ghost-error"
          : pipeline.tone === "active"
            ? "bg-ghost-text-secondary animate-pulse"
            : "bg-ghost-text-muted";

    const renderCompactRow = (obj: DetectedObject) => {
      const typeKey = (obj.object_type || "object").toLowerCase();
      const Icon = detectedTypeIcons[typeKey] ?? Box;
      const badgeColor =
        detectedTypeColors[typeKey] ?? "bg-stone-500/20 text-stone-400";
      const typeLabel =
        typeKey === "person"
          ? t("person")
          : typeKey === "vehicle"
            ? t("vehicle")
            : typeKey === "truck"
              ? t("truck")
              : typeKey === "motorcycle"
                ? t("motorcycle")
                : typeKey === "bicycle"
                  ? t("bicycle")
                  : typeKey === "animal"
                    ? t("animal")
                    : t("objectGeneric");

      const mainLine = (() => {
        if (typeKey === "person") {
          const gender = obj.gender_estimation
            ? obj.gender_estimation.toLowerCase().includes("female")
              ? t("female")
              : obj.gender_estimation.toLowerCase().includes("male")
                ? t("male")
                : obj.gender_estimation
            : "";
          const age = obj.age_range || "";
          const clothing = obj.clothing_summary || obj.color_primary || "";
          return [gender, age, clothing].filter(Boolean).join(" · ");
        }
        const parts = [
          obj.color_primary,
          obj.vehicle_type ?? obj.object_type,
          obj.manufacturer,
          obj.model_name,
        ].filter(Boolean);
        return parts.join(" · ") || "—";
      })();

      const thumbSrc =
        obj.frame_path && obj.frame_path.startsWith("/api/")
          ? obj.frame_path
          : null;

      return (
        <div
          key={obj.id}
          className="bg-ghost-surface rounded-md p-2 border border-ghost-border-subtle hover:border-ghost-surface-hover transition-colors duration-75"
        >
          <div className="flex gap-2">
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt={typeLabel}
                loading="lazy"
                className="w-14 h-14 flex-shrink-0 rounded border border-ghost-border-subtle bg-ghost-bg-secondary object-cover"
              />
            ) : (
              <div className="w-14 h-14 flex-shrink-0 rounded border border-ghost-border-subtle bg-ghost-bg-secondary flex items-center justify-center text-ghost-text-muted">
                <Icon size={18} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5 ${badgeColor}`}
                >
                  <Icon size={10} />
                  {typeLabel}
                </span>
                {obj.enrichment_status === "pending_enrichment" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 bg-ghost-surface-hover text-ghost-text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-ghost-text-muted animate-pulse" />
                    {t("enrichmentPending")}
                  </span>
                )}
                {obj.enrichment_status === "enrichment_failed" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center bg-ghost-error/15 text-ghost-error">
                    {t("enrichmentFailed")}
                  </span>
                )}
                {(obj.seen_count ?? 1) > 1 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center bg-ghost-surface-hover text-ghost-text-secondary">
                    {t("seenAgain")}
                  </span>
                )}
                <span className="text-[10px] text-ghost-text-muted flex-1 text-end">
                  {formatHHMMSS(obj.timestamp_utc)}
                </span>
                {obj.camera_label && (
                  <span className="text-[10px] text-ghost-text-muted inline-flex items-center gap-0.5">
                    <Camera size={9} />
                    {obj.camera_label}
                  </span>
                )}
              </div>

              <p className="text-xs text-ghost-text-secondary leading-snug mb-0.5 line-clamp-2">
                {mainLine}
              </p>

              {obj.deep_description &&
                obj.deep_description !== mainLine && (
                  <p className="text-[11px] text-ghost-text-secondary leading-snug mb-0.5 line-clamp-3">
                    {obj.deep_description}
                  </p>
                )}

              {obj.activity_description && (
                <p className="text-[10px] text-ghost-text-muted leading-snug truncate">
                  {obj.activity_description}
                </p>
              )}

              {obj.license_plate_partial && (
                <span className="text-[10px] text-ghost-text-muted font-mono mt-0.5 inline-block">
                  {t("licensePlate")}: {obj.license_plate_partial}
                </span>
              )}

              {Array.isArray(obj.distinctive_identifiers) &&
                obj.distinctive_identifiers.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {obj.distinctive_identifiers.slice(0, 3).map((mark, idx) => (
                      <span
                        key={`${obj.id}-m-${idx}`}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ghost-surface-hover text-ghost-text-muted"
                      >
                        {mark}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-2">
        {/* Toggle header */}
        <div className="bg-ghost-surface rounded-lg p-2.5 border border-ghost-border-subtle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity
                size={13}
                className={
                  trackingEnabled
                    ? "text-ghost-accent"
                    : "text-ghost-text-muted"
                }
              />
              <span className="text-xs font-medium text-ghost-text-primary">
                {trackingEnabled ? t("trackingModeOn") : t("trackingModeOff")}
              </span>
              {detectedObjects.length > 0 && (
                <span className="text-[10px] text-ghost-text-muted">
                  ({detectedObjects.length} {t("items")})
                </span>
              )}
            </div>
            <button
              onClick={handleToggleTracking}
              disabled={trackingDisabled}
              aria-label={t("trackingToggle")}
              dir="ltr"
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-[160ms] ${
                trackingEnabled
                  ? "bg-ghost-accent"
                  : "bg-ghost-surface-hover"
              } ${trackingDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-[160ms] ${
                  trackingEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          {trackingDisabled && (
            <p className="text-[10px] text-ghost-text-muted mt-1">
              {t("trackingRequiresCamera")}
            </p>
          )}
        </div>

        {/* Pipeline status — what the engine is doing right now */}
        <div className="bg-ghost-surface rounded-lg p-2.5 border border-ghost-border-subtle">
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-ghost-text-muted block mb-1.5">
            {t("pipelineStatus")}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${pipelineDotClass}`}
            />
            <span className="text-[11px] text-ghost-text-secondary leading-snug">
              {pipeline.label}
            </span>
            {pendingEnrichmentCount > 0 && (
              <span className="text-[10px] text-ghost-text-muted ms-auto font-mono">
                {pendingEnrichmentCount}
              </span>
            )}
          </div>
        </div>

        {/* Vision provider — manual frame analyze */}
        <div className="bg-ghost-surface rounded-lg p-2.5 border border-ghost-border-subtle space-y-2">
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-ghost-text-muted block">
            ספק ניתוח חזותי
          </span>
          <div className="flex gap-1 flex-wrap">
            {VISION_PROVIDER_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setVisionProvider(key)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors duration-75 ${
                  visionProvider === key
                    ? "bg-ghost-accent/20 text-ghost-accent"
                    : "bg-ghost-surface-hover text-ghost-text-muted hover:text-ghost-text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleAnalyzeFrame()}
            disabled={visionAnalyzing || !activeUserId}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors duration-75 ${
              visionAnalyzing || !activeUserId
                ? "bg-ghost-surface-hover text-ghost-text-muted cursor-not-allowed"
                : "bg-ghost-accent text-white hover:bg-ghost-accent/90"
            }`}
          >
            <Eye size={12} />
            {visionAnalyzing ? "מנתח פריים..." : "נתח פריים עם הספק הנבחר"}
          </button>
          {visionNoFrame && (
            <p className="text-[10px] text-ghost-text-muted leading-snug">
              אין פריים זמין — הפעל מצלמה חיה או המתן לסריקת מעקב.
            </p>
          )}
          {visionError && (
            <p className="text-[10px] text-ghost-error leading-snug">{visionError}</p>
          )}
          {visionResult && (
            <div className="rounded border border-ghost-border-subtle bg-ghost-bg-secondary p-2 space-y-1">
              <p className="text-[10px] text-ghost-text-muted font-mono">
                {visionResult.provider} · {visionResult.model}
              </p>
              {(visionResult.text ?? visionResult.analysis ?? visionResult.content) && (
                <p className="text-[11px] text-ghost-text-secondary leading-snug line-clamp-4">
                  {visionResult.text ?? visionResult.analysis ?? visionResult.content}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Batch progress + controls */}
        {!trackingDisabled && (
          <div className="bg-ghost-surface rounded-lg p-2.5 border border-ghost-border-subtle space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-ghost-text-secondary">
                {t("batchCollected")}
              </span>
              <span className="text-xs font-mono text-ghost-text-primary">
                {batchStatus?.pending_count ?? 0} / {batchStatus?.target_count ?? "—"}
              </span>
            </div>
            <div className="h-1 w-full bg-ghost-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-ghost-accent transition-all duration-200"
                style={{
                  width: `${
                    batchStatus && batchStatus.target_count > 0
                      ? Math.min(
                          100,
                          (batchStatus.pending_count /
                            batchStatus.target_count) *
                            100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex-1 min-w-0">
                <span className="text-[10px] text-ghost-text-muted block mb-0.5">
                  {t("batchSize")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={88}
                  step={1}
                  value={batchSizeDraft}
                  onChange={(e) => setBatchSizeDraft(e.target.value)}
                  onBlur={handleBatchSizeCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full bg-ghost-bg-secondary border border-ghost-border-subtle rounded px-2 py-1 text-xs text-ghost-text-primary focus:outline-none focus:border-ghost-accent/50 font-mono"
                  aria-label={t("batchSize")}
                />
              </label>
              <button
                onClick={handleSendNow}
                disabled={
                  isFlushing ||
                  (batchStatus?.pending_count ?? 0) <= 0
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors duration-75 ${
                  isFlushing || (batchStatus?.pending_count ?? 0) <= 0
                    ? "bg-ghost-surface-hover text-ghost-text-muted cursor-not-allowed"
                    : "bg-ghost-accent text-white hover:bg-ghost-accent/90"
                }`}
                aria-label={t("batchSendNow")}
              >
                <Send size={11} />
                {isFlushing ? t("batchSending") : t("batchSendNow")}
              </button>
            </div>
            <p className="text-[10px] text-ghost-text-muted leading-snug">
              {(batchStatus?.pending_count ?? 0) === 0
                ? t("batchEmpty")
                : t("batchAuto").replace(
                    "{target}",
                    String(batchStatus?.target_count ?? 8),
                  )}
            </p>
            {batchSizeError && (
              <p className="text-[10px] text-ghost-error">{batchSizeError}</p>
            )}
          </div>
        )}

        {/* Search & filters */}
        {detectedObjects.length > 0 && (
          <div className="space-y-1.5">
            <div className="relative">
              <Search
                size={12}
                className="absolute start-2 top-1/2 -translate-y-1/2 text-ghost-text-muted"
              />
              <input
                type="text"
                value={trackingSearch}
                onChange={(e) => setTrackingSearch(e.target.value)}
                placeholder={t("trackingSearchPlaceholder")}
                className="w-full bg-ghost-surface border border-ghost-border-subtle rounded-md ps-7 pe-2 py-1.5 text-xs text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent/50"
              />
            </div>
            <div className="flex gap-1">
              {(
                [
                  ["all", t("trackingFilterAll")],
                  ["person", t("trackingFilterPeople")],
                  ["vehicle", t("trackingFilterVehicles")],
                  ["other", t("trackingFilterOther")],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTrackingFilter(key)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors duration-75 ${
                    trackingFilter === key
                      ? "bg-ghost-accent/20 text-ghost-accent"
                      : "bg-ghost-surface text-ghost-text-muted hover:text-ghost-text-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoadingTracking && detectedObjects.length === 0 && (
          <p className="text-ghost-text-muted text-xs text-center py-6">
            {t("loadingDetectedObjects")}
          </p>
        )}

        {trackingError && (
          <p className="text-ghost-error text-xs text-center py-2">
            {trackingError}
          </p>
        )}

        {!isLoadingTracking && detectedObjects.length === 0 && (
          <div className="text-center py-6">
            <Activity
              size={24}
              className="text-ghost-text-muted mx-auto mb-2 opacity-50"
            />
            <p className="text-ghost-text-muted text-xs px-4">
              {t("noDetectedObjects")}
            </p>
          </div>
        )}

        {detectedObjects.length > 0 && filteredDetections.length === 0 && (
          <p className="text-ghost-text-muted text-xs text-center py-4">
            {t("trackingNoResults")}
          </p>
        )}

        {filteredDetections.length > 0 && (
          <div className="space-y-1">
            {filteredDetections.map(renderCompactRow)}
          </div>
        )}
      </div>
    );
  };

  const renderObservationsTab = () => {
    if (isLoadingVisual) {
      return (
        <p className="text-ghost-text-muted text-small text-center py-8">
          {t("loadingObservations")}
        </p>
      );
    }
    if (visualError) {
      return (
        <p className="text-ghost-error text-small text-center py-8">
          {visualError}
        </p>
      );
    }
    if (observations.length === 0) {
      return (
        <div className="text-center py-12">
          <Eye
            size={32}
            className="text-ghost-text-muted mx-auto mb-3 opacity-50"
          />
          <p className="text-ghost-text-muted text-small">
            {t("noObservations")}
          </p>
          <p className="text-ghost-text-muted text-xs mt-1">
            {t("observationsAutoExtracted")}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {entityTypeOrder.map((type) => {
          const list = observationsByType[type];
          if (!list || list.length === 0) return null;
          const Icon = entityTypeIcons[type];
          const label =
            type === "person"
              ? t("people")
              : type === "vehicle"
                ? t("vehicles")
                : type === "environment"
                  ? t("environment")
                  : t("objects");
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-ghost-text-secondary" />
                <h3 className="text-small font-medium text-ghost-text-secondary">
                  {label}
                </h3>
                <span className="text-xs text-ghost-text-muted">
                  ({list.length})
                </span>
              </div>
              <div className="space-y-2">
                {list.map((obs) => {
                  const chips = attributeChips(obs.visual_attributes, type);
                  const ent = obs.entity_id
                    ? entityById.get(obs.entity_id)
                    : null;
                  const cameraDisplay = obs.camera_label ?? t("primaryCam");
                  const hhmm = formatHHMM(obs.observed_at);
                  return (
                    <div
                      key={obs.id}
                      className="bg-ghost-surface rounded-lg p-3 border border-ghost-border-subtle"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${entityTypeColors[type]}`}
                        >
                          {label}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-ghost-text-muted">
                          {hhmm && <span>{hhmm}</span>}
                          <span className="inline-flex items-center gap-1">
                            <Camera size={11} />
                            {cameraDisplay}
                          </span>
                        </div>
                      </div>
                      <p className="text-small text-ghost-text-secondary leading-relaxed mb-1.5">
                        {obs.description}
                      </p>
                      {chips.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {chips.map((chip) => (
                            <span
                              key={chip}
                              className="text-xs px-2 py-0.5 rounded bg-ghost-surface-hover text-ghost-text-muted"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}
                      {ent &&
                        ((ent.times_seen ?? 0) > 1 || (ent.cameras_seen?.length ?? 0) > 1) && (
                          <div className="mt-2 pt-2 border-t border-ghost-border-subtle text-xs text-ghost-text-muted">
                            {t("timesSeen")}: {ent.times_seen ?? 0}
                            {Array.isArray(ent.cameras_seen) && ent.cameras_seen.length > 0 && (
                              <span className="ms-2">
                                · {t("seenInCameras")}:{" "}
                                {ent.cameras_seen.join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                      {obs.image_path && (
                        <img
                          src={obs.image_path}
                          alt={obs.description}
                          className="mt-2 rounded border border-ghost-border-subtle max-h-28 object-cover"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFactsTab = () => {
    if (isLoadingItems) {
      return (
        <p className="text-ghost-text-muted text-small text-center py-8">
          {t("loadingMemories")}
        </p>
      );
    }
    if (itemsError) {
      return (
        <p className="text-ghost-error text-small text-center py-8">
          {itemsError}
        </p>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <Brain
            size={32}
            className="text-ghost-text-muted mx-auto mb-3 opacity-50"
          />
          <p className="text-ghost-text-muted text-small">{t("noMemories")}</p>
          <p className="text-ghost-text-muted text-xs mt-1">
            {t("memoriesAutoExtracted")}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="group bg-ghost-surface rounded-lg p-3 border border-ghost-border-subtle hover:border-ghost-surface-hover transition-colors duration-[100ms]"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColors[item.type]}`}
              >
                {item.type}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ghost-text-muted">
                  {((item.relevance_score ?? 0) * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-ghost-text-muted hover:text-ghost-error transition-all duration-[100ms]"
                  aria-label="Delete memory"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            <p className="text-small text-ghost-text-secondary leading-relaxed">
              {item.content}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <aside
      data-tour="memory-panel"
      className="w-panel flex-shrink-0 bg-ghost-bg-secondary border-s border-ghost-border-subtle h-screen flex flex-col slide-in-right"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ghost-border-subtle">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-ghost-accent" />
          <h2 className="text-title text-ghost-text-primary">{t("memory")}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          aria-label="Close memory panel"
        >
          <X size={16} />
        </button>
      </div>

      <div data-tour="memory-tabs" className="flex border-b border-ghost-border-subtle">
        <button
          onClick={() => setTab("tracking")}
          className={`flex-1 px-3 py-2 text-small transition-colors duration-[100ms] ${
            tab === "tracking"
              ? "text-ghost-text-primary border-b-2 border-ghost-accent"
              : "text-ghost-text-muted hover:text-ghost-text-secondary"
          }`}
        >
          {t("tracking")}
        </button>
        <button
          onClick={() => setTab("observations")}
          className={`flex-1 px-3 py-2 text-small transition-colors duration-[100ms] ${
            tab === "observations"
              ? "text-ghost-text-primary border-b-2 border-ghost-accent"
              : "text-ghost-text-muted hover:text-ghost-text-secondary"
          }`}
        >
          {t("observations")}
        </button>
        <button
          onClick={() => setTab("facts")}
          className={`flex-1 px-3 py-2 text-small transition-colors duration-[100ms] ${
            tab === "facts"
              ? "text-ghost-text-primary border-b-2 border-ghost-accent"
              : "text-ghost-text-muted hover:text-ghost-text-secondary"
          }`}
        >
          {t("facts")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === "tracking"
          ? renderTrackingTab()
          : tab === "observations"
            ? renderObservationsTab()
            : renderFactsTab()}
      </div>
    </aside>
  );
}
