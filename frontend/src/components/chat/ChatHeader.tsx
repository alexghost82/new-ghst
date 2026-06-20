import { useEffect, useState, useCallback } from "react";
import {
  Brain,
  SlidersHorizontal,
  Languages,
  Cctv,
  Plus,
  X,
  ShieldAlert,
  ScanEye,
  FileClock,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
} from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useThemeStore } from "../../stores/themeStore";
import { useSidebarStore } from "../../stores/sidebarStore";
import { useLiveStore } from "../../stores/liveStore";
import { useUserStore } from "../../stores/userStore";
import { useAlertStore } from "../../stores/alertStore";
import { useAlertRuntimeStore } from "../../stores/alertRuntimeStore";
import { useMessageStore } from "../../stores/messageStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useBroadcastStore } from "../../stores/broadcastStore";
import { assignmentFor } from "../../utils/conversationGroups";
import { useT, type TranslationKey } from "../../utils/i18n";
import { captureFrame } from "../../utils/cameraCapture";
import ConversationTaskTimer from "./ConversationTaskTimer";

interface ChatHeaderProps {
  onToggleMemory: () => void;
  onToggleKnowledge: () => void;
  onToggleAlert: () => void;
  onToggleTasks: () => void;
  onEditSystemPrompt: () => void;
  showMemory: boolean;
  showKnowledge: boolean;
  showAlert: boolean;
  showTasks: boolean;
}

export default function ChatHeader({
  onToggleMemory,
  onToggleKnowledge,
  onToggleAlert,
  onToggleTasks,
  onEditSystemPrompt,
  showMemory,
  showKnowledge,
  showAlert,
  showTasks,
}: ChatHeaderProps) {
  const { conversations, activeConversationId } = useConversationStore();
  const { locale, dir, toggle } = useLanguageStore();
  const { theme } = useThemeStore();
  const sidebarOpen = useSidebarStore((s) => s.isOpen);
  const {
    openCameraSelector,
    savedCameras,
    fetchSavedCameras,
    removeSavedCamera,
  } = useLiveStore();
  const { activeUserId, sessionType } = useUserStore();
  const alertModeMap = useAlertStore((s) => s.alertModeEnabled);
  const runtime = useAlertRuntimeStore((s) =>
    activeConversationId ? s.byConversation[activeConversationId] : undefined,
  );
  const sseConnected = useAlertRuntimeStore((s) => s.sseConnected);
  const groupAreas = useConversationGroupsStore((s) => s.areas);
  const groupGroups = useConversationGroupsStore((s) => s.groups);
  const groupsUserId = useConversationGroupsStore((s) => s.userId);
  const loadGroupsForUser = useConversationGroupsStore((s) => s.loadForUser);
  const openBroadcastScope = useBroadcastStore((s) => s.openScope);
  const t = useT();
  const active = conversations.find((c) => c.id === activeConversationId);
  const alertActive = activeConversationId
    ? !!alertModeMap[activeConversationId]
    : false;
  const persisted = activeConversationId
    ? (savedCameras[activeConversationId] ?? [])
    : [];

  // Derive a single status tone for the dot next to the shield icon.
  // SSE drop is folded into the camera health signal because the user only
  // cares whether the pipeline is currently delivering alerts end-to-end.
  const alertStatus = !alertActive
    ? null
    : runtime?.status === "error" || (alertActive && !sseConnected)
      ? "err"
      : runtime?.status === "scanning"
        ? "scanning"
        : runtime?.status === "connected"
          ? "ok"
          : "warn";

  const alertTooltip = (() => {
    if (!alertActive) return t("alertMode");
    const labelKey: TranslationKey = !sseConnected
      ? "alertSseDisconnected"
      : runtime?.status === "error"
        ? "alertCameraError"
        : runtime?.status === "scanning"
          ? "alertScanning"
          : runtime?.status === "connected"
            ? "alertConnected"
            : runtime?.status === "connecting"
              ? "alertConnecting"
              : runtime?.status === "no_camera"
                ? "alertStatusNoCamera"
                : "alertModeOn";
    const cam = runtime?.cameraLabel;
    return cam ? `${cam} · ${t(labelKey)}` : t(labelKey);
  })();

  useEffect(() => {
    if (activeConversationId && activeUserId) {
      fetchSavedCameras(activeConversationId, activeUserId);
    }
  }, [activeConversationId, activeUserId, fetchSavedCameras]);

  // The groups/areas tree is normally hydrated by the sidebar, but the
  // breadcrumb must work even when the sidebar is collapsed (the tree isn't
  // mounted then). Load it here too, guarded so we only hydrate on user change.
  useEffect(() => {
    if (activeUserId && groupsUserId !== activeUserId) {
      loadGroupsForUser(activeUserId);
    }
  }, [activeUserId, groupsUserId, loadGroupsForUser]);

  // Full conversation path: Area › Group › Title. Each segment (area/group)
  // is clickable and opens the matching broadcast scope, mirroring the
  // sidebar's area/group click behaviour. Segments are omitted when the
  // conversation isn't assigned to an area/group.
  const assignment = activeConversationId
    ? assignmentFor(activeConversationId, {
        areas: groupAreas,
        groups: groupGroups,
      })
    : { areaId: null, groupId: null };
  const areaName = assignment.areaId
    ? (groupAreas.find((a) => a.id === assignment.areaId)?.name ?? null)
    : null;
  const groupName = assignment.groupId
    ? (groupGroups.find((g) => g.id === assignment.groupId)?.name ?? null)
    : null;

  interface PathSegment {
    label: string;
    title: string;
    onClick: () => void;
  }
  const pathSegments: PathSegment[] = [];
  if (areaName && assignment.areaId) {
    const areaId = assignment.areaId;
    pathSegments.push({
      label: areaName,
      title: t("broadcastOpenArea"),
      onClick: () => {
        if (activeUserId) {
          openBroadcastScope(
            { type: "area", id: areaId, name: areaName },
            activeUserId,
          );
        }
      },
    });
  }
  if (groupName && assignment.groupId) {
    const groupId = assignment.groupId;
    pathSegments.push({
      label: groupName,
      title: t("broadcastOpenGroup"),
      onClick: () => {
        if (activeUserId) {
          openBroadcastScope(
            { type: "group", id: groupId, name: groupName },
            activeUserId,
          );
        }
      },
    });
  }
  const PathSeparator = dir === "rtl" ? ChevronLeft : ChevronRight;

  // Admin (8+0 chord) reviewing the shared ghostdemo agent sees WHO opened each
  // conversation from the site — name + phone + email captured at the trial
  // gate — instead of a generic conversation title. Trial / standard sessions
  // keep the normal title.
  const isDemoAdmin = sessionType === "demo_admin";
  const leadName = active?.lead_name?.trim() || null;
  const leadEmail = active?.lead_email?.trim() || null;
  const leadPhone = active?.lead_phone?.trim() || null;
  const showLead = isDemoAdmin && !!(leadName || leadEmail || leadPhone);

  const [siteScanning, setSiteScanning] = useState(false);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const runSiteIntelligence = useMessageStore((s) => s.runSiteIntelligence);
  const isStreaming = useMessageStore((s) => s.isStreaming);

  const handleSiteIntelligence = useCallback(async () => {
    if (!activeConversationId || !activeUserId || siteScanning || isStreaming) return;

    const cams = persisted;
    if (cams.length === 0) {
      alert(t("siteIntelligenceNoCamera"));
      return;
    }

    setSiteScanning(true);
    try {
      const deviceId = cams[0].device_id;
      const frameBase64 = await captureFrame(deviceId);
      await runSiteIntelligence(activeConversationId, activeUserId, frameBase64);
    } catch (err) {
      console.error("[SiteIntelligence] scan failed:", err);
      alert(t("siteIntelligenceError"));
    } finally {
      setSiteScanning(false);
    }
  }, [activeConversationId, activeUserId, siteScanning, isStreaming, persisted, runSiteIntelligence, t]);

  // Ask Ghost for a full historical report in the chat thread itself. This is
  // a text-only turn (no frame): the wording matches the backend period-report
  // intent, which widens memory retrieval to the whole retention window and
  // renders every vehicle / person / situation grouped by date with day-of-week
  // and exact time.
  const handleObservationReport = useCallback(() => {
    if (!activeConversationId || !activeUserId || isStreaming) return;
    void sendMessage(
      activeConversationId,
      activeUserId,
      t("observationReportPrompt"),
    );
  }, [activeConversationId, activeUserId, isStreaming, sendMessage, t]);

  const handleRemoveTag = (deviceId: string) => {
    if (!activeConversationId || !activeUserId) return;
    removeSavedCamera(activeConversationId, activeUserId, deviceId);
  };

  return (
    <header className="flex flex-col gap-2 px-4 py-2.5 border-b border-ghost-border-subtle flex-shrink-0">
      <div className="flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-1 min-w-0">
          {active &&
            pathSegments.map((seg, i) => (
              <span
                key={`${i}-${seg.label}`}
                className="flex items-center gap-1 min-w-0 flex-shrink"
              >
                <button
                  type="button"
                  onClick={seg.onClick}
                  title={seg.title}
                  className="text-[13px] text-ghost-text-muted hover:text-ghost-text-primary hover:underline underline-offset-2 decoration-ghost-border-subtle transition-colors duration-[100ms] truncate max-w-[160px] cursor-pointer rounded px-0.5 -mx-0.5"
                >
                  {seg.label}
                </button>
                <PathSeparator
                  size={13}
                  className="text-ghost-text-muted flex-shrink-0"
                />
              </span>
            ))}
          {showLead ? (
            <div className="flex min-w-0 flex-col leading-tight">
              <h1 className="text-[16px] font-semibold text-ghost-text-primary truncate">
                {leadName || active?.title || "Ghost Internal Interface"}
              </h1>
              <span className="flex items-center gap-3 text-[12px] text-ghost-text-muted">
                {leadPhone && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Phone size={11} className="flex-shrink-0" />
                    <span className="truncate" dir="ltr">
                      {leadPhone}
                    </span>
                  </span>
                )}
                {leadEmail && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail size={11} className="flex-shrink-0" />
                    <span className="truncate" dir="ltr">
                      {leadEmail}
                    </span>
                  </span>
                )}
              </span>
            </div>
          ) : (
            <h1 className="text-[16px] font-semibold text-ghost-text-primary truncate">
              {active?.title || "Ghost Internal Interface"}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            data-tour="header-language"
            onClick={toggle}
            className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[13px] font-medium text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label="Toggle language"
            title={dir.toUpperCase()}
          >
            <Languages size={14} />
            <span className="uppercase tracking-wide">
              {locale === "he" ? "EN" : "HE"}
            </span>
          </button>

          {active && (
            <>
              <button
                data-tour="header-site-intel"
                onClick={handleSiteIntelligence}
                disabled={siteScanning || isStreaming || persisted.length === 0}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-[100ms] ${
                  siteScanning
                    ? "text-ghost-text-primary bg-ghost-surface animate-pulse"
                    : "text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
                aria-label={t("siteIntelligence")}
                title={
                  persisted.length === 0
                    ? t("siteIntelligenceNoCamera")
                    : siteScanning
                      ? t("siteIntelligenceScanning")
                      : t("siteIntelligence")
                }
              >
                <ScanEye size={16} />
              </button>
              <button
                data-tour="header-observation-report"
                onClick={handleObservationReport}
                disabled={isStreaming}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-[100ms]"
                aria-label={t("observationReport")}
                title={t("observationReport")}
              >
                <FileClock size={16} />
              </button>
              <button
                data-tour="header-memory"
                onClick={onToggleMemory}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-[100ms] ${
                  showMemory
                    ? "text-ghost-text-primary bg-ghost-surface"
                    : "text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
                }`}
                aria-label="Toggle memory panel"
              >
                <Brain size={16} />
              </button>
              <button
                data-tour="header-alert"
                onClick={onToggleAlert}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-[100ms] ${
                  alertActive
                    ? "text-ghost-text-primary bg-ghost-surface"
                    : showAlert
                      ? "text-ghost-text-primary bg-ghost-surface"
                      : "text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
                }`}
                aria-label={t("alertModeToggle")}
                title={alertTooltip}
              >
                <ShieldAlert size={16} />
                {alertStatus && (
                  <span
                    className={`absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full ${
                      alertStatus === "ok"
                        ? "bg-ghost-success"
                        : alertStatus === "scanning"
                          ? "bg-ghost-success animate-pulse"
                          : alertStatus === "warn"
                            ? "bg-ghost-text-secondary animate-pulse"
                            : "bg-ghost-error animate-pulse"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                data-tour="header-tasks"
                onClick={onToggleTasks}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-[100ms] ${
                  showTasks
                    ? "text-ghost-text-primary bg-ghost-surface"
                    : "text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
                }`}
                aria-label={t("tasksPanelTitle")}
                title={t("tasksPanelTitle")}
              >
                <CalendarClock size={16} />
              </button>
              <button
                data-tour="header-system-prompt"
                onClick={onEditSystemPrompt}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
                aria-label="Edit system prompt"
              >
                <SlidersHorizontal size={16} />
              </button>
            </>
          )}
          {!sidebarOpen && (
            <img
              key="ghost-brand-collapsed"
              src={theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png"}
              alt="Ghost"
              className="ghost-brand-icon ghost-brand-wrap-in w-7 h-7 object-contain flex-shrink-0 rounded-[6px] ms-1.5"
              draggable={false}
            />
          )}
        </div>
      </div>

      {active && persisted.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap fade-in">
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted me-1">
            {t("defaultCameras")}
          </span>
          {persisted.map((cam) => (
            <span
              key={cam.id}
              className="inline-flex items-center gap-1.5 bg-ghost-surface border border-ghost-border-subtle rounded-full px-3 py-1 text-[13px] text-ghost-text-secondary"
            >
              <Cctv size={14} className="text-ghost-text-muted flex-shrink-0" />
              <span className="whitespace-nowrap">{cam.label}</span>
              <button
                onClick={() => handleRemoveTag(cam.device_id)}
                className="text-ghost-text-muted hover:text-ghost-text-primary transition-colors duration-[100ms]"
                aria-label={`${t("removeCamera")}: ${cam.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            data-tour="header-add-camera"
            onClick={openCameraSelector}
            className="inline-flex items-center gap-1 bg-transparent border border-ghost-border-subtle rounded-full px-3 py-1 text-[13px] text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
            aria-label={t("addCamera")}
          >
            <Plus size={12} />
            {t("addCamera")}
          </button>
        </div>
      )}

      {active && <ConversationTaskTimer />}
    </header>
  );
}
