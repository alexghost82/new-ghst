import { useEffect, useState } from "react";
import { X, Camera, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useLiveStore } from "../../stores/liveStore";
import { useMessageStore } from "../../stores/messageStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import type { ConversationGroup } from "../../utils/conversationGroups";

interface AddToGroupModalProps {
  group: ConversationGroup;
  areaName: string;
  onClose: () => void;
}

function deviceLabel(device: MediaDeviceInfo): string {
  return device.label || `Camera ${device.deviceId.slice(0, 8)}`;
}

export default function AddToGroupModal({
  group,
  areaName,
  onClose,
}: AddToGroupModalProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const { activeUserId } = useUserStore();
  const createConversation = useConversationStore((s) => s.createConversation);
  const assignConversation = useConversationGroupsStore(
    (s) => s.assignConversation,
  );
  const saveCameraSetup = useLiveStore((s) => s.saveCameraSetup);
  const enableLive = useLiveStore((s) => s.enableLive);
  const clearMessages = useMessageStore((s) => s.clearMessages);

  const [name, setName] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingDevices(true);
    setDeviceError(null);

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((tr) => tr.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((allDevices) => {
        if (cancelled) return;
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);
        if (videoDevices.length === 0) setDeviceError(t("noCamerasFound"));
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setDeviceError(
          err.name === "NotAllowedError"
            ? t("cameraAccessDenied")
            : t("cameraAccessFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDevices(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const toggleDevice = (deviceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const selectedCameras = devices.filter((d) => selected.has(d.deviceId));

  // Full descriptive sentence — used as the tooltip / accessible label.
  const actionLabel = (() => {
    const base =
      selectedCameras.length === 0
        ? t("createConversationInGroupAction")
        : selectedCameras.length === 1
          ? t("attachCameraToGroupAction").replace(
              "{camera}",
              deviceLabel(selectedCameras[0]),
            )
          : t("attachCamerasToGroupAction").replace(
              "{count}",
              String(selectedCameras.length),
            );
    return base.replace("{group}", group.name).replace("{area}", areaName);
  })();

  // Short verb label shown on the macOS-style default button.
  const primaryLabel =
    selectedCameras.length === 0
      ? t("createConversationShort")
      : t("createAndAttach");

  const handleSubmit = async () => {
    if (!activeUserId || submitting) return;
    setSubmitting(true);
    setError(null);

    const title = name.trim() || group.name;
    const conv = await createConversation(activeUserId, title);
    if (!conv) {
      setSubmitting(false);
      setError(t("ghostRefusalMessage"));
      return;
    }

    assignConversation(conv.id, { areaId: null, groupId: group.id });
    clearMessages();

    if (selectedCameras.length > 0) {
      const cams = selectedCameras.map((d, idx) => ({
        device_id: d.deviceId,
        label: deviceLabel(d),
        position: idx,
      }));
      await saveCameraSetup(conv.id, activeUserId, cams);
      enableLive(
        conv.id,
        cams.map((c) => ({ device_id: c.device_id, label: c.label })),
      );
    }

    setSubmitting(false);
    onClose();
  };

  const camerasReady = !loadingDevices && !deviceError && devices.length > 0;
  const contextLine = areaName ? `${group.name} · ${areaName}` : group.name;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={() => !submitting && onClose()}
      dir={dir}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-white/10 bg-ghost-surface/85 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_0_0_0.5px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.10),0_12px_40px_rgba(0,0,0,0.22),0_28px_70px_rgba(0,0,0,0.14)] animate-[splashIn_0.2s_cubic-bezier(0.25,0.46,0.45,0.94)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("addConversationToGroup")}
      >
        {/* ── Title bar ──────────────────────────────────────── */}
        <div className="relative px-5 pt-4 pb-3.5 border-b border-ghost-border-subtle/70">
          <button
            onClick={onClose}
            disabled={submitting}
            className="absolute top-3.5 end-4 w-6 h-6 -me-1 rounded-md flex items-center justify-center text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-150 disabled:opacity-50"
            aria-label={t("closePreview")}
          >
            <X size={15} strokeWidth={2} />
          </button>
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ghost-text-primary leading-tight pe-8">
            {t("addConversationToGroup")}
          </h3>
          <p className="mt-1 text-[12px] text-ghost-text-secondary truncate pe-8">
            {contextLine}
          </p>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="px-5 py-4 space-y-5">
          {/* Conversation name */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-ghost-text-secondary">
              {t("conversationNameLabel")}
            </label>
            <input
              value={name}
              autoFocus
              placeholder={t("conversationNamePlaceholderGroup")}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              className="w-full bg-ghost-bg/70 border border-ghost-border-subtle rounded-lg px-3 py-2 text-[13px] text-ghost-text-primary placeholder:text-ghost-text-muted/60 transition-shadow duration-150 focus:outline-none focus:border-ghost-accent/70 focus:ring-2 focus:ring-ghost-accent/25"
            />
          </div>

          {/* Default cameras */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ps-0.5">
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-ghost-text-secondary">
                <Camera size={13} className="text-ghost-text-muted" strokeWidth={2} />
                {t("defaultCameras")}
              </label>
              {camerasReady && selected.size > 0 && (
                <span className="text-[11px] tabular-nums text-ghost-text-muted">
                  {selected.size}/{devices.length}
                </span>
              )}
            </div>

            <div className="rounded-[10px] border border-ghost-border-subtle bg-ghost-bg/50 overflow-hidden divide-y divide-ghost-border-subtle/70 max-h-56 overflow-y-auto">
              {loadingDevices && (
                <p className="text-[12px] text-ghost-text-muted text-center py-5">
                  {t("detectingCameras")}
                </p>
              )}
              {deviceError && (
                <p className="text-[12px] text-ghost-text-muted text-center py-5 px-4 leading-relaxed">
                  {deviceError}
                </p>
              )}
              {camerasReady &&
                devices.map((device) => {
                  const checked = selected.has(device.deviceId);
                  return (
                    <button
                      key={device.deviceId}
                      type="button"
                      onClick={() => toggleDevice(device.deviceId)}
                      className={`group/cam w-full flex items-center gap-2.5 px-3 py-2.5 text-start transition-colors duration-150 ${
                        checked
                          ? "bg-ghost-accent/10"
                          : "hover:bg-ghost-surface-hover/70"
                      }`}
                      aria-pressed={checked}
                    >
                      <span
                        className={`flex-shrink-0 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors duration-150 ${
                          checked
                            ? "bg-ghost-accent border-ghost-accent text-white"
                            : "border-ghost-border-subtle bg-ghost-surface/60 group-hover/cam:border-ghost-text-muted"
                        }`}
                        aria-hidden
                      >
                        {checked && <Check size={12} strokeWidth={3} />}
                      </span>
                      <span
                        className={`text-[13px] truncate ${
                          checked
                            ? "text-ghost-text-primary"
                            : "text-ghost-text-secondary"
                        }`}
                      >
                        {deviceLabel(device)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-ghost-error text-center">{error}</p>
          )}
        </div>

        {/* ── Footer (macOS sheet button row) ────────────────── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-ghost-border-subtle/70 bg-ghost-bg/30">
          <button
            onClick={onClose}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 h-[30px] px-3.5 rounded-md text-[13px] font-medium text-ghost-text-primary bg-ghost-surface border border-ghost-border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:bg-ghost-surface-hover transition-colors duration-150 disabled:opacity-50"
          >
            {t("cancel")}
            <Kbd>esc</Kbd>
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !activeUserId}
            className={`inline-flex items-center gap-1.5 h-[30px] px-3.5 rounded-md text-[13px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors duration-150 ${
              submitting || !activeUserId
                ? "bg-ghost-surface-hover text-ghost-text-muted cursor-not-allowed"
                : "bg-ghost-accent hover:bg-ghost-accent-hover text-white"
            }`}
            title={actionLabel}
            aria-label={actionLabel}
          >
            {submitting ? t("creatingConversation") : primaryLabel}
            {!submitting && <Kbd onAccent>⏎</Kbd>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Kbd({
  children,
  onAccent,
}: {
  children: React.ReactNode;
  onAccent?: boolean;
}) {
  return (
    <kbd
      className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded text-[10px] font-sans leading-none ${
        onAccent
          ? "bg-white/20 text-white/90"
          : "bg-ghost-text-muted/15 text-ghost-text-muted"
      }`}
      aria-hidden
    >
      {children}
    </kbd>
  );
}
