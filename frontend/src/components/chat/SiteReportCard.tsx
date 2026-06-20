import { useMemo, useState } from "react";
import { Download, FileText, Loader2, ScanEye, Video } from "lucide-react";
import { useLanguageStore } from "../../stores/languageStore";
import { useMessageStore } from "../../stores/messageStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useLiveStore } from "../../stores/liveStore";
import { assignmentFor } from "../../utils/conversationGroups";
import { useT } from "../../utils/i18n";
import { stripSiteReportMarker } from "../../utils/siteReportMarker";
import {
  downloadSiteReportPdf,
  type SiteReportPdfContext,
} from "../../utils/siteReportPdf";

interface SiteReportCardProps {
  /** Full assistant message content (still carrying the report marker). */
  content: string;
  /** Id of the assistant message hosting this report. */
  messageId: string;
  conversationId: string;
}

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F]/gu;

/** A short, human-readable brief drawn from the report body — used as the card
 *  preview (the full structured report lives in the downloadable PDF). */
function briefOf(reportText: string): string {
  const body = stripSiteReportMarker(reportText)
    .replace(EMOJI_RE, "")
    .replace(/\*\*/g, "");
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/חלק\s*[אב]'?/.test(l) &&
        !/part\s*[ab]/i.test(l) &&
        !/^\d+\.\s/.test(l),
    );
  // Prefer the first descriptive bullet/sentence over the boilerplate opener.
  const descriptive =
    lines.find((l) => l.startsWith("- ") || l.startsWith("• ")) ?? lines[0] ?? "";
  const clean = descriptive.replace(/^[-•]\s*/, "");
  return clean.length > 200 ? `${clean.slice(0, 200).trim()}…` : clean;
}

export default function SiteReportCard({
  content,
  messageId,
  conversationId,
}: SiteReportCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);

  const messages = useMessageStore((s) => s.messages);
  const conversations = useConversationStore((s) => s.conversations);
  const groupAreas = useConversationGroupsStore((s) => s.areas);
  const groupGroups = useConversationGroupsStore((s) => s.groups);
  const savedCameras = useLiveStore((s) => s.savedCameras);
  const [downloading, setDownloading] = useState(false);

  // The analysed still lives on the user message that precedes this report.
  const { frameUrl, createdAt } = useMemo(() => {
    const idx = messages.findIndex((m) => m.id === messageId);
    let frame: string | null = null;
    if (idx >= 0) {
      for (let i = idx; i >= 0; i--) {
        if (messages[i].role === "user" && messages[i].image_path) {
          frame = messages[i].image_path ?? null;
          break;
        }
      }
    }
    const created = idx >= 0 ? messages[idx].created_at : null;
    return { frameUrl: frame, createdAt: created };
  }, [messages, messageId]);

  const pdfContext = useMemo<SiteReportPdfContext>(() => {
    const assignment = assignmentFor(conversationId, {
      areas: groupAreas,
      groups: groupGroups,
    });
    const area = assignment.areaId
      ? (groupAreas.find((a) => a.id === assignment.areaId)?.name ?? null)
      : null;
    const group = assignment.groupId
      ? (groupGroups.find((g) => g.id === assignment.groupId)?.name ?? null)
      : null;
    const conv = conversations.find((c) => c.id === conversationId);
    const cams = (savedCameras[conversationId] ?? [])
      .map((c) => c.label)
      .filter(Boolean);
    return {
      area,
      group,
      conversationTitle: conv?.title ?? null,
      cameraNames: cams,
      frameUrl,
      createdAt,
      refId: conversationId,
      locale,
    };
  }, [
    conversationId,
    conversations,
    groupAreas,
    groupGroups,
    savedCameras,
    frameUrl,
    createdAt,
    locale,
  ]);

  const brief = useMemo(() => briefOf(content), [content]);
  const timestamp = createdAt ? new Date(createdAt).toLocaleString() : null;

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadSiteReportPdf(content, pdfContext);
    } catch (err) {
      console.error("[siteReport] PDF download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="max-w-[420px] rounded-2xl border border-ghost-border-subtle bg-ghost-surface/60 overflow-hidden"
      dir={dir}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle/60">
        <FileText size={14} className="text-ghost-text-secondary flex-shrink-0" />
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {t("siteReportCardTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          Ghost // Sitelligence
        </span>
      </div>

      {(pdfContext.area ||
        pdfContext.group ||
        pdfContext.conversationTitle ||
        (pdfContext.cameraNames?.length ?? 0) > 0) && (
        <div className="px-4 pt-2.5 flex flex-col gap-1">
          {(pdfContext.area ||
            pdfContext.group ||
            pdfContext.conversationTitle) && (
            <div className="flex items-center gap-1 flex-wrap text-[11px] text-ghost-text-muted min-w-0">
              {[pdfContext.area, pdfContext.group, pdfContext.conversationTitle]
                .filter(Boolean)
                .map((seg, i, arr) => (
                  <span
                    key={`${i}-${seg}`}
                    className="inline-flex items-center gap-1 min-w-0"
                  >
                    <span className="truncate max-w-[140px]">{seg}</span>
                    {i < arr.length - 1 && (
                      <span className="text-ghost-text-muted/60">›</span>
                    )}
                  </span>
                ))}
            </div>
          )}
          {(pdfContext.cameraNames?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-ghost-text-muted">
              <Video size={11} className="flex-shrink-0" />
              <span className="truncate" dir="ltr">
                {(pdfContext.cameraNames ?? []).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {frameUrl && (
        <div className="px-4 pt-3">
          <div className="rounded-xl overflow-hidden border border-ghost-border-subtle ghost-visint-frame">
            <img
              src={frameUrl}
              alt={t("siteReportCardTitle")}
              className="ghost-visint-image w-full h-auto block"
              draggable={false}
            />
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <ScanEye
            size={13}
            className="text-ghost-text-secondary flex-shrink-0"
          />
          <span className="text-[12.5px] font-medium text-ghost-text-primary">
            {t("siteReportReady")}
          </span>
        </div>
        {brief && (
          <p className="text-[13px] text-ghost-text-secondary leading-relaxed">
            {brief}
          </p>
        )}
        {timestamp && (
          <p className="text-[12px] text-ghost-text-muted tabular-nums" dir="ltr">
            {timestamp}
          </p>
        )}
      </div>

      <div className="px-4 pb-3.5">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-xl bg-ghost-accent text-ghost-bg text-[13px] font-semibold hover:opacity-90 transition-opacity duration-[100ms] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {downloading ? t("siteReportDownloading") : t("siteReportDownload")}
        </button>
      </div>
    </div>
  );
}
