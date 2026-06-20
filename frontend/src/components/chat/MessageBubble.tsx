import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, X, Video, ShieldAlert, CalendarClock } from "lucide-react";
import type { Message } from "../../types/api";
import LoadingIndicator from "./LoadingIndicator";
import TaskReportCard from "../tasks/TaskReportCard";
import TaskReportPreparingCard from "../tasks/TaskReportPreparingCard";
import SiteReportCard from "./SiteReportCard";
import SiteScanProgressCard from "./SiteScanProgressCard";
import AutomationDraftCard from "../automations/AutomationDraftCard";
import {
  SITE_PREPARING_MARKER,
  isSiteReport,
} from "../../utils/siteReportMarker";
import { parseDocOffer, stripDocOffer } from "../../utils/docOfferMarker";
import DocOfferCard from "./DocOfferCard";
import {
  expertReportIdOf,
  isExpertPreparing,
} from "../../utils/expertReportMarker";
import ExpertReportCard from "./ExpertReportCard";
import { useLanguageStore } from "../../stores/languageStore";
import { useThemeStore } from "../../stores/themeStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useT } from "../../utils/i18n";
import { sanitizeBrand, sanitizeRefusal } from "../../utils/sanitize";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
  sourceImageUrl?: string | null;
  cameraLabel?: string | null;
}

function formatVisintTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function FrameThumbnail({
  src,
  caption,
  timestamp,
  cameraLabel,
  onExpand,
}: {
  src: string;
  caption: string;
  timestamp: string;
  cameraLabel?: string | null;
  onExpand: () => void;
}) {
  const stampTime = formatVisintTimestamp(timestamp);
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className="fade-in mb-3 ghost-visint-stage">
      <button
        type="button"
        onClick={onExpand}
        className="
          ghost-visint-frame ghost-visint-tilt
          relative block group overflow-hidden rounded-2xl
          hover:border-ghost-text-muted/60
          transition-[border-color,box-shadow] duration-[160ms]
          max-w-[820px] w-full focus:outline-none focus-visible:ring-2
          focus-visible:ring-ghost-text-secondary
        "
        aria-label={caption}
      >
        <img
          src={src}
          alt={caption}
          className="ghost-visint-image w-full h-auto block"
          draggable={false}
        />
        <span className="ghost-visint-watermark" aria-hidden="true">
          <img
            src={theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png"}
            alt=""
            draggable={false}
          />
        </span>
        <span className="ghost-visint-glare" aria-hidden="true" />
        {cameraLabel && (
          <span className="ghost-visint-camera" dir="auto">
            <Video size={11} strokeWidth={2} />
            <span className="ghost-visint-camera-name">{cameraLabel}</span>
          </span>
        )}
        {stampTime && (
          <span className="ghost-visint-stamp" dir="ltr">
            <span className="ghost-visint-stamp-time">{stampTime}</span>
          </span>
        )}
      </button>
      <div className="mt-2 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
        {caption}
      </div>
    </div>
  );
}

function FrameLightbox({
  src,
  alt,
  timestamp,
  onClose,
}: {
  src: string;
  alt: string;
  timestamp?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const stampTime = timestamp ? formatVisintTimestamp(timestamp) : "";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="
        fixed inset-0 z-50 bg-black/80 backdrop-blur-sm
        flex items-center justify-center p-6 sm:p-10
        fade-in cursor-zoom-out
      "
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="
          absolute top-4 end-4 w-9 h-9 rounded-full
          bg-ghost-surface/80 hover:bg-ghost-surface-hover
          border border-ghost-border-subtle
          text-ghost-text-primary
          flex items-center justify-center
          transition-colors duration-[100ms]
          z-10
        "
        aria-label="Close preview"
      >
        <X size={16} />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="
          flex flex-col items-center gap-3
          max-w-full max-h-full cursor-default
        "
      >
        <div
          className="
            ghost-visint-frame
            relative block overflow-hidden rounded-2xl
            shadow-2xl
          "
        >
          <img
            src={src}
            alt={alt}
            className="
              ghost-visint-image
              block max-w-full max-h-[78vh] object-contain
            "
            draggable={false}
          />
          {stampTime && (
            <span className="ghost-visint-stamp" dir="ltr">
              <span className="ghost-visint-stamp-time">{stampTime}</span>
            </span>
          )}
        </div>
        <div className="text-[12px] text-white/85">{alt}</div>
      </div>
    </div>
  );
}

function CodeBlock({
  language,
  children,
}: {
  language: string | undefined;
  children: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const theme = useThemeStore((s) => s.theme);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden my-2" dir="ltr">
      <div
        className="flex items-center justify-between px-4 py-1.5 text-xs text-ghost-text-muted"
        style={{ background: "var(--ghost-code-header)" }}
      >
        <span>{language || t("text")}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-ghost-text-muted hover:text-ghost-text-secondary transition-colors duration-[100ms]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      <SyntaxHighlighter
        style={theme === "dark" ? oneDark : oneLight}
        language={language || "text"}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: "var(--ghost-code-bg)",
          fontSize: "13px",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ALERT_PREFIX = "\u26a0\ufe0f \u05d4\u05ea\u05e8\u05d0\u05d4 \u05d6\u05d5\u05d4\u05ea\u05d4!";

function isAlertMessage(content: string): boolean {
  return content.startsWith(ALERT_PREFIX);
}

// Sentinel prefix on user messages sent automatically by a scheduled task.
// Kept in sync with ``_TASK_MSG_MARKER`` in backend chat_service.py.
const TASK_MSG_MARKER = "[[GHOST_TASK_MSG]]";

function isTaskMessage(content: string): boolean {
  return content.startsWith(TASK_MSG_MARKER);
}

function stripTaskMarker(content: string): string {
  return content.slice(TASK_MSG_MARKER.length).replace(/^\s+/, "");
}

// Sentinel prefix on assistant report-card messages created when a 'report'
// task trigger matched. Kept in sync with ``TASK_REPORT_MARKER`` in backend
// task_service.py.
const TASK_REPORT_RE = /^\[\[GHOST_TASK_REPORT:([0-9a-fA-F-]+)\]\]/;

function taskReportIdOf(content: string): string | null {
  const match = TASK_REPORT_RE.exec(content);
  return match ? match[1] : null;
}

// Client-only transient marker for a report being generated. Kept in sync with
// ``TASK_PREPARING_PREFIX`` in frontend/src/stores/messageStore.ts.
const TASK_PREPARING_RE =
  /^\[\[GHOST_TASK_PREPARING:([0-9a-fA-F-]+):(pending|failed)\]\]/;

function taskPreparingOf(
  content: string,
): { taskId: string; status: "pending" | "failed" } | null {
  const match = TASK_PREPARING_RE.exec(content);
  return match
    ? { taskId: match[1], status: match[2] as "pending" | "failed" }
    : null;
}

// Sentinel prefix on the assistant message that hosts the conversational
// automation draft widget. Kept in sync with ``AUTOMATION_DRAFT_MARKER`` in
// backend automation_service.py.
const AUTOMATION_DRAFT_RE = /^\[\[GHOST_AUTOMATION_DRAFT:([0-9a-fA-F]+)\]\]/;

function automationDraftIdOf(content: string): string | null {
  const match = AUTOMATION_DRAFT_RE.exec(content);
  return match ? match[1] : null;
}

// Sentinel emitted by the backend tech-probe lockdown. When an assistant
// reply starts with this marker, the bubble is rendered as a red
// "classified information leak" warning. Kept in sync with
// ``_SECURITY_MARKER`` in backend/app/services/chat_service.py.
const SECURITY_MARKER = "[[GHOST_SECURITY_BLOCK]]";

function isSecurityWarning(content: string): boolean {
  return content.startsWith(SECURITY_MARKER);
}

function stripSecurityMarker(content: string): string {
  return content.slice(SECURITY_MARKER.length).replace(/^\s+/, "");
}

interface ParsedAlert {
  matchedRule: string | null;
  description: string | null;
  timestamp: string | null;
  taskName: string | null;
}

function parseAlertContent(content: string): ParsedAlert {
  const result: ParsedAlert = {
    matchedRule: null,
    description: null,
    timestamp: null,
    taskName: null,
  };

  const ruleMatch = content.match(/🔍\s*(?:שורת התראה|Matched rule)[:\s]*(.+)/);
  if (ruleMatch) result.matchedRule = ruleMatch[1].trim();

  const descMatch = content.match(/📝\s*(?:תיאור|Description)[:\s]*(.+)/);
  if (descMatch) result.description = descMatch[1].trim();

  const timeMatch = content.match(/🕐\s*(?:זמן|Time)[:\s]*(.+)/);
  if (timeMatch) result.timestamp = timeMatch[1].trim();

  // Present only on alerts fired by a scheduled-task trigger.
  const taskMatch = content.match(/📌\s*(?:משימה|Task)[:\s]*(.+)/);
  if (taskMatch) result.taskName = taskMatch[1].trim();

  return result;
}

function AlertCardContent({
  parsed,
  imagePath,
  frameCaption,
  onExpandImage,
}: {
  parsed: ParsedAlert;
  imagePath?: string | null;
  frameCaption: string;
  onExpandImage: () => void;
}) {
  const t = useT();
  return (
    <div className="ghost-alert-card-chat ghost-alert-border-glow">
      <div className="ghost-soc-titlebar">
        <div className="ghost-soc-titlebar__lead">
          <span className="ghost-soc-titlebar__icon" aria-hidden>
            <ShieldAlert size={12} strokeWidth={2} />
          </span>
          <span className="ghost-soc-titlebar__title">
            {t("alertCardEventLabel")}
          </span>
          <span className="ghost-soc-titlebar__sys">
            {t("alertCardSystem")}
          </span>
        </div>
        <span className="ghost-soc-titlebar__meta">
          <span className="ghost-alert-dot" aria-hidden />
          {t("alertCardLive")}
        </span>
      </div>

      <div className="ghost-soc-body">
        {parsed.taskName && (
          <div className="ghost-soc-section">
            <div className="ghost-soc-section__head">
              <span className="ghost-soc-section__label">
                <span className="ghost-soc-section__indicator" aria-hidden />
                {t("taskAlertTag")}
              </span>
              <span className="ghost-soc-section__rule" aria-hidden />
              <span className="ghost-soc-section__chip">TASK // AUTO</span>
            </div>
            <div className="ghost-soc-panel ghost-soc-rule">
              {parsed.taskName}
            </div>
          </div>
        )}
        {imagePath && (
          <div className="ghost-soc-section">
            <div className="ghost-soc-section__head">
              <span className="ghost-soc-section__label">
                <span className="ghost-soc-section__indicator" aria-hidden />
                {t("alertCardCameraFeed")}
              </span>
              <span className="ghost-soc-section__rule" aria-hidden />
              <span className="ghost-soc-section__chip">
                {t("alertCardCameraTag")}
              </span>
            </div>
            <button
              type="button"
              onClick={onExpandImage}
              className="ghost-soc-viewport ghost-alert-scanline"
              aria-label={frameCaption}
              dir="ltr"
            >
              <img
                src={imagePath}
                alt={frameCaption}
                className="ghost-soc-viewport__img"
                draggable={false}
              />
              <span
                className="ghost-soc-viewport__bracket ghost-soc-viewport__bracket--tl"
                aria-hidden
              />
              <span
                className="ghost-soc-viewport__bracket ghost-soc-viewport__bracket--tr"
                aria-hidden
              />
              <span
                className="ghost-soc-viewport__bracket ghost-soc-viewport__bracket--bl"
                aria-hidden
              />
              <span
                className="ghost-soc-viewport__bracket ghost-soc-viewport__bracket--br"
                aria-hidden
              />
              <span className="ghost-soc-viewport__rec">
                <span className="ghost-soc-viewport__rec-dot" aria-hidden />
                {t("alertCardRec")}
              </span>
              {parsed.timestamp && (
                <span className="ghost-soc-viewport__time">
                  {parsed.timestamp}
                </span>
              )}
            </button>
          </div>
        )}

        {parsed.matchedRule && (
          <div className="ghost-soc-section">
            <div className="ghost-soc-section__head">
              <span className="ghost-soc-section__label ghost-soc-section__label--emphasis">
                <span
                  className="ghost-soc-section__indicator ghost-soc-section__indicator--bright"
                  aria-hidden
                />
                {t("alertCardRule")}
              </span>
              <span className="ghost-soc-section__rule" aria-hidden />
            </div>
            <div className="ghost-soc-panel ghost-soc-rule">
              {parsed.matchedRule}
            </div>
          </div>
        )}

        {parsed.description && (
          <div className="ghost-soc-section">
            <div className="ghost-soc-section__head">
              <span className="ghost-soc-section__label ghost-soc-section__label--emphasis">
                <span
                  className="ghost-soc-section__indicator ghost-soc-section__indicator--bright"
                  aria-hidden
                />
                {t("alertCardAiAnalysis")}
              </span>
              <span className="ghost-soc-section__rule" aria-hidden />
            </div>
            <div className="ghost-soc-panel ghost-soc-analysis">
              <span className="ghost-soc-analysis__bullet" aria-hidden>
                ▸
              </span>
              <span className="ghost-soc-analysis__text">
                {parsed.description}
                <span className="ghost-soc-analysis__caret" aria-hidden />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="ghost-soc-footer" dir="ltr">
        <span className="ghost-soc-footer__cell">
          <span
            className="ghost-soc-footer__dot ghost-soc-footer__dot--live"
            aria-hidden
          />
          <span>{t("alertCardSignal")}</span>
        </span>
        <span className="ghost-soc-footer__cell">
          <span className="ghost-soc-footer__dot" aria-hidden />
          <span>{t("alertCardSeverity")}</span>
        </span>
        {parsed.timestamp && (
          <span className="ghost-soc-footer__cell ghost-soc-footer__cell--grow ghost-soc-footer__cell--mono">
            {parsed.timestamp}
          </span>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  streamingContent,
  sourceImageUrl,
  cameraLabel,
}: MessageBubbleProps) {
  const [showTime, setShowTime] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore(
    (s) => s.activeConversationId,
  );
  const isUser = message.role === "user";
  const uiDir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);
  const textAlign = uiDir === "rtl" ? "right" : "left";
  // Final render-layer guard (defense-in-depth): never let a refusal or the
  // raw brand name reach the DOM, for streaming OR persisted assistant text.
  // User-typed content is left verbatim (refusal patterns must not rewrite it).
  const rawContent = isStreaming ? streamingContent || "" : message.content;
  const content = isUser
    ? rawContent
    : sanitizeRefusal(sanitizeBrand(rawContent), locale);

  // A self/usage answer may carry a trailing doc-offer marker. Strip it from
  // the displayed text and render a download card beneath the answer.
  const docOfferIds = !isUser ? parseDocOffer(content) : null;
  const displayContent = docOfferIds ? stripDocOffer(content) : content;

  const isAlert = !isUser && isAlertMessage(content);
  const parsedAlert = isAlert ? parseAlertContent(content) : null;
  const isSecurity = !isUser && isSecurityWarning(content);
  const isTaskMsg = isUser && isTaskMessage(content);
  const taskReportId = !isUser ? taskReportIdOf(content) : null;
  const taskPreparing = !isUser ? taskPreparingOf(content) : null;
  const automationDraftId = !isUser ? automationDraftIdOf(content) : null;
  const expertReportId = !isUser ? expertReportIdOf(content) : null;
  const expertPreparing = !isUser && isExpertPreparing(content);
  const siteReport = !isUser && isSiteReport(content);
  const sitePreparing =
    !isUser && content.startsWith(SITE_PREPARING_MARKER)
      ? {
          status: content.includes(":failed")
            ? ("failed" as const)
            : ("pending" as const),
        }
      : null;
  const userAlign = isUser ? "justify-end" : "justify-start";
  const showSourceFrame =
    !isUser &&
    !!sourceImageUrl &&
    !isAlert &&
    !isSecurity &&
    !taskReportId &&
    !taskPreparing &&
    !siteReport &&
    !sitePreparing &&
    !automationDraftId &&
    !expertReportId &&
    !expertPreparing;
  const showAlertFrame = isAlert && !!message.image_path;
  const frameCaption = isAlert ? t("alertFrameCaption") : t("capturedFrame");
  const resolvedCameraLabel = cameraLabel ?? message.camera_label ?? null;

  // Conversation name shown above every Ghost reply. Streaming placeholders
  // carry an empty conversation_id, so fall back to the active conversation.
  const conversationTitle =
    conversations.find(
      (c) => c.id === (message.conversation_id || activeConversationId),
    )?.title ?? null;
  const showSenderLabel =
    !isUser &&
    !isAlert &&
    !isSecurity &&
    !taskReportId &&
    !taskPreparing &&
    !siteReport &&
    !sitePreparing &&
    !automationDraftId &&
    !expertReportId &&
    !expertPreparing &&
    !!conversationTitle;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(
        isTaskMsg ? stripTaskMarker(message.content) : message.content,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission);
      // fail silently rather than disrupting the operator.
    }
  };

  return (
    <div
      className={`fade-in flex ${userAlign} mb-4`}
      dir={uiDir}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {!isUser && (
        <div
          className={`flex-shrink-0 w-8 h-8 me-3 ${
            showSenderLabel ? "mt-1" : "mt-1.5"
          }`}
        >
          <img
            src={theme === "light" ? "/ghost-icon-light.png" : "/ghost-icon.png"}
            alt="Ghost"
            className="ghost-brand-icon w-8 h-8 object-contain flex-shrink-0 rounded-[7px]"
            draggable={false}
          />
        </div>
      )}
      <div
        className={`relative ${
          isUser
            ? "max-w-[70%] bg-ghost-surface rounded-3xl rounded-ee-lg px-[18px] py-3"
            : isAlert || taskReportId || taskPreparing || siteReport || sitePreparing || expertPreparing
              ? "max-w-[420px]"
              : automationDraftId || expertReportId
                ? "max-w-[460px]"
                : "max-w-full flex-1"
        }`}
      >
        {showSenderLabel && (
          <div className="flex items-center gap-2 mb-1.5 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
              Ghost
            </span>
            <span className="w-1 h-1 rounded-full bg-ghost-text-muted/50 flex-shrink-0" />
            <span className="inline-flex items-center gap-1 text-[12px] text-ghost-text-muted truncate">
              {resolvedCameraLabel && <Video size={11} className="flex-shrink-0" />}
              <span className="truncate">
                {conversationTitle}
                {resolvedCameraLabel ? ` (${resolvedCameraLabel})` : ""}
              </span>
            </span>
          </div>
        )}
        {showSourceFrame && (
          <FrameThumbnail
            src={sourceImageUrl!}
            caption={frameCaption}
            timestamp={message.created_at}
            cameraLabel={resolvedCameraLabel}
            onExpand={() => setLightboxOpen(true)}
          />
        )}

        {isUser ? (
          <div>
            {isTaskMsg && (
              <span className="inline-flex items-center gap-1.5 mb-1.5 px-2 py-0.5 rounded-full bg-ghost-bg/60 border border-ghost-border-subtle">
                <CalendarClock size={10} className="text-ghost-text-muted" />
                <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted">
                  TASK · AUTO
                </span>
                <span className="text-[11px] text-ghost-text-muted">
                  {t("taskAutoBadge")}
                </span>
              </span>
            )}
            <p
              className="text-body text-ghost-text-primary whitespace-pre-wrap"
              dir={uiDir}
              style={{ textAlign }}
            >
              {isTaskMsg ? stripTaskMarker(content) : content}
            </p>
          </div>
        ) : isStreaming && !content ? (
          <LoadingIndicator />
        ) : sitePreparing ? (
          <SiteScanProgressCard status={sitePreparing.status} />
        ) : siteReport ? (
          <SiteReportCard
            content={content}
            messageId={message.id}
            conversationId={message.conversation_id || activeConversationId || ""}
          />
        ) : taskPreparing ? (
          <TaskReportPreparingCard status={taskPreparing.status} />
        ) : taskReportId ? (
          <TaskReportCard
            reportId={taskReportId}
            conversationId={message.conversation_id || activeConversationId || ""}
            fallbackContent={content}
          />
        ) : automationDraftId ? (
          <AutomationDraftCard
            draftId={automationDraftId}
            conversationId={message.conversation_id || activeConversationId || ""}
          />
        ) : expertPreparing ? (
          <div className="flex items-center gap-3 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/50 px-4 py-3">
            <span className="ghost-scan-sweep w-5 h-5 rounded-full border-2 border-ghost-border-subtle border-t-ghost-text-secondary animate-spin" />
            <span className="text-[13px] text-ghost-text-secondary">
              {t("expertOverlayThinkingTitle")}
            </span>
          </div>
        ) : expertReportId ? (
          <ExpertReportCard
            reportId={expertReportId}
            conversationId={message.conversation_id || activeConversationId || ""}
          />
        ) : isAlert && parsedAlert ? (
          <AlertCardContent
            parsed={parsedAlert}
            imagePath={showAlertFrame ? message.image_path : null}
            frameCaption={frameCaption}
            onExpandImage={() => setLightboxOpen(true)}
          />
        ) : isSecurity ? (
          <div className="ghost-security-warning" dir={uiDir} style={{ textAlign }}>
            <div className="ghost-security-warning__header">
              <span className="ghost-security-warning__badge" aria-hidden>
                <ShieldAlert size={13} strokeWidth={2.25} />
              </span>
              <span className="ghost-security-warning__label font-mono">
                {t("securityLeakWarningLabel")}
              </span>
              <span className="ghost-security-warning__rule" aria-hidden />
            </div>
            <div className="ghost-security-warning__body message-markdown text-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {stripSecurityMarker(content)}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div
            className="message-markdown text-body text-ghost-text-primary"
            dir={uiDir}
            style={{ textAlign }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");
                  const isInline = !className && !codeString.includes("\n");

                  if (isInline) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock language={match?.[1]}>
                      {codeString}
                    </CodeBlock>
                  );
                },
              }}
            >
              {displayContent}
            </ReactMarkdown>
            {docOfferIds && !isStreaming && <DocOfferCard docIds={docOfferIds} />}
          </div>
        )}

        {showTime && !isStreaming && (
          <div
            className={`absolute -bottom-6 flex items-center gap-1 ${
              isUser ? "end-0" : "start-0"
            }`}
          >
            {isUser && (
              <button
                type="button"
                onClick={handleCopyMessage}
                aria-label={copied ? t("copied") : t("copyMessage")}
                title={copied ? t("copied") : t("copyMessage")}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[120ms] focus:outline-none focus-visible:ring-1 focus-visible:ring-ghost-text-secondary"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}
            <span className="text-xs text-ghost-text-muted leading-6">
              {formatTime(message.created_at)}
            </span>
          </div>
        )}
      </div>

      {(showSourceFrame || showAlertFrame) && lightboxOpen && (
        <FrameLightbox
          src={(showAlertFrame ? message.image_path : sourceImageUrl)!}
          alt={frameCaption}
          timestamp={message.created_at}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

// Memoized: the message list can hold hundreds of bubbles; without this every
// new token / list change re-renders all of them (each runs markdown + syntax
// highlighting). Re-render only when this bubble's own props change.
export default memo(MessageBubble);
