import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import SidebarCollapseTab from "./components/sidebar/SidebarCollapseTab";
import ChatArea from "./components/chat/ChatArea";
import BroadcastChatArea from "./components/chat/BroadcastChatArea";
import KnowledgePanel from "./components/knowledge/KnowledgePanel";
import MemoryPanel from "./components/shared/MemoryPanel";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import AlertModePanel from "./components/alerts/AlertModePanel";
import TasksPanel from "./components/tasks/TasksPanel";
import AlertOverlay from "./components/alerts/AlertOverlay";
import ExpertOverlay from "./components/expert/ExpertOverlay";
import SettingsPanel from "./components/settings/SettingsPanel";
import SystemPromptEditor from "./components/settings/SystemPromptEditor";
import IncidentBoard from "./components/incidents/IncidentBoard";
import OperationsBoard from "./components/operations/OperationsBoard";
import IncidentWorkspace from "./components/incidents/IncidentWorkspace";
import IncidentCloseModal from "./components/incidents/IncidentCloseModal";
import OnboardingOverlay from "./components/onboarding/OnboardingOverlay";
import OnboardingHub from "./components/onboarding/OnboardingHub";
import TrialSetupWizard from "./components/onboarding/TrialSetupWizard";
import GhostHighFive from "./components/shared/GhostHighFive";
import Toaster from "./components/shared/Toaster";
import ConfirmDialog from "./components/shared/ConfirmDialog";
import {
  useOnboardingStore,
  selectActiveStep,
} from "./stores/onboardingStore";
import { useUserStore } from "./stores/userStore";
import { useConversationStore } from "./stores/conversationStore";
import { useAlertStore } from "./stores/alertStore";
import { useDetectionStore } from "./stores/detectionStore";
import { useViewStore } from "./stores/viewStore";
import { useSidebarStore } from "./stores/sidebarStore";
import { useIncidentStore } from "./stores/incidentStore";
import { useBroadcastStore } from "./stores/broadcastStore";
import { useDocumentChrome } from "./hooks/useDocumentChrome";
import { startAlertEngine, stopAlertEngine } from "./services/alertEngine";
import { startTaskEngine, stopTaskEngine } from "./services/taskEngine";
import {
  startDetectionEngine,
  stopDetectionEngine,
} from "./services/detectionEngine";
import { startAlertStream, stopAlertStream } from "./services/alertStream";
import { prewarmFaceBlur } from "./services/faceBlur";

// Where the public marketing site lives. Unauthenticated visitors, logouts,
// and expired sessions are handed back to it via a real cross-document load.
const SITE_URL = "/";

function leaveToSite() {
  window.location.assign(SITE_URL);
}

// Operational system (post-login). This is the authenticated chat / incidents
// shell only; the public marketing pages live in the separate site build. If
// the visitor is not authenticated we bounce straight back to the marketing
// site rather than rendering anything here.
export default function App() {
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const {
    isAuthenticated,
    activeUserId,
    expiresAt,
    clearExpiredSession,
    sessionType,
    trialSetupPending,
  } = useUserStore();
  const { activeConversationId, conversations } = useConversationStore();
  const setAlertModeFromConversation = useAlertStore(
    (s) => s.setAlertModeFromConversation,
  );
  const setTrackingEnabledFromConversation = useDetectionStore(
    (s) => s.setTrackingEnabledFromConversation,
  );
  const viewMode = useViewStore((s) => s.mode);
  const setViewMode = useViewStore((s) => s.setMode);
  const broadcastScope = useBroadcastStore((s) => s.activeScope);
  const activeIncidentId = useIncidentStore((s) => s.activeIncidentId);
  const sidebarOpen = useSidebarStore((s) => s.isOpen);
  const sidebarWidth = useSidebarStore((s) => s.width);
  const sidebarResizing = useSidebarStore((s) => s.isResizing);
  const openSidebar = useSidebarStore((s) => s.open);
  const setSidebarOpenTransient = useSidebarStore((s) => s.setOpenTransient);

  const onbStatus = useOnboardingStore((s) => s.status);
  const onbChapterId = useOnboardingStore((s) => s.currentChapterId);
  const onbStepIndex = useOnboardingStore((s) => s.currentStepIndex);
  const onbHydrated = useOnboardingStore((s) => s.hydrated);
  const onbDismissed = useOnboardingStore((s) => s.dismissed);
  const startTour = useOnboardingStore((s) => s.startTour);

  useDocumentChrome();

  // Auth guard: the operational system is only for authenticated sessions.
  // Logout and session expiry both flip `isAuthenticated` to false, which
  // sends the visitor back to the public marketing site.
  useEffect(() => {
    if (!isAuthenticated) {
      leaveToSite();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Kick off MediaPipe FaceDetector init in the background so the first
    // frame we capture (Composer or Alert Engine) doesn't pay the ~200–400ms
    // load cost. fire-and-forget; idempotent on repeat mounts.
    prewarmFaceBlur();
  }, []);

  useEffect(() => {
    setShowKnowledge(false);
    setShowMemory(false);
    setShowAlert(false);
    setShowTasks(false);
  }, [activeConversationId]);

  useEffect(() => {
    for (const conv of conversations) {
      setAlertModeFromConversation(conv.id, !!conv.alert_mode_enabled);
      setTrackingEnabledFromConversation(conv.id, !!conv.tracking_enabled);
    }
  }, [
    conversations,
    setAlertModeFromConversation,
    setTrackingEnabledFromConversation,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !expiresAt) return;
    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      clearExpiredSession();
      return;
    }
    const timer = window.setTimeout(() => {
      clearExpiredSession();
    }, msUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, expiresAt, clearExpiredSession]);

  useEffect(() => {
    startAlertEngine();
    startDetectionEngine();
    startTaskEngine();
    return () => {
      stopAlertEngine();
      stopDetectionEngine();
      stopTaskEngine();
    };
  }, []);

  useEffect(() => {
    if (!activeUserId) {
      stopAlertStream();
      return;
    }
    startAlertStream(activeUserId);
    return () => stopAlertStream();
  }, [activeUserId]);

  // Onboarding tour drives the app shell: each step declares which surface
  // (panel/view) must be open so its highlight target exists. We open the
  // matching panel and ensure the sidebar is visible for the anchors.
  useEffect(() => {
    if (onbStatus !== "running") return;
    const step = selectActiveStep(useOnboardingStore.getState());
    const surface = step?.surface ?? "none";
    if (surface === "incidents") {
      setViewMode("incidents");
    } else {
      setViewMode("chat");
      openSidebar();
    }
    setShowMemory(surface === "memory");
    setShowAlert(surface === "alert");
    setShowKnowledge(false);
    setShowSettings(surface === "settings");
    setShowSystemPrompt(surface === "systemPrompt");
  }, [onbStatus, onbChapterId, onbStepIndex, setViewMode, openSidebar]);

  // When the tour stops (skipped or completed), close any panels/modals it had
  // forced open and return to the chat view.
  const tourWasRunning = useRef(false);
  useEffect(() => {
    const running = onbStatus === "running";
    if (tourWasRunning.current && !running) {
      setShowMemory(false);
      setShowAlert(false);
      setShowSettings(false);
      setShowSystemPrompt(false);
      setViewMode("chat");
    }
    tourWasRunning.current = running;
  }, [onbStatus, setViewMode]);

  // Auto-collapse the conversations sidebar while a right-side context panel
  // (Memory / Knowledge / Alert / Tasks) is open, to free horizontal room, and
  // restore it to its prior state once the last panel closes. The collapse is
  // transient (never overwrites the operator's saved sidebar preference). The
  // guided tour is excluded since it intentionally opens both the sidebar and a
  // panel together for its highlight anchors.
  const anyPanelOpen = showMemory || showKnowledge || showAlert || showTasks;
  const prevAnyPanelOpen = useRef(false);
  const sidebarWasOpenRef = useRef(false);
  useEffect(() => {
    if (onbStatus === "running") {
      prevAnyPanelOpen.current = anyPanelOpen;
      return;
    }
    if (anyPanelOpen && !prevAnyPanelOpen.current) {
      sidebarWasOpenRef.current = useSidebarStore.getState().isOpen;
      if (sidebarWasOpenRef.current) {
        setSidebarOpenTransient(false);
      }
    } else if (!anyPanelOpen && prevAnyPanelOpen.current) {
      if (sidebarWasOpenRef.current) {
        setSidebarOpenTransient(true);
      }
    }
    prevAnyPanelOpen.current = anyPanelOpen;
  }, [anyPanelOpen, onbStatus, setSidebarOpenTransient]);

  // Auto-launch the guided tour on a genuine first visit on this device — no
  // persisted onboarding record and not previously dismissed. Return visits
  // rely on the floating launcher instead. Trial sessions are excluded: their
  // guided first-setup wizard replaces the spotlight tour.
  const autoLaunchedRef = useRef(false);
  useEffect(() => {
    if (autoLaunchedRef.current) return;
    if (!isAuthenticated) return;
    if (sessionType === "trial") return;
    if (onbHydrated || onbDismissed) return;
    if (onbStatus !== "idle") return;
    autoLaunchedRef.current = true;
    const timer = window.setTimeout(() => startTour(), 900);
    return () => window.clearTimeout(timer);
  }, [
    isAuthenticated,
    sessionType,
    onbHydrated,
    onbDismissed,
    onbStatus,
    startTour,
  ]);

  // Avoid flashing the authenticated shell for a frame before the guard
  // redirect kicks in.
  if (!isAuthenticated) {
    return null;
  }

  // The public 8-minute trial renders the EXACT same operational shell as a
  // standard login. Each trial runs on its own brand-new account (named after
  // the visitor), starts with the guided first-setup wizard, and expires
  // after 8 minutes. Everything else — chat, live camera, alerts — is identical.
  return (
    <div className="flex h-screen bg-ghost-bg overflow-hidden">
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{
          width: sidebarOpen ? `${sidebarWidth}px` : "0px",
          transition: sidebarResizing
            ? "none"
            : "width 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        aria-hidden={!sidebarOpen}
      >
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
      </div>
      {!sidebarOpen && !anyPanelOpen && <SidebarCollapseTab />}

      {viewMode === "chat" && broadcastScope ? (
        <BroadcastChatArea />
      ) : viewMode === "chat" ? (
        <ChatArea
          onToggleMemory={() => {
            setShowMemory((v) => !v);
            if (!showMemory) {
              setShowKnowledge(false);
              setShowAlert(false);
              setShowTasks(false);
            }
          }}
          onToggleKnowledge={() => {
            setShowKnowledge((v) => !v);
            if (!showKnowledge) {
              setShowMemory(false);
              setShowAlert(false);
              setShowTasks(false);
            }
          }}
          onToggleAlert={() => {
            setShowAlert((v) => !v);
            if (!showAlert) {
              setShowMemory(false);
              setShowKnowledge(false);
              setShowTasks(false);
            }
          }}
          onToggleTasks={() => {
            setShowTasks((v) => !v);
            if (!showTasks) {
              setShowMemory(false);
              setShowKnowledge(false);
              setShowAlert(false);
            }
          }}
          onEditSystemPrompt={() => setShowSystemPrompt(true)}
          showMemory={showMemory}
          showKnowledge={showKnowledge}
          showAlert={showAlert}
          showTasks={showTasks}
        />
      ) : viewMode === "operations" ? (
        <OperationsBoard />
      ) : (
        <IncidentBoard />
      )}

      {viewMode === "chat" && showKnowledge && (
        <ErrorBoundary onReset={() => setShowKnowledge(false)}>
          <KnowledgePanel onClose={() => setShowKnowledge(false)} />
        </ErrorBoundary>
      )}
      {viewMode === "chat" && showMemory && (
        <ErrorBoundary onReset={() => setShowMemory(false)}>
          <MemoryPanel onClose={() => setShowMemory(false)} />
        </ErrorBoundary>
      )}
      {viewMode === "chat" && showAlert && (
        <ErrorBoundary onReset={() => setShowAlert(false)}>
          <AlertModePanel onClose={() => setShowAlert(false)} />
        </ErrorBoundary>
      )}
      {viewMode === "chat" && showTasks && (
        <ErrorBoundary onReset={() => setShowTasks(false)}>
          <TasksPanel onClose={() => setShowTasks(false)} />
        </ErrorBoundary>
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
      {showSystemPrompt && (
        <SystemPromptEditor onClose={() => setShowSystemPrompt(false)} />
      )}

      <AlertOverlay />
      <ExpertOverlay />
      {activeIncidentId && <IncidentWorkspace />}
      <IncidentCloseModal />

      <OnboardingOverlay />
      <OnboardingHub />
      <GhostHighFive />
      <Toaster />
      <ConfirmDialog />

      {/* Fresh trial accounts are walked through standing up their first
          area / group / conversation / camera before touching the console. */}
      {sessionType === "trial" && trialSetupPending && <TrialSetupWizard />}
    </div>
  );
}
