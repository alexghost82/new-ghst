import { useEffect, useMemo, useState } from "react";
import { X, Camera, Check } from "lucide-react";
import { useLiveStore } from "../../stores/liveStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import type { ActiveCamera } from "../../stores/liveStore";

function deviceLabel(device: MediaDeviceInfo): string {
  return device.label || `Camera ${device.deviceId.slice(0, 8)}`;
}

export default function CameraSelector() {
  const {
    showCameraSelector,
    closeCameraSelector,
    enableLive,
    savedCameras,
    saveCameraSetup,
  } = useLiveStore();
  const { activeConversationId } = useConversationStore();
  const { activeUserId } = useUserStore();
  const t = useT();

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const persistedForActive = useMemo(
    () =>
      activeConversationId
        ? (savedCameras[activeConversationId] ?? [])
        : [],
    [savedCameras, activeConversationId],
  );

  useEffect(() => {
    if (!showCameraSelector) {
      setDevices([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

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
        if (videoDevices.length === 0) {
          setError(t("noCamerasFound"));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err.name === "NotAllowedError"
            ? t("cameraAccessDenied")
            : t("cameraAccessFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showCameraSelector]);

  useEffect(() => {
    if (!showCameraSelector) return;
    setSelected(new Set(persistedForActive.map((c) => c.device_id)));
  }, [showCameraSelector, persistedForActive]);

  if (!showCameraSelector) return null;

  const toggleDevice = (deviceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const buildActiveCameras = (): ActiveCamera[] => {
    const labelByDevice = new Map<string, string>();
    devices.forEach((d) => labelByDevice.set(d.deviceId, deviceLabel(d)));
    persistedForActive.forEach((c) => {
      if (!labelByDevice.has(c.device_id)) {
        labelByDevice.set(c.device_id, c.label);
      }
    });

    return Array.from(selected).map((device_id) => ({
      device_id,
      label: labelByDevice.get(device_id) ?? `Camera ${device_id.slice(0, 8)}`,
    }));
  };

  const handleEnable = () => {
    if (!activeConversationId) return;
    if (selected.size === 0) {
      setError(t("selectAtLeastOne"));
      return;
    }
    enableLive(activeConversationId, buildActiveCameras());
  };

  const handleSaveSetup = async () => {
    if (!activeConversationId || !activeUserId) return;
    if (selected.size === 0) {
      setError(t("selectAtLeastOne"));
      return;
    }
    setSaving(true);
    setError(null);
    const cams = buildActiveCameras().map((c, idx) => ({
      device_id: c.device_id,
      label: c.label,
      position: idx,
    }));
    const result = await saveCameraSetup(
      activeConversationId,
      activeUserId,
      cams,
    );
    setSaving(false);
    if (result) {
      setSavedFlash(true);
      enableLive(activeConversationId, buildActiveCameras());
      window.setTimeout(() => setSavedFlash(false), 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden fade-in">
        {/* Ambient wash — the only "color", clipped by the modal */}
        <div className="ghost-ambient" aria-hidden>
          <div
            className="ghost-ambient__blob ghost-ambient__blob--1"
            style={{
              top: -120,
              left: "-12%",
              width: 280,
              height: 280,
              background:
                "radial-gradient(circle, rgb(96 116 132 / 0.5), transparent 70%)",
            }}
          />
          <div
            className="ghost-ambient__blob ghost-ambient__blob--3"
            style={{
              bottom: -140,
              right: "-12%",
              width: 300,
              height: 300,
              background:
                "radial-gradient(circle, rgb(104 116 78 / 0.45), transparent 72%)",
            }}
          />
        </div>

        {/* Header — mono eyebrow + title */}
        <div className="relative z-10 flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-ghost-border-subtle">
          <div className="min-w-0">
            <span className="block font-mono text-[10px] tracking-[0.24em] uppercase text-ghost-text-muted mb-2">
              Ghost // Cameras
            </span>
            <h3 className="text-[17px] font-semibold leading-tight text-ghost-text-primary truncate">
              {t("selectCameras")}
            </h3>
          </div>
          <button
            onClick={closeCameraSelector}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-lg text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label={t("closePreview")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Device list */}
        <div className="relative z-10 p-4 space-y-1.5 max-h-72 overflow-y-auto">
          {loading && (
            <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-ghost-text-muted text-center py-6">
              {t("detectingCameras")}
            </p>
          )}

          {error && (
            <p className="text-small text-ghost-error text-center py-3">
              {error}
            </p>
          )}

          {!loading &&
            devices.map((device) => {
              const checked = selected.has(device.deviceId);
              return (
                <button
                  key={device.deviceId}
                  onClick={() => toggleDevice(device.deviceId)}
                  className={`group/cam w-full flex items-center gap-3 px-3 h-12 rounded-xl border text-start transition-[background-color,border-color] duration-150 ${
                    checked
                      ? "border-ghost-accent/50 bg-ghost-surface"
                      : "border-ghost-border-subtle hover:bg-ghost-surface-hover"
                  }`}
                  aria-pressed={checked}
                >
                  <span
                    className={`shrink-0 grid place-items-center w-8 h-8 rounded-lg border transition-colors duration-150 ${
                      checked
                        ? "border-ghost-accent/40 text-ghost-accent bg-ghost-bg/40"
                        : "border-ghost-border-subtle text-ghost-text-muted bg-ghost-surface/60 group-hover/cam:text-ghost-text-secondary"
                    }`}
                    aria-hidden
                  >
                    <Camera size={15} strokeWidth={1.85} />
                  </span>
                  <span
                    className={`flex-1 min-w-0 truncate text-small transition-colors duration-150 ${
                      checked
                        ? "text-ghost-text-primary font-medium"
                        : "text-ghost-text-secondary group-hover/cam:text-ghost-text-primary"
                    }`}
                  >
                    {deviceLabel(device)}
                  </span>
                  <span
                    className={`shrink-0 grid place-items-center w-5 h-5 rounded-md border transition-colors duration-150 ${
                      checked
                        ? "bg-ghost-accent border-ghost-accent text-ghost-bg"
                        : "border-ghost-border-subtle bg-transparent"
                    }`}
                    aria-hidden
                  >
                    {checked && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Footer actions */}
        <div className="relative z-10 flex items-center gap-2 px-5 py-4 border-t border-ghost-border-subtle">
          <button
            onClick={handleSaveSetup}
            disabled={saving || selected.size === 0}
            className={`shrink-0 inline-flex items-center h-9 px-3.5 rounded-xl text-small font-medium border transition-colors duration-150 ${
              saving || selected.size === 0
                ? "border-ghost-border-subtle text-ghost-text-muted cursor-not-allowed"
                : "border-ghost-border-subtle text-ghost-text-secondary hover:bg-ghost-surface-hover hover:text-ghost-text-primary"
            }`}
          >
            {savedFlash ? t("setupSaved") : saving ? t("saving") : t("saveSetup")}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleEnable}
            disabled={selected.size === 0}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-small font-semibold transition-colors duration-150 ${
              selected.size === 0
                ? "bg-ghost-surface text-ghost-text-muted cursor-not-allowed"
                : "bg-ghost-accent hover:bg-ghost-accent-hover text-ghost-bg"
            }`}
          >
            <span>{t("enableLive")}</span>
            {selected.size > 0 && (
              <span className="font-mono text-[11px] tabular-nums opacity-80">
                · {selected.size}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
