import { Plus, Trash2 } from "lucide-react";
import MessageBubble from "../../chat/MessageBubble";
import type { Message } from "../../../types/api";
import { useLanguageStore } from "../../../stores/languageStore";

// Faithful, isolated replica of the per-conversation alerts experience:
// the `AlertModePanel` toggle + rules card (copied 1:1) on one side, and the
// resulting SOC alert card rendered through the real MessageBubble on the other.
//
// The alert message content uses the exact prefix/markers the real system emits
// so `MessageBubble` renders its genuine `AlertCardContent`.
const ALERT_PREFIX = "\u26a0\ufe0f \u05d4\u05ea\u05e8\u05d0\u05d4 \u05d6\u05d5\u05d4\u05ea\u05d4!";

export default function DemoAlerts() {
  const { locale } = useLanguageStore();
  const he = locale === "he";

  const L = he
    ? {
        title: "\u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4",
        on: "\u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4 \u05e4\u05e2\u05d9\u05dc",
        desc: "Ghost \u05e1\u05d5\u05e8\u05e7 \u05d0\u05ea \u05d4\u05de\u05e6\u05dc\u05de\u05d4 \u05d1\u05e8\u05e6\u05d9\u05e4\u05d5\u05ea \u05d5\u05de\u05ea\u05e8\u05d9\u05e2 \u05e8\u05e7 \u05db\u05e9\u05d0\u05d7\u05d3 \u05d4\u05db\u05dc\u05dc\u05d9\u05dd \u05de\u05ea\u05de\u05dc\u05d0.",
        rules: "\u05db\u05dc\u05dc\u05d9 \u05d4\u05ea\u05e8\u05d0\u05d4",
        addPlaceholder: "\u05ea\u05d0\u05e8 \u05de\u05d4 \u05dc\u05d7\u05e4\u05e9...",
        rule1: "מישהו שנצמד לחלון עמדת השומר או מתעסק עם מנעול השער אחרי רדת החשכה — לא סתם עובר ליד",
        rule2: "תיק, ארגז או חבילה שהושארו ללא השגחה על הרצפה ליד השער או עמדת השומר",
        rule3: "משטחים, ארגזים או קרטונים שנערמים במקום שחוסם את זרוע המחסום או יציאת חירום",
      }
    : {
        title: "Alert mode",
        on: "Alert mode is on",
        desc: "Ghost scans the camera continuously and alerts only when one of your rules is met.",
        rules: "Alert rules",
        addPlaceholder: "Describe what to watch for...",
        rule1: "Someone pressed against the guard-booth window or working at the gate lock after dark — not just walking past",
        rule2: "A bag, box, or package left unattended on the ground by the gate or guard booth",
        rule3: "Pallets, crates, or boxes stacked where they block the barrier arm or an emergency exit",
      };

  const alertContent = he
    ? `${ALERT_PREFIX}\n\uD83D\uDD0D שורת התראה: ${L.rule1}\n\uD83D\uDCDD תיאור: דמות במעיל כהה עם קפושון נצמדת לחלון עמדת השומר, כף יד חשופה צמודה לזכוכית והיא מציצה פנימה; תיק גב כהה הושאר נטוש על הרצפה למרגלות העמדה.\n\uD83D\uDD50 זמן: 2026-05-31 22:47:13`
    : `${ALERT_PREFIX}\n\uD83D\uDD0D Matched rule: ${L.rule1}\n\uD83D\uDCDD Description: A figure in a dark hooded coat is pressed against the guard-booth window, one bare hand flat on the glass, peering inside; a dark backpack sits abandoned on the ground at the foot of the booth.\n\uD83D\uDD50 Time: 2026-05-31 22:47:13`;

  const alertMessage: Message = {
    id: "al-a",
    conversation_id: "demo",
    role: "assistant",
    content: alertContent,
    token_estimate: 0,
    created_at: "2026-05-31T22:47:13.000Z",
    sequence_number: 0,
    image_path: "/ghost-cam-gate-night.png",
  };

  const Rule = ({ text }: { text: string }) => (
    <li className="group flex items-start gap-3 rounded-xl border border-ghost-border-subtle bg-ghost-surface px-4 py-3.5">
      <span className="flex-shrink-0 w-12 h-7 rounded-full relative bg-ghost-error mt-0.5" dir="ltr">
        <span className="absolute top-0.5 end-0.5 w-6 h-6 bg-white rounded-full shadow" />
      </span>
      <p className="flex-1 min-w-0 text-body text-ghost-text-primary leading-relaxed break-words">
        {text}
      </p>
      <span className="flex-shrink-0 inline-flex items-center justify-center text-ghost-text-muted">
        <Trash2 size={18} />
      </span>
    </li>
  );

  return (
    <div className="grid grid-cols-1 gap-4 p-4 bg-ghost-bg-secondary" dir={he ? "rtl" : "ltr"}>
      {/* Alert mode panel (copied from AlertModePanel) */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-ghost-error/40 bg-ghost-error/5 px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-body text-ghost-text-primary font-semibold leading-snug">
                {L.on}
              </p>
              <p className="text-small text-ghost-text-secondary leading-relaxed">
                {L.desc}
              </p>
            </div>
            <span className="flex-shrink-0 w-14 h-8 rounded-full relative bg-ghost-error mt-0.5" dir="ltr">
              <span className="absolute top-0.5 end-0.5 w-7 h-7 bg-white rounded-full shadow" />
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-small font-semibold uppercase tracking-wide text-ghost-text-secondary">
              {L.rules}
            </h3>
            <span className="text-body font-semibold text-ghost-text-muted tabular-nums">3</span>
          </div>
          <div className="flex items-stretch gap-2.5 mb-4">
            <div className="flex-1 min-h-[48px] bg-ghost-surface border border-ghost-border-subtle rounded-xl px-4 py-3 text-body text-ghost-text-muted">
              {L.addPlaceholder}
            </div>
            <span className="min-w-[48px] min-h-[48px] px-4 rounded-xl bg-ghost-accent text-white flex items-center justify-center">
              <Plus size={20} />
            </span>
          </div>
          <ul className="space-y-3">
            <Rule text={L.rule1} />
            <Rule text={L.rule2} />
            <Rule text={L.rule3} />
          </ul>
        </div>
      </div>

      {/* Resulting alert in chat (real MessageBubble → AlertCardContent) */}
      <div className="rounded-2xl bg-ghost-bg border border-ghost-border-subtle p-4 flex items-start">
        <MessageBubble message={alertMessage} />
      </div>
    </div>
  );
}
