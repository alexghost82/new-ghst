/**
 * Sitelligence report PDF generator — Ghost gopdf dark brand line.
 *
 * Parses the structured Sitelligence℠ report text (produced by the backend
 * SITE_INTELLIGENCE_SYSTEM prompt) into a clean, paginated A4 document rendered
 * in the canonical gopdf ChatGPT-UI style (sidebar + chat thread + composer per
 * page). Emojis from the source headings are stripped per the gopdf "no emoji"
 * rule and replaced with brand mono labels; the full report becomes the
 * downloadable deliverable instead of a long chat bubble.
 */

import {
  SITE_REPORT_MARKER,
  stripSiteReportMarker,
} from "./siteReportMarker";
import {
  aiMessage,
  downloadGhostPdf,
  esc,
  evidenceFigure,
  featList,
  fieldGrid,
  fieldCell,
  kicker,
  lead,
  paragraph,
  sectionBlock,
  sectionHeading,
  toDataUrl,
  userBubble,
  type GhostPdfDoc,
} from "./ghostPdfShell";

export interface SiteReportPdfContext {
  area?: string | null;
  group?: string | null;
  conversationTitle?: string | null;
  cameraNames?: string[];
  /** Saved frame path / data URL for the analysed still. */
  frameUrl?: string | null;
  /** ISO timestamp of the scan. */
  createdAt?: string | null;
  /** Short id used in the filename + reference footer. */
  refId?: string | null;
  locale?: "he" | "en";
}

interface Point {
  title: string;
  desc: string;
}
interface SubSection {
  title: string;
  note: string;
  points: Point[];
}
interface Part {
  he: string;
  en: string;
  note: string;
  subs: SubSection[];
}
interface ParsedReport {
  intro: string[];
  parts: Part[];
}

// Strip pictographic emoji (keeps ℠, letters, punctuation, Hebrew).
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\uFE0F]/gu;

function cleanLine(line: string): string {
  return line.replace(EMOJI_RE, "").replace(/\s+$/g, "");
}

function isPartA(line: string): boolean {
  return /חלק\s*א'?/.test(line) || /part\s*a/i.test(line);
}
function isPartB(line: string): boolean {
  return /חלק\s*ב'?/.test(line) || /part\s*b/i.test(line);
}

function splitPoint(content: string): Point {
  const idx = content.indexOf(": ");
  if (idx > 0 && idx <= 42) {
    return {
      title: content.slice(0, idx).trim(),
      desc: content.slice(idx + 2).trim(),
    };
  }
  return { title: content.trim(), desc: "" };
}

function parseReport(raw: string): ParsedReport {
  const text = stripSiteReportMarker(raw);
  const lines = text.split("\n");
  const intro: string[] = [];
  const parts: Part[] = [];

  let part: Part | null = null;
  let sub: SubSection | null = null;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Part headers.
    if (isPartA(trimmed) && /sitelligence|עומק|environment/i.test(trimmed)) {
      part = {
        he: "ניתוח עומק סביבתי",
        en: "PART A · SITELLIGENCE REPORT",
        note: "",
        subs: [],
      };
      parts.push(part);
      sub = null;
      continue;
    }
    if (isPartB(trimmed)) {
      part = {
        he: "נהלי עבודה ומודיעין",
        en: "PART B · OPERATIONAL & SECURITY RULES",
        note: "",
        subs: [],
      };
      parts.push(part);
      sub = null;
      continue;
    }

    // Subsection heading: **N. Title**
    const subMatch = trimmed.match(/^\*\*\s*(.+?)\s*\*\*$/);
    if (subMatch && part) {
      sub = { title: subMatch[1].trim(), note: "", points: [] };
      part.subs.push(sub);
      continue;
    }

    // Bullet (top-level or nested).
    if (/^[-•]\s+/.test(trimmed) || /^\s{2,}[-•]\s+/.test(line)) {
      const nested = /^\s{2,}[-•]\s+/.test(line);
      const content = trimmed.replace(/^[-•]\s+/, "");
      if (!part) {
        intro.push(content);
        continue;
      }
      if (!sub) {
        sub = { title: "", note: "", points: [] };
        part.subs.push(sub);
      }
      if (nested && sub.points.length > 0) {
        const last = sub.points[sub.points.length - 1];
        last.desc = last.desc ? `${last.desc} · ${content}` : content;
      } else {
        sub.points.push(splitPoint(content));
      }
      continue;
    }

    // Plain paragraph.
    if (!part) {
      intro.push(trimmed);
    } else if (sub) {
      sub.note = sub.note ? `${sub.note} ${trimmed}` : trimmed;
    } else {
      part.note = part.note ? `${part.note} ${trimmed}` : trimmed;
    }
  }

  return { intro, parts };
}

function subHeadingHtml(title: string): string {
  if (!title) return "";
  const dir = /[\u0590-\u05ff]/.test(title) ? "rtl" : "ltr";
  return `<div class="gp-subhead" dir="${dir}">${esc(title)}</div>`;
}

/** Render and download a Sitelligence report as a gopdf-dark PDF. */
export async function downloadSiteReportPdf(
  reportText: string,
  ctx: SiteReportPdfContext = {},
): Promise<void> {
  const locale = ctx.locale ?? "he";
  const parsed = parseReport(reportText);

  const [ghostIcon, frame] = await Promise.all([
    toDataUrl("/ghost-icon.png"),
    ctx.frameUrl ? toDataUrl(ctx.frameUrl) : Promise.resolve(null),
  ]);

  const createdAt = ctx.createdAt ? new Date(ctx.createdAt) : new Date();
  const validDate = !Number.isNaN(createdAt.getTime());
  const stamp = validDate
    ? createdAt.toLocaleString(locale === "en" ? "en-GB" : "he-IL")
    : "";
  const year = (validDate ? createdAt : new Date()).getFullYear();

  const L =
    locale === "en"
      ? {
          kicker: "Ghost // Sitelligence Report",
          question: "Generate a full Sitelligence report for this scene.",
          context: "Context",
          contextHe: "הקשר",
          evidence: "Evidence",
          evidenceHe: "תיעוד",
          placeholder: "Ask Ghost about this scene…",
          title: "Sitelligence Report",
        }
      : {
          kicker: "Ghost // Sitelligence Report",
          question: "הפק דוח Sitelligence מלא לזירה הנוכחית.",
          context: "Context",
          contextHe: "הקשר",
          evidence: "Evidence",
          evidenceHe: "תיעוד",
          placeholder: "שאל את Ghost על הזירה…",
          title: "Sitelligence Report",
        };

  const cameras = (ctx.cameraNames ?? []).filter(Boolean);
  const cameraValue = cameras.join(", ");

  const blocks: string[] = [];

  // 1) Operator question bubble.
  blocks.push(userBubble(L.question));

  // 2) Ghost answer intro (kicker + lead + remaining intro paragraphs).
  const introLead = parsed.intro[0] ?? "";
  const introRest = parsed.intro.slice(1);
  const introBody =
    kicker(L.kicker) +
    (introLead ? lead(introLead) : "") +
    introRest.map((p) => paragraph(p)).join("");
  blocks.push(aiMessage(introBody, ghostIcon));

  // 3) Context block.
  const contextCells = [
    fieldCell("Area", "אזור", ctx.area || ""),
    fieldCell("Group", "קבוצה", ctx.group || ""),
    fieldCell("Conversation", "שיחה", ctx.conversationTitle || ""),
    fieldCell("Camera", "מצלמה", cameraValue),
    fieldCell("Generated", "הופק", stamp),
    fieldCell(
      "Engine",
      "מנוע",
      locale === "en" ? "Sitelligence Engine" : "מנוע Sitelligence",
    ),
  ];
  const contextGrid = fieldGrid(contextCells);
  if (contextGrid) {
    blocks.push(
      sectionBlock(
        sectionHeading(L.context, L.contextHe) + contextGrid,
      ),
    );
  }

  // 4) Evidence block.
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

  // 5) Report sections — each subsection is one block (part heading travels
  //    with its first subsection so headings never orphan at a page bottom).
  for (const part of parsed.parts) {
    part.subs.forEach((s, si) => {
      const head =
        si === 0 ? sectionHeading(part.en, part.he) : "";
      const note =
        si === 0 && part.note ? paragraph(part.note) : "";
      const subNote = s.note ? paragraph(s.note) : "";
      const points =
        s.points.length > 0 ? featList(s.points) : "";
      blocks.push(
        sectionBlock(head + note + subHeadingHtml(s.title) + subNote + points),
      );
    });
  }

  const refId = (ctx.refId || "").slice(0, 8);
  const doc: GhostPdfDoc = {
    title: L.title,
    brandSub: "Sitelligence Report",
    navItems: [
      { ix: "01", label: locale === "en" ? "Overview" : "Overview" },
      {
        ix: "02",
        label: locale === "en" ? "Environment Scan" : "Environment Scan",
      },
      {
        ix: "03",
        label: locale === "en" ? "Operational Rules" : "Operational Rules",
      },
    ],
    footerLine: `Sitelligence Report · ${year}`,
    disclaimer: "Ghost — Sovereign Visual Intelligence Infrastructure",
    composerPlaceholder: L.placeholder,
    blocks,
    ghostIcon,
    filename: `Ghost_Sitelligence_${refId || "report"}.pdf`,
  };

  // Light theme per brand request: a bright page with dark ink.
  await downloadGhostPdf(doc, "light");
}

export { SITE_REPORT_MARKER };
