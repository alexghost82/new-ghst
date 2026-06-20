import { ScanEye, Brain, ShieldAlert, SlidersHorizontal, Languages } from "lucide-react";
import MessageBubble from "../../chat/MessageBubble";
import type { Message } from "../../../types/api";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of the "Sitelligence℠" scan: the real header
// action cluster (with the ScanEye button copied from `ChatHeader`) plus the
// resulting `site_intelligence` report rendered through the real MessageBubble.
export default function DemoSiteIntelligence() {
  const { locale } = useLanguageStore();
  const he = locale === "he";

  const userText = "Sitelligence℠ Report";
  const report = he
    ? "## Sitelligence℠ Report\n**\u05de\u05e6\u05d1 \u05db\u05dc\u05dc\u05d9:** \u05e9\u05e7\u05d8, \u05e2\u05dd \u05e9\u05e0\u05d9 \u05d3\u05d1\u05e8\u05d9\u05dd \u05e9\u05e8\u05d0\u05d5\u05d9 \u05dc\u05d1\u05d3\u05d5\u05e7.\n\n- \u05d0\u05d3\u05dd \u05d1\u05de\u05e2\u05d9\u05dc \u05db\u05d4\u05d4 \u05e2\u05d5\u05de\u05d3 \u05de\u05de\u05e9 \u05d1\u05e4\u05e0\u05d9\u05dd \u05dc\u05e9\u05e2\u05e8 \u05d4\u05e1\u05d5\u05d1\u05d1, \u05e8\u05d0\u05e9\u05d5 \u05de\u05d5\u05e8\u05db\u05df \u05de\u05e2\u05dc \u05d8\u05dc\u05e4\u05d5\u05df, \u05d5\u05d4\u05d5\u05d0 \u05dc\u05d0 \u05e2\u05d5\u05d1\u05e8 \u05d3\u05e8\u05db\u05d5 \u2014 \u05e2\u05d5\u05de\u05d3 \u05d1\u05de\u05e7\u05d5\u05dd \u05db\u05d1\u05e8 \u05db\u05de\u05d4 \u05d3\u05e7\u05d5\u05ea \u05d1\u05de\u05e7\u05d5\u05dd \u05dc\u05d4\u05e2\u05d1\u05d9\u05e8 \u05db\u05e8\u05d8\u05d9\u05e1.\n- \u05d3\u05dc\u05ea \u05d4\u05d6\u05db\u05d5\u05db\u05d9\u05ea \u05d4\u05d9\u05de\u05e0\u05d9\u05ea \u05e0\u05e9\u05e2\u05e0\u05d4 \u05e4\u05ea\u05d5\u05d7\u05d4 \u05db\u05de\u05d4 \u05e1\u05e0\u05d8\u05d9\u05de\u05d8\u05e8\u05d9\u05dd \u05d5\u05d0\u05d9\u05e0\u05d4 \u05e0\u05e0\u05e2\u05dc\u05ea, \u05db\u05da \u05e9\u05d4\u05db\u05e0\u05d9\u05e1\u05d4 \u05d0\u05d9\u05e0\u05d4 \u05d0\u05d8\u05d5\u05de\u05d4.\n\n**\u05de\u05d5\u05de\u05dc\u05e5:** \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d0\u05dd \u05d4\u05d0\u05d3\u05dd \u05de\u05de\u05ea\u05d9\u05df \u05d0\u05d5 \u05d6\u05e7\u05d5\u05e7 \u05dc\u05e2\u05d6\u05e8\u05d4, \u05d5\u05dc\u05e1\u05d2\u05d5\u05e8 \u05d0\u05ea \u05d4\u05d3\u05dc\u05ea \u05e9\u05e0\u05e9\u05d0\u05e8\u05d4 \u05e4\u05ea\u05d5\u05d7\u05d4."
    : "## Sitelligence℠ Report\n**Overall:** Quiet, with 2 things worth a look.\n\n- A man in a dark coat is standing just inside the turnstile, head down over a phone, not passing through \u2014 he's been on the spot a while rather than badging in.\n- The right-hand glass door is propped open a few inches and isn't latching, so the entrance isn't sealed.\n\n**Recommended:** Check whether the man is waiting on someone or needs help, and close the propped door.";

  const userMessage: Message = {
    id: "si-u",
    conversation_id: "demo",
    role: "user",
    content: userText,
    token_estimate: 0,
    created_at: "2026-05-31T09:02:00.000Z",
    sequence_number: 0,
    image_path: "/ghost-cam-frame.png",
  };
  const assistantMessage: Message = {
    id: "si-a",
    conversation_id: "demo",
    role: "assistant",
    content: report,
    token_estimate: 0,
    created_at: "2026-05-31T09:02:04.000Z",
    sequence_number: 1,
    camera_label: he ? "\u05de\u05e9\u05e8\u05d3 \u05e8\u05d0\u05e9\u05d9 \u00b7 CAM-02" : "Main Office \u00b7 CAM-02",
  };

  return (
    <div className="flex flex-col h-full bg-ghost-bg">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-ghost-border-subtle flex-shrink-0">
        <h1 className="text-[16px] font-semibold text-ghost-text-primary truncate">
          {he ? "\u05de\u05e9\u05e8\u05d3 \u05e8\u05d0\u05e9\u05d9" : "Main Office"}
        </h1>
        <div className="flex items-center gap-0.5">
          <span className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[13px] font-medium text-ghost-text-secondary">
            <Languages size={14} />
            <span className="uppercase tracking-wide">{he ? "EN" : "HE"}</span>
          </span>
          <span
            className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-primary bg-ghost-surface animate-pulse"
            title="Sitelligence℠"
          >
            <ScanEye size={16} />
          </span>
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
            <Brain size={16} />
          </span>
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
            <ShieldAlert size={16} />
          </span>
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary">
            <SlidersHorizontal size={16} />
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-chat mx-auto">
          <MessageBubble message={userMessage} />
          <MessageBubble
            message={assistantMessage}
            sourceImageUrl="/ghost-cam-frame.png"
            cameraLabel={assistantMessage.camera_label}
          />
        </div>
      </div>
    </div>
  );
}
