import { useConversationStore } from "../../stores/conversationStore";
import ChatHeader from "./ChatHeader";
import CameraSelector from "./CameraSelector";
import MessageList from "./MessageList";
import LiveCameraStage from "./LiveCameraStage";
import Composer from "../composer/Composer";
import ErrorBanner from "../shared/ErrorBanner";
import GhostIcon from "../shared/GhostIcon";
import { useMessageStore } from "../../stores/messageStore";
import { useT } from "../../utils/i18n";

interface ChatAreaProps {
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

export default function ChatArea({
  onToggleMemory,
  onToggleKnowledge,
  onToggleAlert,
  onToggleTasks,
  onEditSystemPrompt,
  showMemory,
  showKnowledge,
  showAlert,
  showTasks,
}: ChatAreaProps) {
  const { activeConversationId } = useConversationStore();
  const { error, dismissError } = useMessageStore();
  const t = useT();

  if (!activeConversationId) {
    return (
      <main className="relative flex-1 flex flex-col items-center justify-center bg-ghost-bg px-6 text-center overflow-hidden">
        {/* Centered tactical wash — a two-tone glow stacked symmetrically around
            the Ghost mark so the icon melts into the background (matches the
            login screen's ambient feel). Steel sits on the icon, olive below. */}
        <div className="ghost-ambient" aria-hidden>
          <div
            className="ghost-ambient__blob ghost-ambient__blob--1"
            style={{
              top: "50%",
              left: "50%",
              marginTop: -340,
              marginLeft: -270,
              width: 540,
              height: 540,
              background:
                "radial-gradient(circle, rgb(96 116 132 / 0.42), transparent 70%)",
            }}
          />
          <div
            className="ghost-ambient__blob ghost-ambient__blob--3"
            style={{
              top: "50%",
              left: "50%",
              marginTop: -190,
              marginLeft: -290,
              width: 580,
              height: 580,
              background:
                "radial-gradient(circle, rgb(104 116 78 / 0.3), transparent 72%)",
            }}
          />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          {/* Bare brand mark — no baked-in vignette. Light: black tile / white
              ghost; dark: inverted to white tile / black ghost (GhostIcon). */}
          <GhostIcon size={80} className="mb-6" />
          <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted mb-3">
            Ghost // Console
          </span>
          <h2 className="text-[22px] font-semibold leading-tight text-ghost-text-primary">
            {t("selectConversation")}
          </h2>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex-1 flex flex-col bg-ghost-bg min-w-0 overflow-hidden">
      {/* Quiet tactical console wash — a faded engineering dot-grid plus two
          low-alpha drifting blobs. The only "color" in the chat column; content
          stays at z-10 above it. */}
      <div className="ghost-ambient ghost-ambient--page" aria-hidden>
        <div className="ghost-ambient__grid" />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--1"
          style={{
            top: 70,
            insetInlineStart: "2%",
            width: 440,
            height: 440,
            background:
              "radial-gradient(circle, rgb(96 116 132 / 0.32), transparent 70%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--3"
          style={{
            bottom: 110,
            insetInlineEnd: "2%",
            width: 480,
            height: 480,
            background:
              "radial-gradient(circle, rgb(104 116 78 / 0.26), transparent 72%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <ChatHeader
          onToggleMemory={onToggleMemory}
          onToggleKnowledge={onToggleKnowledge}
          onToggleAlert={onToggleAlert}
          onToggleTasks={onToggleTasks}
          onEditSystemPrompt={onEditSystemPrompt}
          showMemory={showMemory}
          showKnowledge={showKnowledge}
          showAlert={showAlert}
          showTasks={showTasks}
        />
        {error && <ErrorBanner message={error} onDismiss={dismissError} />}
        <MessageList />
        <LiveCameraStage />
        <Composer />
      </div>
      <CameraSelector />
    </main>
  );
}
