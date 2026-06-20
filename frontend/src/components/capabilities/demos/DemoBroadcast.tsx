import { Radio, Video, X } from "lucide-react";
import MessageBubble from "../../chat/MessageBubble";
import DemoComposer from "./DemoComposer";
import type { Message } from "../../../types/api";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of `components/chat/BroadcastChatArea.tsx` — the
// scope header + message list (real MessageBubble) + composer, copied 1:1 with
// static data, for asking a whole area/group at once.
export default function DemoBroadcast() {
  const { locale } = useLanguageStore();
  const he = locale === "he";

  const scopeName = he ? "\u05d7\u05e6\u05e8 \u05e6\u05e4\u05d5\u05e0\u05d9\u05ea" : "North Yard";
  const scopeType = he ? "\u05d0\u05d6\u05d5\u05e8" : "Area";
  const camsLabel = he ? "3 \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8" : "3 cameras in zone";
  const question = he
    ? "\u05d1\u05db\u05dc \u05d4\u05d7\u05e6\u05e8, \u05d4\u05d0\u05dd \u05de\u05e9\u05d4\u05d5 \u05d7\u05d5\u05e1\u05dd \u05d3\u05dc\u05ea, \u05d9\u05e6\u05d9\u05d0\u05d4 \u05d0\u05d5 \u05d0\u05ea \u05d4\u05de\u05d7\u05e1\u05d5\u05dd?"
    : "Anywhere in the yard, is something left blocking a door, exit, or the barrier?";
  const answer = he
    ? "\u05e1\u05e8\u05e7\u05ea\u05d9 \u05d0\u05ea \u05e9\u05dc\u05d5\u05e9 \u05d4\u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05d1\u05d7\u05e6\u05e8 \u05d4\u05e6\u05e4\u05d5\u05e0\u05d9\u05ea:\n\n- **\u05e9\u05e2\u05e8 \u05e8\u05d0\u05e9\u05d9:** \u05d6\u05e8\u05d5\u05e2 \u05d4\u05de\u05d7\u05e1\u05d5\u05dd \u05de\u05d5\u05e8\u05d3\u05ea \u05d5\u05d4\u05e0\u05ea\u05d9\u05d1 \u05e4\u05e0\u05d5\u05d9, \u05d0\u05da \u05ea\u05d9\u05e7 \u05d2\u05d1 \u05db\u05d4\u05d4 \u05d4\u05d5\u05e9\u05d0\u05e8 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4 \u05dc\u05d9\u05d3 \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8.\n- **\u05e9\u05e2\u05e8 \u05e6\u05d3\u05d3\u05d9:** \u05e4\u05e0\u05d5\u05d9 \u2014 \u05e9\u05d5\u05dd \u05d3\u05d1\u05e8 \u05dc\u05d0 \u05d7\u05d5\u05e1\u05dd \u05d0\u05ea \u05d3\u05dc\u05ea \u05d4\u05d4\u05d5\u05dc\u05db\u05d9 \u05e8\u05d2\u05dc.\n- **\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4:** \u05e2\u05e8\u05d9\u05de\u05ea \u05d0\u05e8\u05d2\u05d6\u05d9 \u05e7\u05e8\u05d8\u05d5\u05df \u05e2\u05d8\u05d5\u05e4\u05d9 \u05e1\u05e8\u05d8 \u05d3\u05d7\u05d5\u05e4\u05d4 \u05d0\u05dc \u05d3\u05dc\u05ea \u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd \u05d5\u05de\u05e1\u05ea\u05d9\u05e8\u05d4 \u05d7\u05dc\u05e7\u05d9\u05ea \u05d0\u05ea \u05e9\u05dc\u05d8 \u05d4-EXIT \u05d4\u05d0\u05d3\u05d5\u05dd."
    : "I checked all 3 cameras in North Yard:\n\n- **Main Gate:** Barrier arm is down and the lane is clear, but a dark backpack is left on the ground beside the guard booth.\n- **Side Gate:** Clear \u2014 nothing blocking the pedestrian door.\n- **Loading Bay:** A stack of taped cardboard boxes is pushed up against the emergency-exit door, partly covering the red EXIT sign.";

  const userMessage: Message = {
    id: "bc-u",
    conversation_id: "demo",
    role: "user",
    content: question,
    token_estimate: 0,
    created_at: "2026-05-31T22:20:00.000Z",
    sequence_number: 0,
  };
  const assistantMessage: Message = {
    id: "bc-a",
    conversation_id: "demo",
    role: "assistant",
    content: answer,
    token_estimate: 0,
    created_at: "2026-05-31T22:20:05.000Z",
    sequence_number: 1,
  };

  return (
    <div className="flex flex-col h-full bg-ghost-bg">
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle flex-shrink-0">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-ghost-text-secondary flex-shrink-0">
          <X size={18} />
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-ghost-surface flex items-center justify-center text-ghost-text-primary">
            <Radio size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[14px] font-semibold text-ghost-text-primary truncate">
                {scopeName}
              </span>
              <span className="flex-shrink-0 text-[11px] font-medium text-ghost-text-muted px-1.5 py-0.5 rounded-full border border-ghost-border-subtle">
                {scopeType}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[12px] text-ghost-text-muted">
              <Video size={11} aria-hidden="true" />
              <span>{camsLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-chat mx-auto">
          <MessageBubble message={userMessage} />
          <MessageBubble message={assistantMessage} />
        </div>
      </div>

      <DemoComposer
        value={question}
        placeholder={he ? "\u05e9\u05dc\u05d7 \u05dc\u05db\u05dc \u05d4\u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8" : "Message all cameras in zone"}
      />
    </div>
  );
}
