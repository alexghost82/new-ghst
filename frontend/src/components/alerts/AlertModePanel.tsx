import { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Activity,
  Wifi,
  WifiOff,
  Video,
  VideoOff,
  PlayCircle,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useAlertStore } from "../../stores/alertStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useLiveStore } from "../../stores/liveStore";
import {
  useAlertRuntimeStore,
  type AlertConnectionStatus,
} from "../../stores/alertRuntimeStore";
import {
  testAlertCameraConnection,
  type AlertCameraTestErrorCode,
  type AlertCameraTestResult,
} from "../../services/alertCameraTest";
import { useT, type TranslationKey } from "../../utils/i18n";
import { confirmDialog, toast } from "../../stores/feedbackStore";

interface AlertModePanelProps {
  onClose: () => void;
}

type Tone = "ok" | "warn" | "err" | "muted";

const STATUS_TONE: Record<AlertConnectionStatus, Tone> = {
  idle: "muted",
  no_camera: "warn",
  no_rules: "warn",
  activating: "warn",
  connecting: "warn",
  connected: "ok",
  scanning: "ok",
  error: "err",
};

const STATUS_LABEL_KEY: Record<AlertConnectionStatus, TranslationKey> = {
  idle: "alertStatusIdle",
  no_camera: "alertStatusNoCamera",
  no_rules: "alertRequiresActiveRule",
  activating: "alertActivating",
  connecting: "alertConnecting",
  connected: "alertConnected",
  scanning: "alertScanning",
  error: "alertCameraError",
};

const TEST_ERROR_KEY: Record<AlertCameraTestErrorCode, TranslationKey> = {
  no_camera: "alertTestNoCamera",
  permission_denied: "alertTestPermissionDenied",
  device_busy: "alertTestDeviceBusy",
  no_frame: "alertTestNoFrame",
  unknown: "alertTestFailed",
};

function toneClasses(tone: Tone): string {
  switch (tone) {
    case "ok":
      return "text-green-500";
    case "warn":
      return "text-yellow-600";
    case "err":
      return "text-ghost-error";
    default:
      return "text-ghost-text-muted";
  }
}

function dotClasses(tone: Tone, animate: boolean): string {
  const base =
    "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors";
  const color =
    tone === "ok"
      ? "bg-green-500"
      : tone === "warn"
        ? "bg-yellow-500"
        : tone === "err"
          ? "bg-ghost-error"
          : "bg-ghost-text-muted/50";
  return `${base} ${color} ${animate ? "animate-pulse" : ""}`;
}

function formatRelative(t: (k: TranslationKey) => string, ms: number | null): string {
  if (!ms) return t("alertLastScanNever");
  const delta = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (delta < 5) return t("sNow");
  if (delta < 60) return t("sSeconds").replace("{n}", String(delta));
  const mins = Math.floor(delta / 60);
  if (mins < 60) return t("sMinutes").replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  return t("sHours").replace("{n}", String(hours));
}

export default function AlertModePanel({ onClose }: AlertModePanelProps) {
  const { activeConversationId, conversations } = useConversationStore();
  const { activeUserId, sessionType } = useUserStore();
  const locale = useLanguageStore((s) => s.locale);
  const {
    savedCameras,
    getActiveCameras,
    fetchSavedCameras,
    saveCameraSetup,
    openCameraSelector,
  } = useLiveStore();
  const {
    rules,
    alertModeEnabled,
    trialAlertExpiresAt,
    loadingRules,
    error,
    fetchRules,
    addRule,
    updateRule,
    deleteRule,
    toggleAlertMode,
    setAlertModeFromConversation,
    clearError,
  } = useAlertStore();

  const runtime = useAlertRuntimeStore((s) =>
    activeConversationId ? s.byConversation[activeConversationId] : undefined,
  );
  const sseConnected = useAlertRuntimeStore((s) => s.sseConnected);
  const testing = useAlertRuntimeStore((s) =>
    activeConversationId ? !!s.testing[activeConversationId] : false,
  );
  const setStatus = useAlertRuntimeStore((s) => s.setStatus);
  const setTesting = useAlertRuntimeStore((s) => s.setTesting);
  const resetRuntime = useAlertRuntimeStore((s) => s.resetConversation);

  const [newRuleText, setNewRuleText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<AlertCameraTestResult | null>(
    null,
  );
  const [, forceTick] = useState(0);
  const t = useT();

  const conversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const conversationRules = activeConversationId
    ? (rules[activeConversationId] ?? [])
    : [];
  const activeRulesCount = conversationRules.filter((r) => r.is_active).length;
  const isLoading = activeConversationId
    ? !!loadingRules[activeConversationId]
    : false;
  const isOn = activeConversationId
    ? !!alertModeEnabled[activeConversationId]
    : false;

  // Trial sessions (shared ghostdemo agent, no personal user) auto-disarm alert
  // mode after 30s. Surface the cap as a hint when off, and a live countdown
  // while armed (the 1s forceTick interval below keeps this fresh).
  const isTrial = sessionType === "trial";
  const trialExpiresAt = activeConversationId
    ? (trialAlertExpiresAt[activeConversationId] ?? null)
    : null;
  const trialRemainingSec =
    isTrial && isOn && trialExpiresAt
      ? Math.max(0, Math.ceil((trialExpiresAt - Date.now()) / 1000))
      : null;

  const activeCameras = activeConversationId
    ? getActiveCameras(activeConversationId)
    : [];
  const savedForConv = activeConversationId
    ? (savedCameras[activeConversationId] ?? [])
    : [];
  const hasCamera = activeCameras.length > 0 || savedForConv.length > 0;
  const cameraLabel = useMemo(() => {
    if (runtime?.cameraLabel) return runtime.cameraLabel;
    if (activeCameras[0]?.label) return activeCameras[0].label;
    return savedForConv[0]?.label ?? null;
  }, [runtime, activeCameras, savedForConv]);

  useEffect(() => {
    if (!activeConversationId || !activeUserId) return;
    fetchRules(activeConversationId, activeUserId);
    fetchSavedCameras(activeConversationId, activeUserId);
    if (conversation?.alert_mode_enabled !== undefined) {
      setAlertModeFromConversation(
        activeConversationId,
        !!conversation.alert_mode_enabled,
      );
    }
  }, [
    activeConversationId,
    activeUserId,
    fetchRules,
    fetchSavedCameras,
    conversation?.alert_mode_enabled,
    setAlertModeFromConversation,
  ]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Re-render every second while alert mode is on so the "last scan: Xs ago"
  // string stays fresh without resorting to setInterval inside each consumer.
  useEffect(() => {
    if (!isOn) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [isOn]);

  // Reset the test banner whenever the user switches conversations.
  useEffect(() => {
    setTestResult(null);
    setActivationError(null);
  }, [activeConversationId]);

  const handleAddRule = async () => {
    const trimmed = newRuleText.trim();
    if (!trimmed || !activeConversationId || !activeUserId) return;
    setSubmitting(true);
    const created = await addRule(
      activeConversationId,
      activeUserId,
      trimmed,
    );
    setSubmitting(false);
    if (created) setNewRuleText("");
  };

  const runTest = async (): Promise<AlertCameraTestResult | null> => {
    if (!activeConversationId) return null;
    setTesting(activeConversationId, true);
    setTestResult(null);
    try {
      const result = await testAlertCameraConnection(activeConversationId);
      setTestResult(result);
      return result;
    } finally {
      setTesting(activeConversationId, false);
    }
  };

  const handleTurnOn = async () => {
    if (!activeConversationId || !activeUserId) return;
    setActivationError(null);
    if (!hasCamera) {
      setActivationError(t("alertModeRequiresCamera"));
      return;
    }
    if (activeRulesCount === 0) {
      setActivationError(t("alertRequiresActiveRule"));
      return;
    }
    setActivating(true);
    setStatus(activeConversationId, "activating", {
      cameraLabel,
      lastError: null,
    });
    try {
      // If the user only has Live (session-only) cameras and no persisted
      // setup, auto-save them. Alert mode must survive a reload so the
      // backend cannot rely on session state — and it'd be obnoxious to
      // make the user click "Save Setup" first.
      if (savedForConv.length === 0 && activeCameras.length > 0) {
        const saved = await saveCameraSetup(
          activeConversationId,
          activeUserId,
          activeCameras.map((c, idx) => ({
            device_id: c.device_id,
            label: c.label,
            position: idx,
          })),
        );
        if (!saved) {
          setActivationError(t("alertModeRequiresCamera"));
          setStatus(activeConversationId, "error", {
            lastError: t("alertModeRequiresCamera"),
          });
          return;
        }
      }

      const result = await runTest();
      if (!result?.ok) {
        const key = result?.errorCode
          ? TEST_ERROR_KEY[result.errorCode]
          : "alertTestFailed";
        setActivationError(t(key));
        setStatus(activeConversationId, "error", {
          lastError: t(key),
        });
        return;
      }
      const toggleRes = await toggleAlertMode(
        activeConversationId,
        activeUserId,
        true,
      );
      if (!toggleRes.ok) {
        // Map known backend guards to localized messages so the inline
        // banner stays in the user's language, even though the validation
        // text the backend ships is English.
        const localized =
          toggleRes.errorCode === "ALERT_NO_CAMERA"
            ? t("alertModeRequiresCamera")
            : toggleRes.errorCode === "ALERT_NO_ACTIVE_RULE"
              ? t("alertRequiresActiveRule")
              : (toggleRes.errorMessage ?? t("alertTestFailed"));
        setActivationError(localized);
        setStatus(activeConversationId, "error", { lastError: localized });
      }
    } finally {
      setActivating(false);
    }
  };

  const handleTurnOff = async () => {
    if (!activeConversationId || !activeUserId) return;
    setActivationError(null);
    await toggleAlertMode(activeConversationId, activeUserId, false);
    resetRuntime(activeConversationId);
  };

  const handleToggle = () => {
    if (activating) return;
    if (isOn) {
      void handleTurnOff();
    } else {
      void handleTurnOn();
    }
  };

  const handleToggleRule = (ruleId: string, currentActive: boolean) => {
    if (!activeUserId) return;
    updateRule(ruleId, activeUserId, { is_active: !currentActive });
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!activeUserId) return;
    const ok = await confirmDialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteGeneric"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    deleteRule(ruleId, activeUserId);
    toast.success(t("actionDeleted"));
  };

  const status: AlertConnectionStatus = !isOn
    ? "idle"
    : (runtime?.status ?? "connecting");
  const statusTone = STATUS_TONE[status];
  const statusLabelKey = STATUS_LABEL_KEY[status];
  const showCameraIcon = status === "no_camera" ? VideoOff : Video;
  const CameraIcon = showCameraIcon;

  return (
    <aside
      data-tour="alert-panel"
      className="w-[420px] max-w-[100vw] flex-shrink-0 bg-ghost-bg-secondary border-s border-ghost-border-subtle h-screen flex flex-col slide-in-right"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-ghost-border-subtle">
        <div className="flex items-center gap-3 min-w-0">
          <ShieldAlert
            size={22}
            className={`flex-shrink-0 ${isOn ? "text-ghost-error" : "text-ghost-accent"}`}
          />
          <h2 className="text-lg font-semibold leading-snug text-ghost-text-primary truncate">
            {t("alertModePanelTitle")}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          aria-label="Close alert mode panel"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <div
          className={`rounded-2xl border px-4 py-4 transition-colors duration-[160ms] ${
            isOn
              ? "border-green-700/40 bg-green-700/5"
              : "border-ghost-border-subtle bg-ghost-surface"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-body text-ghost-text-primary font-semibold leading-snug">
                {isOn ? t("alertModeOn") : t("alertModeOff")}
              </p>
              <p className="text-small text-ghost-text-secondary leading-relaxed">
                {t("alertModeDescription")}
              </p>
              {!hasCamera && !isOn && (
                <p className="flex items-start gap-2 text-small text-yellow-600 leading-relaxed">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{t("alertModeRequiresCamera")}</span>
                </p>
              )}
              {activationError && (
                <p className="flex items-start gap-2 text-small text-ghost-error leading-relaxed">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {activationError}
                    {!hasCamera && (
                      <button
                        onClick={openCameraSelector}
                        className="underline ms-1 hover:text-ghost-error/80"
                      >
                        {t("addCamera")}
                      </button>
                    )}
                  </span>
                </p>
              )}
              {isTrial && !isOn && (
                <p className="flex items-start gap-2 text-small text-ghost-text-muted leading-relaxed">
                  <Clock size={16} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {locale === "he"
                      ? "מצב הדגמה: התראה שמופעלת נכבית אוטומטית אחרי 30 שניות."
                      : "Demo mode: an armed alert auto-stops after 30 seconds."}
                  </span>
                </p>
              )}
              {isTrial && isOn && trialRemainingSec !== null && (
                <span className="inline-flex items-center gap-2 rounded-full bg-ghost-accent/10 px-3 py-1 text-small font-medium text-ghost-accent">
                  <Clock size={14} className="flex-shrink-0" />
                  {locale === "he"
                    ? `כיבוי אוטומטי בעוד ${trialRemainingSec} שניות`
                    : `Auto-stops in ${trialRemainingSec}s`}
                </span>
              )}
            </div>
            <button
              data-tour="alert-toggle"
              onClick={handleToggle}
              disabled={activating}
              className={`flex-shrink-0 w-14 h-8 rounded-full relative transition-colors duration-[160ms] disabled:opacity-40 disabled:cursor-not-allowed mt-0.5 ${
                isOn ? "bg-green-700" : "bg-ghost-border-subtle"
              }`}
              aria-label={t("alertModeToggle")}
            >
              <span
                className={`absolute top-0.5 w-7 h-7 bg-white rounded-full shadow transition-all duration-[160ms] ${
                  isOn ? "end-0.5" : "start-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* System status card — visible whenever alert mode is on, so the
            operator knows the pipeline is actually alive. */}
        {isOn && (
          <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 py-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-small font-semibold uppercase tracking-wide text-ghost-text-secondary">
                {t("alertSystemStatus")}
              </h3>
              <button
                onClick={() => void runTest()}
                disabled={testing || !hasCamera}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-small font-medium text-ghost-accent hover:bg-ghost-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-[100ms]"
              >
                {testing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PlayCircle size={16} />
                )}
                <span>{testing ? t("alertTesting") : t("alertTestConnection")}</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 ${dotClasses(
                    statusTone,
                    status === "scanning" || status === "activating",
                  )}`}
                />
                <CameraIcon size={18} className={`mt-0.5 flex-shrink-0 ${toneClasses(statusTone)}`} />
                <div className="min-w-0 flex-1">
                  <span className="block text-small text-ghost-text-muted mb-0.5">
                    {t("alertStatusCamera")}
                  </span>
                  <span className={`block text-body font-semibold leading-snug ${toneClasses(statusTone)}`}>
                    {t(statusLabelKey)}
                  </span>
                  {cameraLabel && status !== "no_camera" && (
                    <span className="block text-small text-ghost-text-secondary mt-1 leading-relaxed break-words">
                      {cameraLabel}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className={`mt-1.5 ${dotClasses(sseConnected ? "ok" : "err", false)}`} />
                {sseConnected ? (
                  <Wifi size={18} className="mt-0.5 flex-shrink-0 text-green-500" />
                ) : (
                  <WifiOff size={18} className="mt-0.5 flex-shrink-0 text-ghost-error" />
                )}
                <div className="min-w-0 flex-1">
                  <span className="block text-small text-ghost-text-muted mb-0.5">
                    {t("alertStatusChannel")}
                  </span>
                  <span
                    className={`block text-body font-semibold leading-snug ${
                      sseConnected ? "text-green-500" : "text-ghost-error"
                    }`}
                  >
                    {sseConnected
                      ? t("alertSseConnected")
                      : t("alertSseDisconnected")}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className={`mt-1.5 ${dotClasses("muted", false)}`} />
                <Activity size={18} className="mt-0.5 flex-shrink-0 text-ghost-text-muted" />
                <div className="min-w-0 flex-1">
                  <span className="block text-small text-ghost-text-muted mb-0.5">
                    {t("alertLastScan")}
                  </span>
                  <span className="block text-body font-semibold text-ghost-text-primary leading-snug">
                    {formatRelative(t, runtime?.lastScanAt ?? null)}
                  </span>
                </div>
              </div>
            </div>

            {runtime?.lastError && status === "error" && (
              <p className="flex items-start gap-2 text-small text-ghost-error pt-3 border-t border-ghost-border-subtle/50 leading-relaxed">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="break-words">{runtime.lastError}</span>
              </p>
            )}
          </div>
        )}

        {/* Stand-alone test card when alert mode is off: lets the user verify
            the camera works *before* committing to enable. */}
        {!isOn && hasCamera && (
          <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Video size={18} className="text-ghost-text-muted flex-shrink-0" />
                <span className="text-body text-ghost-text-primary font-medium leading-snug break-words">
                  {cameraLabel ?? t("alertStatusCamera")}
                </span>
              </div>
              <button
                onClick={() => void runTest()}
                disabled={testing}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl text-small font-medium text-ghost-accent hover:bg-ghost-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-[100ms] flex-shrink-0"
              >
                {testing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PlayCircle size={16} />
                )}
                <span>{testing ? t("alertTesting") : t("alertTestConnection")}</span>
              </button>
            </div>
            {testResult && (
              <p
                className={`flex items-start gap-2 text-small mt-3 leading-relaxed ${
                  testResult.ok ? "text-green-500" : "text-ghost-error"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                )}
                <span>
                  {testResult.ok
                    ? t("alertTestSuccess")
                    : t(
                        testResult.errorCode
                          ? TEST_ERROR_KEY[testResult.errorCode]
                          : "alertTestFailed",
                      )}
                </span>
              </p>
            )}
          </div>
        )}

        <div data-tour="alert-rules">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-small font-semibold uppercase tracking-wide text-ghost-text-secondary">
              {t("alertRules")}
            </h3>
            <span className="text-body font-semibold text-ghost-text-muted tabular-nums">
              {conversationRules.length}
            </span>
          </div>

          <div className="flex items-stretch gap-2.5 mb-4">
            <input
              type="text"
              value={newRuleText}
              onChange={(e) => setNewRuleText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleAddRule();
              }}
              placeholder={t("alertRulePlaceholder")}
              className="flex-1 min-h-[48px] bg-ghost-surface border border-ghost-border-subtle rounded-xl px-4 py-3 text-body text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent focus:ring-2 focus:ring-ghost-accent/20 transition-colors duration-[100ms]"
            />
            <button
              onClick={handleAddRule}
              disabled={!newRuleText.trim() || submitting}
              className="min-w-[48px] min-h-[48px] px-4 rounded-xl bg-ghost-accent text-white text-body font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label={t("addAlertRule")}
            >
              <Plus size={20} />
            </button>
          </div>

          {isLoading && conversationRules.length === 0 ? (
            <p className="text-ghost-text-muted text-body text-center py-8">
              {t("loading")}
            </p>
          ) : conversationRules.length === 0 ? (
            <div className="text-center py-10 px-2">
              <ShieldAlert
                size={40}
                className="text-ghost-text-muted mx-auto mb-4 opacity-50"
              />
              <p className="text-ghost-text-secondary text-body leading-relaxed">
                {t("noAlertRules")}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {conversationRules.map((rule) => (
                <li
                  key={rule.id}
                  className={`group flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-[100ms] ${
                    rule.is_active
                      ? "border-ghost-border-subtle bg-ghost-surface"
                      : "border-ghost-border-subtle bg-ghost-surface/40 opacity-70"
                  }`}
                >
                  <button
                    onClick={() => handleToggleRule(rule.id, rule.is_active)}
                    className={`flex-shrink-0 w-12 h-7 rounded-full relative transition-colors duration-[160ms] mt-0.5 ${
                      rule.is_active ? "bg-green-700" : "bg-ghost-border-subtle"
                    }`}
                    aria-label={
                      rule.is_active
                        ? t("alertRuleActive")
                        : t("alertRuleInactive")
                    }
                  >
                    <span
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-[160ms] ${
                        rule.is_active ? "end-0.5" : "start-0.5"
                      }`}
                    />
                  </button>
                  <p className="flex-1 min-w-0 text-body text-ghost-text-primary leading-relaxed break-words">
                    {rule.description}
                  </p>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 rounded-xl text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-surface-hover transition-all duration-[100ms]"
                    aria-label={t("deleteAlertRule")}
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-ghost-error/40 bg-ghost-error/5 px-4 py-3">
            <AlertCircle
              size={18}
              className="flex-shrink-0 text-ghost-error mt-0.5"
            />
            <p className="flex-1 text-small text-ghost-error leading-relaxed">
              {error}
            </p>
            <button
              onClick={clearError}
              className="flex-shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-ghost-error/60 hover:text-ghost-error rounded-xl"
              aria-label="Dismiss error"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
