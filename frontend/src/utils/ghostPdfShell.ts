/**
 * Ghost PDF shell — the canonical "gopdf" black-and-white ChatGPT-UI design
 * line, ported to a client-side renderer.
 *
 * Every page is a single ChatGPT screen: sidebar (brand + nav) on the left, a
 * main column with a top bar, a chat thread (operator question bubbles + Ghost
 * answers with the bare Ghost icon as avatar), and a decorative composer pinned
 * to the bottom. Strict monochrome (gopdf dark tokens), no color, no emoji.
 *
 * The shell handles variable-length content by measuring each thread block in
 * the live DOM and packing the blocks into fixed A4 pages, so each rendered
 * page is a complete, self-contained screen (its own sidebar + composer).
 * Rendered with html2pdf.js (html2canvas + jsPDF) in the operator's browser so
 * the embedded Heebo web-font guarantees consistent Hebrew/RTL output.
 */

import html2pdf from "html2pdf.js";

// ── gopdf dark tokens (verbatim from .cursor/skills/gopdf) ───────────────────
const DARK_T = {
  bgPrimary: "#212121",
  bgSidebar: "#171717",
  bgSurface: "#2f2f2f",
  bgSurfaceHover: "#3a3a3a",
  bgCode: "#1e1e1e",
  bgFaint: "rgba(255,255,255,0.02)",
  textPrimary: "#ececec",
  textSecondary: "#b4b4b4",
  textMuted: "#767676",
  borderSubtle: "#3a3a3a",
  accent: "#ececec",
  accentInk: "#171717",
} as const;

// ── Light variant (Ghost light palette) — a bright page with dark ink. Used
// by the Ghost Expert recommendation report ("light background, dark objects").
const LIGHT_T = {
  bgPrimary: "#ffffff",
  bgSidebar: "#f9f9f9",
  bgSurface: "#f4f4f4",
  bgSurfaceHover: "#ececec",
  bgCode: "#f4f4f4",
  bgFaint: "#fafafa",
  textPrimary: "#0d0d0d",
  textSecondary: "#4a4a4a",
  textMuted: "#8a8a8a",
  borderSubtle: "#e5e5e5",
  accent: "#0d0d0d",
  accentInk: "#ffffff",
} as const;

type GhostPdfTokens = Record<keyof typeof DARK_T, string>;
export type GhostPdfTheme = "dark" | "light";

/** Default (dark) tokens — kept exported for callers that style inline. */
export const T = DARK_T;

export const FONT_SANS =
  '"Heebo", ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_MONO =
  'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

// A4 portrait at 96dpi.
const PAGE_W = 794; // 210mm
// Exactly one A4 page tall at the same aspect. html2pdf slices the rendered
// canvas into pages of height ``floor(width * 297/210)``; if a .gp-page is even
// a sub-pixel taller it overflows and spills a BLANK trailing page. Pinning the
// page height to that exact slice keeps one screen == one PDF page.
const PAGE_H = Math.floor((PAGE_W * 297) / 210); // 1122
const SIDEBAR_W = 242; // 64mm
const TOPBAR_H = 53;
const THREAD_PAD_X = 28;
const THREAD_PAD_TOP = 26;
const THREAD_PAD_BOTTOM = 8;
const COMPOSER_AREA = 96;
const BLOCK_GAP = 22;

// Usable content width of the thread column, and the height available for
// thread blocks on a single page (leaving room for topbar + composer).
const CONTENT_W = PAGE_W - SIDEBAR_W - THREAD_PAD_X * 2;
const AVAIL_H =
  PAGE_H - TOPBAR_H - THREAD_PAD_TOP - THREAD_PAD_BOTTOM - COMPOSER_AREA - 8;

// ── Small text helpers ───────────────────────────────────────────────────────
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** RTL when the value contains Hebrew, else LTR — keeps camera names / ids /
 *  timestamps aligned LTR even inside a Hebrew document. */
export function dirOf(value: string): "rtl" | "ltr" {
  return /[\u0590-\u05ff]/.test(value) ? "rtl" : "ltr";
}

export async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Reusable thread blocks (callers compose these into a doc) ─────────────────

/** Operator question bubble (right-aligned). */
export function userBubble(text: string): string {
  return `<div class="gp-msg-user"><div class="gp-bubble" dir="${dirOf(text)}">${esc(text)}</div></div>`;
}

/** A Ghost answer: bare icon avatar + body html. Use for the opening turn. */
export function aiMessage(bodyHtml: string, icon: string | null): string {
  const av = icon
    ? `<div class="gp-av"><img src="${icon}" alt="Ghost" /></div>`
    : `<div class="gp-av"></div>`;
  return `<div class="gp-msg-ai">${av}<div class="gp-body">${bodyHtml}</div></div>`;
}

/** A continued report section (no avatar) — reads as the answer flowing on. */
export function sectionBlock(bodyHtml: string): string {
  return `<div class="gp-section"><div class="gp-body">${bodyHtml}</div></div>`;
}

export function kicker(label: string): string {
  return `<div class="gp-kicker" dir="ltr">${esc(label)}</div>`;
}

export function lead(text: string, dimText?: string): string {
  const dim = dimText
    ? ` <span class="gp-dim">${esc(dimText)}</span>`
    : "";
  return `<p class="gp-lead" dir="${dirOf(text)}">${esc(text)}${dim}</p>`;
}

export function paragraph(text: string): string {
  return `<p class="gp-p" dir="${dirOf(text)}">${esc(text)}</p>`;
}

/** Bilingual mono section heading: "PART A // ניתוח" over a hairline. */
export function sectionHeading(labelEn: string, labelHe?: string): string {
  const he = labelHe
    ? `<span class="gp-sh-he" dir="rtl">${esc(labelHe)}</span>`
    : "";
  return `<div class="gp-sh"><span class="gp-sh-en" dir="ltr">${esc(labelEn)}</span>${he}<span class="gp-sh-rule"></span></div>`;
}

/** A bordered list of titled points (gopdf .feat). */
export function featList(
  items: { title: string; desc?: string }[],
): string {
  const rows = items
    .map(
      (it) =>
        `<li><span class="gp-dot"></span><div><div class="gp-ft-t" dir="${dirOf(it.title)}">${esc(it.title)}</div>${
          it.desc
            ? `<div class="gp-ft-d" dir="${dirOf(it.desc)}">${esc(it.desc)}</div>`
            : ""
        }</div></li>`,
    )
    .join("");
  return `<ul class="gp-feat">${rows}</ul>`;
}

/** A single labelled context cell. Returns "" for empty values. */
export function fieldCell(
  labelEn: string,
  labelHe: string,
  value: string,
): string {
  if (!value.trim()) return "";
  return `<div class="gp-cell">
    <div class="gp-cell-l" dir="ltr">${esc(labelEn)} // ${esc(labelHe)}</div>
    <div class="gp-cell-v" dir="${dirOf(value)}">${esc(value)}</div>
  </div>`;
}

/** A 2-col grid of context cells. */
export function fieldGrid(cells: string[]): string {
  const inner = cells.filter(Boolean).join("");
  if (!inner) return "";
  return `<div class="gp-grid">${inner}</div>`;
}

/** A framed camera still with a mono caption (the "Evidence" component). */
export function evidenceFigure(
  frameDataUrl: string,
  captionLeft: string,
  captionRight: string,
): string {
  return `<figure class="gp-fig">
    <img src="${frameDataUrl}" alt="frame" />
    <figcaption>
      <span class="gp-fig-cap" dir="ltr">${esc(captionLeft)}</span>
      <span class="gp-fig-cap" dir="ltr">${esc(captionRight)}</span>
    </figcaption>
  </figure>`;
}

// ── Shell CSS (scoped under .ghostpdf) ───────────────────────────────────────
function shellCss(T: GhostPdfTokens, invertIcon: boolean): string {
  const iconFilter = invertIcon ? "filter:invert(1);" : "";
  return `
  .ghostpdf, .ghostpdf * { margin:0; padding:0; box-sizing:border-box; }
  /* The page chrome is a fixed LTR ChatGPT layout (sidebar always on the left);
     only the text nodes carry per-element dir="rtl". Force LTR here so the shell
     is never mirrored when generated from a Hebrew (dir="rtl") host document. */
  .ghostpdf { font-family:${FONT_SANS}; color:${T.textPrimary}; direction:ltr; text-align:left; -webkit-font-smoothing:antialiased; }
  .ghostpdf [dir="rtl"] { text-align:right; }
  .ghostpdf .gp-page {
    width:${PAGE_W}px; height:${PAGE_H}px; background:${T.bgPrimary};
    display:flex; overflow:hidden; position:relative; page-break-after:always;
  }
  .ghostpdf .gp-page:last-child { page-break-after:auto; }

  /* sidebar */
  .ghostpdf .gp-sidebar {
    width:${SIDEBAR_W}px; flex-shrink:0; background:${T.bgSidebar};
    border-right:1px solid ${T.borderSubtle};
    display:flex; flex-direction:column; padding:16px 12px; gap:8px;
  }
  .ghostpdf .gp-brand { display:flex; align-items:center; gap:10px; padding:6px 6px 14px; }
  .ghostpdf .gp-brand img { width:30px; height:30px; border-radius:9px; display:block; ${iconFilter} }
  .ghostpdf .gp-brand .gp-name { font-size:15px; font-weight:600; color:${T.textPrimary}; letter-spacing:0.01em; }
  .ghostpdf .gp-brand .gp-sub { display:block; font-family:${FONT_MONO}; font-size:9px; font-weight:400; color:${T.textMuted}; letter-spacing:0.14em; text-transform:uppercase; margin-top:2px; }
  .ghostpdf .gp-newchat { display:flex; align-items:center; gap:10px; height:40px; padding:0 12px; border:1px solid ${T.borderSubtle}; border-radius:12px; color:${T.textSecondary}; font-size:13px; }
  .ghostpdf .gp-plus { position:relative; width:14px; height:14px; flex-shrink:0; }
  .ghostpdf .gp-plus::before, .ghostpdf .gp-plus::after { content:""; position:absolute; background:${T.textSecondary}; }
  .ghostpdf .gp-plus::before { left:6px; top:0; width:2px; height:14px; border-radius:2px; }
  .ghostpdf .gp-plus::after { top:6px; left:0; height:2px; width:14px; border-radius:2px; }
  .ghostpdf .gp-nav-label { font-size:11px; font-weight:600; color:${T.textMuted}; padding:14px 10px 4px; letter-spacing:0.02em; }
  .ghostpdf .gp-nav-item { display:flex; align-items:center; gap:9px; height:36px; padding:0 11px; border-radius:11px; font-size:12px; color:${T.textSecondary}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ghostpdf .gp-nav-item .gp-ix { font-family:${FONT_MONO}; font-size:10px; color:${T.textMuted}; width:16px; }
  .ghostpdf .gp-nav-item.gp-active { background:${T.bgSurface}; color:${T.textPrimary}; }
  .ghostpdf .gp-nav-item.gp-active .gp-ix { color:${T.textPrimary}; }
  .ghostpdf .gp-spacer { flex:1; }
  .ghostpdf .gp-foot { border-top:1px solid ${T.borderSubtle}; padding:12px 10px 2px; font-size:10.5px; color:${T.textMuted}; line-height:1.5; }
  .ghostpdf .gp-foot b { color:${T.textSecondary}; font-weight:600; }

  /* main column */
  .ghostpdf .gp-main { flex:1; display:flex; flex-direction:column; min-width:0; }
  .ghostpdf .gp-topbar { height:${TOPBAR_H}px; flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-bottom:1px solid ${T.borderSubtle}; }
  .ghostpdf .gp-topbar .gp-title { font-size:14px; font-weight:600; color:${T.textPrimary}; }
  .ghostpdf .gp-topbar .gp-meta { font-family:${FONT_MONO}; font-size:11px; color:${T.textMuted}; letter-spacing:0.04em; }
  .ghostpdf .gp-thread { flex:1; overflow:hidden; padding:${THREAD_PAD_TOP}px ${THREAD_PAD_X}px ${THREAD_PAD_BOTTOM}px; display:flex; flex-direction:column; }
  .ghostpdf .gp-wrap { width:100%; display:flex; flex-direction:column; gap:${BLOCK_GAP}px; }

  /* user bubble */
  .ghostpdf .gp-msg-user { display:flex; justify-content:flex-end; }
  .ghostpdf .gp-bubble { max-width:80%; background:${T.bgSurface}; color:${T.textPrimary}; border-radius:20px; padding:11px 16px; font-size:14px; line-height:1.55; }

  /* assistant */
  .ghostpdf .gp-msg-ai { display:flex; gap:14px; }
  .ghostpdf .gp-av { width:28px; height:28px; border-radius:8px; flex-shrink:0; overflow:hidden; margin-top:2px; }
  .ghostpdf .gp-av img { width:100%; height:100%; display:block; ${iconFilter} }
  .ghostpdf .gp-body { flex:1; min-width:0; }
  .ghostpdf .gp-section { display:block; }
  .ghostpdf .gp-p { font-size:14px; line-height:1.75; color:${T.textPrimary}; }
  .ghostpdf .gp-p + .gp-p { margin-top:12px; }
  .ghostpdf .gp-lead { font-size:21px; font-weight:600; letter-spacing:-0.01em; line-height:1.25; }
  .ghostpdf .gp-lead .gp-dim { color:${T.textSecondary}; font-weight:500; }
  .ghostpdf .gp-kicker { font-family:${FONT_MONO}; font-size:10px; color:${T.textMuted}; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:10px; }

  /* section heading */
  .ghostpdf .gp-sh { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
  .ghostpdf .gp-sh-en { font-family:${FONT_MONO}; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; color:${T.textMuted}; white-space:nowrap; }
  .ghostpdf .gp-sh-he { font-size:12px; color:${T.textMuted}; white-space:nowrap; }
  .ghostpdf .gp-sh-rule { flex:1; height:1px; background:${T.borderSubtle}; }
  .ghostpdf .gp-subhead { font-size:14px; font-weight:700; color:${T.textPrimary}; line-height:1.45; margin-bottom:8px; }

  /* feat list */
  .ghostpdf .gp-feat { list-style:none; display:flex; flex-direction:column; }
  .ghostpdf .gp-feat li { padding:11px 0; border-bottom:1px solid ${T.borderSubtle}; display:flex; gap:13px; align-items:flex-start; }
  .ghostpdf .gp-feat li:last-child { border-bottom:none; }
  .ghostpdf .gp-dot { width:6px; height:6px; border-radius:50%; background:${T.textPrimary}; margin-top:8px; flex-shrink:0; }
  .ghostpdf .gp-ft-t { font-size:13.5px; font-weight:600; color:${T.textPrimary}; line-height:1.45; }
  .ghostpdf .gp-ft-d { font-size:12.5px; color:${T.textSecondary}; line-height:1.55; margin-top:3px; }

  /* context grid */
  .ghostpdf .gp-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .ghostpdf .gp-cell { border:1px solid ${T.borderSubtle}; border-radius:12px; padding:11px 14px; background:${T.bgFaint}; }
  .ghostpdf .gp-cell-l { font-family:${FONT_MONO}; font-size:9px; letter-spacing:0.16em; text-transform:uppercase; color:${T.textMuted}; margin-bottom:5px; }
  .ghostpdf .gp-cell-v { font-size:13px; line-height:1.5; color:${T.textPrimary}; word-break:break-word; }

  /* evidence figure */
  .ghostpdf .gp-fig { border:1px solid ${T.borderSubtle}; border-radius:12px; overflow:hidden; }
  .ghostpdf .gp-fig img { display:block; width:100%; height:auto; }
  .ghostpdf .gp-fig figcaption { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 12px; background:${T.bgSurface}; border-top:1px solid ${T.borderSubtle}; }
  .ghostpdf .gp-fig-cap { font-family:${FONT_MONO}; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:${T.textMuted}; }

  /* composer */
  .ghostpdf .gp-composer-wrap { padding:8px 28px 18px; flex-shrink:0; }
  .ghostpdf .gp-composer { background:${T.bgSurface}; border:1px solid ${T.borderSubtle}; border-radius:24px; padding:11px 12px 11px 18px; display:flex; align-items:center; gap:12px; }
  .ghostpdf .gp-composer .gp-ph { flex:1; font-size:13.5px; color:${T.textMuted}; }
  .ghostpdf .gp-send { width:30px; height:30px; border-radius:50%; background:${T.accent}; flex-shrink:0; position:relative; }
  .ghostpdf .gp-send::after { content:""; position:absolute; left:50%; top:52%; width:8px; height:8px; border-top:2px solid ${T.accentInk}; border-right:2px solid ${T.accentInk}; transform:translate(-50%,-50%) rotate(-45deg); }
  .ghostpdf .gp-disclaimer { margin:8px auto 0; text-align:center; font-family:${FONT_MONO}; font-size:9px; letter-spacing:0.12em; text-transform:uppercase; color:${T.textMuted}; }
  `;
}

// ── Document model ───────────────────────────────────────────────────────────
export interface NavItem {
  ix: string;
  label: string;
}

export interface GhostPdfDoc {
  /** Topbar title (left). */
  title: string;
  /** Sidebar brand sub-label, e.g. "Sitelligence Report". */
  brandSub: string;
  /** Sidebar nav items (the section list). The active item per page is chosen
   *  automatically by which section is most represented on that page; falls
   *  back to index. */
  navItems: NavItem[];
  /** Sidebar footer second line. */
  footerLine: string;
  /** Bottom disclaimer line. */
  disclaimer: string;
  /** Composer placeholder text. */
  composerPlaceholder: string;
  /** Ordered thread blocks (built via the block helpers above). */
  blocks: string[];
  /** Inlined Ghost icon (data URL). */
  ghostIcon: string | null;
  /** Output filename. */
  filename: string;
}

function sidebarHtml(doc: GhostPdfDoc, activeIx: number): string {
  const icon = doc.ghostIcon
    ? `<img src="${doc.ghostIcon}" alt="Ghost" />`
    : "";
  const nav = doc.navItems
    .map(
      (n, i) =>
        `<div class="gp-nav-item${i === activeIx ? " gp-active" : ""}"><span class="gp-ix">${esc(n.ix)}</span><span>${esc(n.label)}</span></div>`,
    )
    .join("");
  return `<aside class="gp-sidebar">
    <div class="gp-brand">${icon}<div class="gp-name">Ghost<span class="gp-sub">${esc(doc.brandSub)}</span></div></div>
    <div class="gp-newchat"><span class="gp-plus"></span><span>New conversation</span></div>
    <div class="gp-nav-label">Sections</div>
    ${nav}
    <div class="gp-spacer"></div>
    <div class="gp-foot"><b>Confidential</b><br />${esc(doc.footerLine)}</div>
  </aside>`;
}

function pageHtml(
  doc: GhostPdfDoc,
  blocks: string[],
  pageIndex: number,
  total: number,
  activeIx: number,
): string {
  return `<div class="gp-page">
    ${sidebarHtml(doc, activeIx)}
    <div class="gp-main">
      <div class="gp-topbar">
        <div class="gp-title">${esc(doc.title)}</div>
        <div class="gp-meta">${String(pageIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
      </div>
      <div class="gp-thread"><div class="gp-wrap">${blocks.join("")}</div></div>
      <div class="gp-composer-wrap">
        <div class="gp-composer"><span class="gp-ph">${esc(doc.composerPlaceholder)}</span><span class="gp-send"></span></div>
        <div class="gp-disclaimer">${esc(doc.disclaimer)}</div>
      </div>
    </div>
  </div>`;
}

/** Greedily pack blocks (by measured height) into A4 pages. */
function paginate(heights: number[]): number[][] {
  const pages: number[][] = [];
  let current: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    const cost = (current.length > 0 ? BLOCK_GAP : 0) + h;
    if (current.length > 0 && used + cost > AVAIL_H) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(i);
    used += (current.length > 1 ? BLOCK_GAP : 0) + h;
  });
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

/** Build, paginate, render, and download the document. Defaults to the canonical
 *  gopdf dark line; pass ``theme="light"`` for a bright page with dark ink. */
export async function downloadGhostPdf(
  doc: GhostPdfDoc,
  theme: GhostPdfTheme = "dark",
): Promise<void> {
  const tk = theme === "light" ? LIGHT_T : DARK_T;
  // The icon asset is a black tile / white ghost on a light field: invert it
  // only on the dark page so it reads correctly on either background.
  const invertIcon = theme === "dark";

  const host = document.createElement("div");
  host.className = "ghostpdf";
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = `${PAGE_W}px`;
  host.style.direction = "ltr";
  host.style.zIndex = "-1";
  host.style.background = tk.bgPrimary;

  const style = document.createElement("style");
  style.textContent = shellCss(tk, invertIcon);
  host.appendChild(style);
  document.body.appendChild(host);

  try {
    // Wait for fonts so Hebrew rasterises consistently.
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      // Non-fatal.
    }

    // 1) Measure every block at the real content width.
    const measure = document.createElement("div");
    measure.style.position = "absolute";
    measure.style.left = "0";
    measure.style.top = "0";
    measure.style.width = `${CONTENT_W}px`;
    measure.innerHTML = doc.blocks
      .map((b) => `<div class="gp-measure">${b}</div>`)
      .join("");
    host.appendChild(measure);
    const items = Array.from(
      measure.querySelectorAll(":scope > .gp-measure"),
    ) as HTMLElement[];
    const heights = items.map((el) => el.offsetHeight);
    measure.remove();

    // 2) Pack into pages and build the page DOM.
    const pages = paginate(heights);
    const total = pages.length;
    const pagesHtml = pages
      .map((blockIdxs, p) =>
        pageHtml(
          doc,
          blockIdxs.map((i) => doc.blocks[i]),
          p,
          total,
          Math.min(p, doc.navItems.length - 1),
        ),
      )
      .join("");

    // Build a SELF-CONTAINED render root: html2pdf deep-clones the element
    // passed to `.from()` into a fresh, detached container, so the clone must
    // carry its own `.ghostpdf` class (every selector is scoped under it) AND
    // its own <style> (a sibling <style> on the host would be left behind).
    // Without this, the clone renders with zero CSS — collapsed layout, a
    // full-size icon — which is exactly the broken output we are fixing.
    const renderRoot = document.createElement("div");
    renderRoot.className = "ghostpdf";
    renderRoot.style.width = `${PAGE_W}px`;
    renderRoot.style.direction = "ltr";
    renderRoot.style.background = tk.bgPrimary;
    const renderStyle = document.createElement("style");
    renderStyle.textContent = shellCss(tk, invertIcon);
    renderRoot.appendChild(renderStyle);
    const pagesRoot = document.createElement("div");
    pagesRoot.innerHTML = pagesHtml;
    renderRoot.appendChild(pagesRoot);
    host.appendChild(renderRoot);

    // 3) Render to PDF (one html2canvas slice per A4 .gp-page).
    const opt = {
      margin: [0, 0, 0, 0] as [number, number, number, number],
      filename: doc.filename,
      image: { type: "jpeg" as const, quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: tk.bgPrimary,
        windowWidth: PAGE_W,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait" as const,
      },
      pagebreak: { mode: ["css", "legacy"] },
    };

    const worker = html2pdf().set(opt).from(renderRoot).toPdf();

    // Stamp page numbers into the bottom margin.
    const pdf = await worker.get("pdf");
    const count: number = pdf.internal.getNumberOfPages();
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= count; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(118, 118, 118);
      pdf.text(`${i} / ${count}`, pageW / 2, pageH - 4, { align: "center" });
    }

    await worker.save();
  } finally {
    host.remove();
  }
}
