/**
 * Task-report PDF generator — Ghost gopdf dark brand line.
 *
 * Produces a branded operational report (not a raw chat export) in the
 * canonical gopdf ChatGPT-UI style (sidebar + chat thread + composer per page):
 * an operator question, a Ghost answer carrying the full conversation-path
 * context (area / group / conversation / camera(s) / task), the alert summary,
 * the camera evidence still, and the detailed reply. Rendered client-side via
 * the shared {@link downloadGhostPdf} shell so the embedded Heebo web-font
 * guarantees consistent Hebrew/RTL output regardless of the host environment.
 */

import {
  aiMessage,
  downloadGhostPdf,
  evidenceFigure,
  fieldCell,
  fieldGrid,
  kicker,
  lead,
  paragraph,
  sectionBlock,
  sectionHeading,
  toDataUrl,
  userBubble,
  type GhostPdfDoc,
} from "./ghostPdfShell";
import type { TaskReport } from "../types/api";

/** Extra conversation-path context, resolved on the client (areas/groups and
 *  camera labels live in client stores, not on the report row). All optional
 *  — every field degrades gracefully when absent. */
export interface ReportPdfContext {
  area?: string | null;
  group?: string | null;
  conversationTitle?: string | null;
  cameraNames?: string[];
  taskName?: string | null;
  taskType?: string | null;
  scheduleSummary?: string | null;
  locale?: "he" | "en";
}

/** Render and download the report as ``Ghost_Reporting_Alert_<id>.pdf``. */
export async function downloadTaskReportPdf(
  report: TaskReport,
  context: ReportPdfContext = {},
): Promise<void> {
  const locale = context.locale ?? "he";

  const [ghostIcon, frame] = await Promise.all([
    toDataUrl("/ghost-icon.png"),
    report.frame_path ? toDataUrl(report.frame_path) : Promise.resolve(null),
  ]);

  const createdAt = new Date(report.created_at);
  const validDate = !Number.isNaN(createdAt.getTime());
  const stamp = validDate
    ? createdAt.toLocaleString(locale === "en" ? "en-GB" : "he-IL")
    : report.created_at;
  const year = (validDate ? createdAt : new Date()).getFullYear();

  const L =
    locale === "en"
      ? {
          kicker: "Ghost // Reporting Alert",
          question: "A reporting-alert task triggered — give me the report.",
          summary: "Summary",
          summaryHe: "סיכום",
          context: "Context",
          contextHe: "הקשר",
          evidence: "Evidence",
          evidenceHe: "תיעוד",
          detail: "Detail",
          detailHe: "פירוט",
          placeholder: "Ask Ghost about this alert…",
          title: "Reporting Alert",
          headline: "Reporting Alert",
        }
      : {
          kicker: "Ghost // Reporting Alert",
          question: "משימת דיווח הופעלה — תן לי את הדוח.",
          summary: "Summary",
          summaryHe: "סיכום",
          context: "Context",
          contextHe: "הקשר",
          evidence: "Evidence",
          evidenceHe: "תיעוד",
          detail: "Detail",
          detailHe: "פירוט",
          placeholder: "שאל את Ghost על ההתראה…",
          title: "Reporting Alert",
          headline: "התראת דיווח",
        };

  const taskName = context.taskName || report.task_name || "";
  const cameras = (context.cameraNames ?? []).filter(Boolean);
  const cameraValue =
    cameras.length > 0 ? cameras.join(", ") : report.camera_label || "";

  const summary = (report.summary || "").trim();
  const replyExcerpt = (report.reply_text || "").trim().slice(0, 1200);
  const replyTruncated = (report.reply_text || "").length > 1200;

  const blocks: string[] = [];

  // 1) Operator question bubble.
  blocks.push(userBubble(L.question));

  // 2) Ghost answer: headline + context grid.
  const headlineText = taskName
    ? `${L.headline} — ${taskName}`
    : L.headline;
  const contextCells = [
    fieldCell("Area", "אזור", context.area || ""),
    fieldCell("Group", "קבוצה", context.group || ""),
    fieldCell("Conversation", "שיחה", context.conversationTitle || ""),
    fieldCell("Camera", "מצלמה", cameraValue),
    fieldCell("Task", "משימה", taskName),
    fieldCell("Type", "סוג", context.taskType || ""),
    fieldCell("Schedule", "תזמון", context.scheduleSummary || ""),
    fieldCell("Trigger", "טריגר", report.matched_phrase || ""),
    fieldCell("Generated", "הופק", stamp),
  ];
  blocks.push(
    aiMessage(
      kicker(L.kicker) +
        lead(headlineText) +
        sectionHeading(L.context, L.contextHe) +
        fieldGrid(contextCells),
      ghostIcon,
    ),
  );

  // 3) Summary.
  if (summary) {
    blocks.push(
      sectionBlock(
        sectionHeading(L.summary, L.summaryHe) + paragraph(summary),
      ),
    );
  }

  // 4) Evidence.
  if (frame) {
    blocks.push(
      sectionBlock(
        sectionHeading(L.evidence, L.evidenceHe) +
          evidenceFigure(
            frame,
            `CAM // FRAME${cameraValue ? ` · ${cameraValue}` : ""}`,
            stamp,
          ),
      ),
    );
  }

  // 5) Detailed reply.
  if (replyExcerpt) {
    blocks.push(
      sectionBlock(
        sectionHeading(L.detail, L.detailHe) +
          paragraph(replyExcerpt + (replyTruncated ? " …" : "")),
      ),
    );
  }

  const refId = report.id.slice(0, 8);
  const doc: GhostPdfDoc = {
    title: L.title,
    brandSub: "Reporting Alert",
    navItems: [
      { ix: "01", label: "Context" },
      { ix: "02", label: "Summary" },
      { ix: "03", label: "Evidence" },
    ],
    footerLine: `Reporting Alert · ${year} · REF ${refId}`,
    disclaimer: "Ghost — Sovereign Visual Intelligence Infrastructure",
    composerPlaceholder: L.placeholder,
    blocks,
    ghostIcon,
    filename: `Ghost_Reporting_Alert_${refId}.pdf`,
  };

  await downloadGhostPdf(doc);
}
