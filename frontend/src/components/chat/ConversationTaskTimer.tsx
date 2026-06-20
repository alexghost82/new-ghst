import { useEffect, useState } from "react";
import { CalendarClock, FileText } from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useTaskStore } from "../../stores/taskStore";
import { useUserStore } from "../../stores/userStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import {
  formatCountdown,
  selectActiveTaskTiming,
  taskHasReportTrigger,
} from "../../utils/taskTimer";

/** Compact banner near the conversation header showing how many tasks are
 *  active and a live countdown to the next scheduled run. Driven entirely by
 *  the task store (no extra polling beyond the one-shot hydrate), so it
 *  updates automatically when a task runs, is paused, or is deleted. Hidden
 *  when the conversation has no active tasks. */
export default function ConversationTaskTimer() {
  const t = useT();
  const locale = useLanguageStore((s) => s.locale);
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId,
  );
  const { activeUserId, sessionType } = useUserStore();
  const tasksByConv = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const [now, setNow] = useState(() => Date.now());

  const isTrial = sessionType === "trial";

  // One-shot hydrate for the open conversation so the banner shows up even if
  // the tasks panel was never opened this session.
  useEffect(() => {
    if (!activeConversationId || !activeUserId || isTrial) return;
    void fetchTasks(activeConversationId, activeUserId);
  }, [activeConversationId, activeUserId, isTrial, fetchTasks]);

  const tasks = activeConversationId
    ? (tasksByConv[activeConversationId] ?? [])
    : [];
  const { activeCount, next, nextRunAtMs } = selectActiveTaskTiming(tasks);

  // 1s ticker, only while there is something to count down. Cleaned up on
  // unmount / when the active count drops to zero (no leaked intervals).
  useEffect(() => {
    if (activeCount === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeCount]);

  if (isTrial || activeCount === 0) return null;

  const countLabel = `${activeCount} ${
    activeCount === 1
      ? t("taskTimerActiveSingular")
      : t("taskTimerActivePlural")
  }`;
  const isReport = next ? taskHasReportTrigger(next) : false;
  const countdown =
    nextRunAtMs !== null ? formatCountdown(nextRunAtMs - now) : null;
  const exactTime =
    nextRunAtMs !== null
      ? new Date(nextRunAtMs).toLocaleTimeString(
          locale === "en" ? "en-GB" : "he-IL",
          { hour: "2-digit", minute: "2-digit" },
        )
      : null;
  const nextLabel = isReport ? t("taskTimerReportType") : (next?.name ?? "");

  return (
    <div className="flex items-center gap-2 flex-wrap fade-in">
      <span className="inline-flex items-center gap-1.5 bg-ghost-surface border border-ghost-border-subtle rounded-full px-3 py-1 text-[12px] text-ghost-text-secondary">
        <CalendarClock
          size={13}
          className="text-ghost-text-muted flex-shrink-0"
        />
        <span className="font-medium text-ghost-text-primary tabular-nums">
          {countLabel}
        </span>
        {next && (
          <>
            <span className="text-ghost-text-muted/60">·</span>
            <span className="text-ghost-text-muted">{t("taskTimerNext")}:</span>
            {isReport && (
              <FileText
                size={12}
                className="text-ghost-text-muted flex-shrink-0"
              />
            )}
            <span className="truncate max-w-[160px] text-ghost-text-secondary">
              {nextLabel}
            </span>
            {countdown && (
              <span
                className="tabular-nums font-medium text-ghost-text-primary"
                dir="ltr"
              >
                {countdown}
              </span>
            )}
            {exactTime && (
              <span
                className="text-ghost-text-muted/70 tabular-nums"
                dir="ltr"
              >
                · {exactTime}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}
