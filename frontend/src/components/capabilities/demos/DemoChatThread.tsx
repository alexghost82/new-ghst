import MessageBubble from "../../chat/MessageBubble";
import DemoComposer from "./DemoComposer";
import type { Message } from "../../../types/api";
import { useLanguageStore } from "../../../stores/languageStore";

// Reuses the REAL `MessageBubble` (the actual production component) with static,
// isolated demo messages — so the rendering is identical to the live chat.
function msg(partial: Partial<Message> & Pick<Message, "id" | "role" | "content">): Message {
  return {
    conversation_id: "demo",
    token_estimate: 0,
    created_at: "2026-05-31T22:14:08.000Z",
    sequence_number: 0,
    ...partial,
  };
}

interface Thread {
  user: string;
  assistant: string;
  frame: string;
  cameraLabel: string;
  composer: string;
}

const THREADS: Record<"free" | "history", Record<"en" | "he", Thread>> = {
  free: {
    en: {
      user: "Is there a bag left on the ground by the guard booth, and is anyone at the window?",
      assistant:
        "Yes. A figure in a dark hooded coat is pressed up against the guard-booth window, one bare hand flat on the glass, peering inside; their face is turned away from the lens. A dark backpack is left on the ground at the foot of the booth, leaning against the wall just behind them. The barrier arm is down across the lane and the road beyond is empty.",
      frame: "/ghost-cam-gate-night.png",
      cameraLabel: "Main Gate \u00b7 CAM-04",
      composer: "Is there a bag left on the ground by the guard booth, and is anyone at the window?",
    },
    he: {
      user: "\u05d4\u05d0\u05dd \u05d4\u05d5\u05e9\u05d0\u05e8 \u05ea\u05d9\u05e7 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4 \u05dc\u05d9\u05d3 \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8, \u05d5\u05d4\u05d0\u05dd \u05de\u05d9\u05e9\u05d4\u05d5 \u05e2\u05d5\u05de\u05d3 \u05dc\u05d9\u05d3 \u05d4\u05d7\u05dc\u05d5\u05df?",
      assistant:
        "\u05db\u05df. \u05d3\u05de\u05d5\u05ea \u05d1\u05de\u05e2\u05d9\u05dc \u05db\u05d4\u05d4 \u05e2\u05dd \u05e7\u05e4\u05d5\u05e9\u05d5\u05df \u05e6\u05de\u05d5\u05d3\u05d4 \u05dc\u05d7\u05dc\u05d5\u05df \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8, \u05db\u05e3 \u05d9\u05d3 \u05d7\u05e9\u05d5\u05e4\u05d4 \u05e6\u05de\u05d5\u05d3\u05d4 \u05dc\u05d6\u05db\u05d5\u05db\u05d9\u05ea \u05d5\u05d4\u05d9\u05d0 \u05de\u05e6\u05d9\u05e6\u05d4 \u05e4\u05e0\u05d9\u05de\u05d4; \u05d4\u05e4\u05e0\u05d9\u05dd \u05de\u05d5\u05e1\u05d8\u05d5\u05ea \u05de\u05d4\u05e2\u05d3\u05e9\u05d4. \u05ea\u05d9\u05e7 \u05d2\u05d1 \u05db\u05d4\u05d4 \u05d4\u05d5\u05e9\u05d0\u05e8 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4 \u05dc\u05de\u05e8\u05d2\u05dc\u05d5\u05ea \u05d4\u05e2\u05de\u05d3\u05d4, \u05e0\u05e9\u05e2\u05df \u05e2\u05dc \u05d4\u05e7\u05d9\u05e8 \u05de\u05d0\u05d7\u05d5\u05e8\u05d9\u05d4. \u05d6\u05e8\u05d5\u05e2 \u05d4\u05de\u05d7\u05e1\u05d5\u05dd \u05de\u05d5\u05e8\u05d3\u05ea \u05dc\u05e8\u05d5\u05d7\u05d1 \u05d4\u05e0\u05ea\u05d9\u05d1 \u05d5\u05d4\u05db\u05d1\u05d9\u05e9 \u05de\u05d0\u05d7\u05d5\u05e8 \u05e8\u05d9\u05e7.",
      frame: "/ghost-cam-gate-night.png",
      cameraLabel: "\u05e9\u05e2\u05e8 \u05e8\u05d0\u05e9\u05d9 \u00b7 CAM-04",
      composer: "\u05d4\u05d0\u05dd \u05d4\u05d5\u05e9\u05d0\u05e8 \u05ea\u05d9\u05e7 \u05e2\u05dc \u05d4\u05e8\u05e6\u05e4\u05d4 \u05dc\u05d9\u05d3 \u05e2\u05de\u05d3\u05ea \u05d4\u05e9\u05d5\u05de\u05e8, \u05d5\u05d4\u05d0\u05dd \u05de\u05d9\u05e9\u05d4\u05d5 \u05e2\u05d5\u05de\u05d3 \u05dc\u05d9\u05d3 \u05d4\u05d7\u05dc\u05d5\u05df?",
    },
  },
  history: {
    en: {
      user: "When did those boxes end up stacked in front of the emergency exit?",
      assistant:
        "The stack built up in two passes. At 21:18 the yellow forklift set down three large taped cartons against the wall beside the dock door. At 21:46 it added two more on top, and the pile now sits directly in front of the emergency-exit door, partly covering the red EXIT sign. The forklift was last left parked nose-in at the cartons at 21:52, its gas cylinder still mounted on the rear. Nothing has cleared the stack since.",
      frame: "/ghost-cam-dock-night.png",
      cameraLabel: "Loading Bay \u00b7 CAM-11",
      composer: "When did those boxes end up stacked in front of the emergency exit?",
    },
    he: {
      user: "\u05de\u05ea\u05d9 \u05d4\u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05d4\u05d0\u05dc\u05d4 \u05e0\u05e2\u05e8\u05de\u05d5 \u05de\u05d5\u05dc \u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd?",
      assistant:
        "\u05d4\u05e2\u05e8\u05d9\u05de\u05d4 \u05e0\u05d1\u05e0\u05ea\u05d4 \u05d1\u05e9\u05ea\u05d9 \u05e4\u05e2\u05de\u05d5\u05ea. \u05d1-21:18 \u05d4\u05de\u05dc\u05d2\u05d6\u05d4 \u05d4\u05e6\u05d4\u05d5\u05d1\u05d4 \u05d4\u05e0\u05d9\u05d7\u05d4 \u05e9\u05dc\u05d5\u05e9\u05d4 \u05d0\u05e8\u05d2\u05d6\u05d9 \u05e7\u05e8\u05d8\u05d5\u05df \u05d2\u05d3\u05d5\u05dc\u05d9\u05dd \u05e2\u05d8\u05d5\u05e4\u05d9 \u05e1\u05e8\u05d8 \u05dc\u05d9\u05d3 \u05d4\u05e7\u05d9\u05e8, \u05e1\u05de\u05d5\u05da \u05dc\u05d3\u05dc\u05ea \u05d4\u05e8\u05e6\u05d9\u05e3. \u05d1-21:46 \u05d4\u05d9\u05d0 \u05d4\u05d5\u05e1\u05d9\u05e4\u05d4 \u05e2\u05d5\u05d3 \u05e9\u05e0\u05d9\u05d9\u05dd \u05de\u05e2\u05dc, \u05d5\u05db\u05e2\u05ea \u05d4\u05e2\u05e8\u05d9\u05de\u05d4 \u05e2\u05d5\u05de\u05d3\u05ea \u05d1\u05d3\u05d9\u05d5\u05e7 \u05de\u05d5\u05dc \u05d3\u05dc\u05ea \u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd \u05d5\u05de\u05e1\u05ea\u05d9\u05e8\u05d4 \u05d7\u05dc\u05e7\u05d9\u05ea \u05d0\u05ea \u05e9\u05dc\u05d8 \u05d4-EXIT \u05d4\u05d0\u05d3\u05d5\u05dd. \u05d4\u05de\u05dc\u05d2\u05d6\u05d4 \u05e0\u05d5\u05ea\u05e8\u05d4 \u05dc\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4 \u05d7\u05d5\u05e0\u05d4 \u05e2\u05dd \u05d4\u05d7\u05e8\u05d8\u05d5\u05dd \u05d0\u05dc \u05d4\u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05d1-21:52, \u05db\u05e9\u05de\u05d9\u05db\u05dc \u05d4\u05d2\u05d6 \u05e2\u05d3\u05d9\u05d9\u05df \u05de\u05d5\u05e8\u05db\u05d1 \u05de\u05d0\u05d7\u05d5\u05e8. \u05d3\u05d1\u05e8 \u05dc\u05d0 \u05e4\u05d9\u05e0\u05d4 \u05d0\u05ea \u05d4\u05e2\u05e8\u05d9\u05de\u05d4 \u05de\u05d0\u05d6.",
      frame: "/ghost-cam-dock-night.png",
      cameraLabel: "\u05e8\u05e6\u05d9\u05e3 \u05e4\u05e8\u05d9\u05e7\u05d4 \u00b7 CAM-11",
      composer: "\u05de\u05ea\u05d9 \u05d4\u05d0\u05e8\u05d2\u05d6\u05d9\u05dd \u05d4\u05d0\u05dc\u05d4 \u05e0\u05e2\u05e8\u05de\u05d5 \u05de\u05d5\u05dc \u05d9\u05e6\u05d9\u05d0\u05ea \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd?",
    },
  },
};

export default function DemoChatThread({
  variant = "free",
}: {
  variant?: "free" | "history";
}) {
  const locale = useLanguageStore((s) => s.locale);
  const thread = THREADS[variant][locale];

  const userMessage = msg({ id: `${variant}-u`, role: "user", content: thread.user });
  const assistantMessage = msg({
    id: `${variant}-a`,
    role: "assistant",
    content: thread.assistant,
    camera_label: thread.cameraLabel,
  });

  return (
    <div className="flex flex-col h-full bg-ghost-bg">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-chat mx-auto">
          <MessageBubble message={userMessage} />
          <MessageBubble
            message={assistantMessage}
            sourceImageUrl={thread.frame}
            cameraLabel={thread.cameraLabel}
          />
        </div>
      </div>
      <DemoComposer value={thread.composer} />
    </div>
  );
}
