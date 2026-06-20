/**
 * Ghost Expert recommendation report PDF — the light-theme Ghost line.
 *
 * Renders the 8 recommended tasks + 8 recommended alerts produced by a Ghost
 * Expert advisory session into a bright A4 document (light background, dark
 * ink) in the canonical gopdf ChatGPT-UI layout (sidebar + chat thread +
 * composer per page), via the shared ``downloadGhostPdf`` shell.
 */

import type { ExpertReport } from "../types/api";
import {
  aiMessage,
  downloadGhostPdf,
  featList,
  kicker,
  lead,
  sectionBlock,
  sectionHeading,
  toDataUrl,
  userBubble,
  type GhostPdfDoc,
} from "./ghostPdfShell";

export interface ExpertReportPdfContext {
  conversationTitle?: string | null;
  frameUrl?: string | null;
  locale?: "he" | "en";
}

const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F]/gu;

function clean(text: string): string {
  return (text || "").replace(EMOJI_RE, "").replace(/\*\*/g, "").trim();
}

export async function downloadExpertReportPdf(
  report: ExpertReport,
  ctx: ExpertReportPdfContext = {},
): Promise<void> {
  const locale = ctx.locale ?? "he";
  const en = locale === "en";
  const ghostIcon = await toDataUrl("/ghost-icon.png");

  const L = en
    ? {
        kicker: "Ghost // Expert",
        question: "Build a tailored monitoring plan for this environment.",
        tasks: "Recommended Tasks",
        tasksHe: "משימות",
        alerts: "Recommended Alerts",
        alertsHe: "התראות",
        placeholder: "Ask Ghost about this environment…",
        title: "Ghost Expert — Recommendations",
        brandSub: "Expert Advisory",
        footer: "Ghost — Expert Advisory · Draft recommendations",
        disclaimer: "Ghost — Expert Advisory",
        filename: "Ghost_Expert_Recommendations.pdf",
        scheduleLabel: "Schedule",
      }
    : {
        kicker: "Ghost // Expert",
        question: "בנה תוכנית ניטור מותאמת לסביבה הזו.",
        tasks: "Recommended Tasks",
        tasksHe: "משימות מומלצות",
        alerts: "Recommended Alerts",
        alertsHe: "התראות מומלצות",
        placeholder: "שאל את Ghost על הסביבה…",
        title: "Ghost Expert — המלצות",
        brandSub: "Expert Advisory",
        footer: "Ghost — ייעוץ Expert · המלצות טיוטה",
        disclaimer: "Ghost — Expert Advisory",
        filename: "Ghost_Expert_Recommendations.pdf",
        scheduleLabel: "תזמון",
      };

  const blocks: string[] = [];

  // 1) Operator question bubble.
  blocks.push(userBubble(L.question));

  // 2) Ghost answer intro (kicker + summary lead).
  const summary = clean(report.summary);
  const introBody =
    kicker(L.kicker) +
    (summary
      ? lead(summary)
      : lead(en ? "Tailored monitoring plan." : "תוכנית ניטור מותאמת."));
  blocks.push(aiMessage(introBody, ghostIcon));

  // 3) Tasks section.
  const taskItems = (report.tasks ?? []).map((t) => {
    const sched = clean(t.schedule_hint || "");
    const desc = clean(t.prompt || "");
    return {
      title: clean(t.name || ""),
      desc: sched ? `${desc}  ·  ${L.scheduleLabel}: ${sched}` : desc,
    };
  });
  if (taskItems.length > 0) {
    blocks.push(
      sectionBlock(sectionHeading(L.tasks, L.tasksHe) + featList(taskItems)),
    );
  }

  // 4) Alerts section.
  const alertItems = (report.alerts ?? []).map((a) => ({
    title: clean(a.description || ""),
  }));
  if (alertItems.length > 0) {
    blocks.push(
      sectionBlock(sectionHeading(L.alerts, L.alertsHe) + featList(alertItems)),
    );
  }

  const doc: GhostPdfDoc = {
    title: L.title,
    brandSub: L.brandSub,
    navItems: [
      { ix: "01", label: en ? "Overview" : "סקירה" },
      { ix: "02", label: en ? "Tasks" : "משימות" },
      { ix: "03", label: en ? "Alerts" : "התראות" },
    ],
    footerLine: L.footer,
    disclaimer: L.disclaimer,
    composerPlaceholder: L.placeholder,
    blocks,
    ghostIcon,
    filename: L.filename,
  };

  // Light theme: a bright page with dark ink, per the Expert report brief.
  await downloadGhostPdf(doc, "light");
}
