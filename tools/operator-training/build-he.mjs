// Builds operator-training-he.html (repo root) — the Hebrew (RTL) 1:1 copy of the
// Ghost Operator Training Program booklet. Same gopdf LIGHT design line as the
// English build (build.mjs), translated to Hebrew with right-to-left layout.
//
// Usage:  node tools/operator-training/build-he.mjs
// Then:   .cursor/skills/gopdf/scripts/render.sh operator-training-he.html Ghost_Operator_Training_Program_HE.pdf

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import part01 from "./part01-he.mjs";
import part02 from "./part02-he.mjs";
import part03 from "./part03-he.mjs";
import part04 from "./part04-he.mjs";
import part05 from "./part05-he.mjs";
import part06 from "./part06-he.mjs";
import part07 from "./part07-he.mjs";
import part08 from "./part08-he.mjs";
import part09 from "./part09-he.mjs";
import part10 from "./part10-he.mjs";

const PARTS = [part01, part02, part03, part04, part05, part06, part07, part08, part09, part10];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ICON = "frontend/public/ghost-icon.png";

const CSS = `
  /* =========================================================
     Ghost Operator Training Program — Hebrew / RTL
     Light monochrome · ChatGPT-UI design line (gopdf, inverted)
     ========================================================= */
  :root {
    --bg-primary: #ffffff;
    --bg-sidebar: #f7f7f7;
    --bg-surface: #f0f0f0;
    --bg-surface-hover: #e8e8e8;
    --bg-code: #fafafa;
    --text-primary: #161616;
    --text-secondary: #5d5d5d;
    --text-muted: #9a9a9a;
    --border-subtle: #e2e2e2;
    /* monochrome accent (no color) */
    --accent: #161616;
    --accent-ink: #ffffff;

    --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page { size: A4 portrait; margin: 0; }

  html, body {
    background: #ededed;
    color: var(--text-primary);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .mono { font-family: var(--mono); letter-spacing: 0.04em; }
  /* mono tactical labels stay LTR even inside RTL flow */
  .ltr { direction: ltr; unicode-bidi: isolate; }

  /* ---------- A4 page = one ChatGPT screen ---------- */
  .page {
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    background: var(--bg-primary);
    display: flex;
    overflow: hidden;
    position: relative;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* ---------- Sidebar ---------- */
  .sidebar {
    width: 64mm;
    flex-shrink: 0;
    background: var(--bg-sidebar);
    border-left: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    padding: 16px 12px;
    gap: 8px;
  }
  .brand { display: flex; align-items: center; gap: 10px; padding: 6px 6px 14px; }
  .brand img { width: 30px; height: 30px; border-radius: 9px; display: block; }
  .brand .name { font-size: 15px; font-weight: 600; color: var(--text-primary); letter-spacing: 0.01em; }
  .brand .name .sub {
    display: block; font-size: 9.5px; font-weight: 400;
    color: var(--text-muted); letter-spacing: 0.02em; margin-top: 1px;
  }

  .newchat {
    display: flex; align-items: center; gap: 10px;
    height: 40px; padding: 0 12px;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    color: var(--text-secondary);
    font-size: 13px;
    background: var(--bg-primary);
  }
  .newchat .plus { width: 16px; height: 16px; position: relative; opacity: 0.85; }
  .newchat .plus::before, .newchat .plus::after { content: ""; position: absolute; background: var(--text-secondary); }
  .newchat .plus::before { left: 7px; top: 1px; width: 2px; height: 14px; border-radius: 2px; }
  .newchat .plus::after { top: 7px; left: 1px; height: 2px; width: 14px; border-radius: 2px; }

  .nav-label { font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 14px 10px 4px; letter-spacing: 0.02em; }
  .nav-item {
    display: flex; align-items: center; gap: 9px;
    height: 34px; padding: 0 11px;
    border-radius: 11px;
    font-size: 12px; color: var(--text-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .nav-item .ix { font-size: 10px; color: var(--text-muted); width: 16px; flex-shrink: 0; }
  .nav-item.active { background: var(--bg-surface-hover); color: var(--text-primary); }
  .nav-item.active .ix { color: var(--text-primary); }

  .sidebar .spacer { flex: 1; }
  .sidebar .foot {
    border-top: 1px solid var(--border-subtle);
    padding: 12px 10px 2px;
    font-size: 10.5px; color: var(--text-muted);
    line-height: 1.5;
  }
  .sidebar .foot b { color: var(--text-secondary); font-weight: 600; }

  /* ---------- Main column ---------- */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar {
    height: 52px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px;
    border-bottom: 1px solid var(--border-subtle);
  }
  .topbar .title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
  .topbar .meta { font-size: 11px; color: var(--text-muted); }

  .thread {
    flex: 1;
    overflow: hidden;
    padding: 24px 28px 8px;
    display: flex; flex-direction: column;
    gap: 20px;
  }
  .wrap { width: 100%; max-width: 150mm; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }

  /* user message bubble (right aligned in RTL) */
  .msg-user { display: flex; justify-content: flex-start; }
  .msg-user .bubble {
    max-width: 78%;
    background: var(--bg-surface);
    color: var(--text-primary);
    border-radius: 20px;
    padding: 11px 16px;
    font-size: 14px; line-height: 1.55;
  }

  /* assistant message (full width, no bg); avatar on the right under RTL */
  .msg-ai { display: flex; gap: 14px; }
  .msg-ai .av {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    overflow: hidden; margin-top: 2px;
  }
  .msg-ai .av img { width: 100%; height: 100%; display: block; }
  .msg-ai .body { flex: 1; min-width: 0; }
  .msg-ai .body p { font-size: 13.5px; line-height: 1.7; color: var(--text-primary); }
  .msg-ai .body p + p { margin-top: 11px; }
  .msg-ai .body .lead { font-size: 21px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.3; }
  .msg-ai .body .lead .dim { color: var(--text-secondary); font-weight: 500; }
  .msg-ai .body .kicker {
    font-size: 11px; color: var(--text-muted); letter-spacing: 0.08em;
    text-transform: uppercase; margin-bottom: 10px;
    direction: ltr; text-align: right;
  }
  .msg-ai .body .lead + p { margin-top: 12px; }

  /* principle / feature list */
  .feat { list-style: none; margin-top: 12px; display: flex; flex-direction: column; gap: 0; }
  .feat li {
    padding: 11px 0; border-bottom: 1px solid var(--border-subtle);
    display: flex; gap: 13px; align-items: flex-start;
  }
  .feat li:last-child { border-bottom: none; }
  .feat .dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--text-primary); margin-top: 6px; flex-shrink: 0;
  }
  .feat .ft-title { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
  .feat .ft-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }

  /* pipeline diagram rendered as code-style block */
  .codeblock {
    margin-top: 13px;
    background: var(--bg-code);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    overflow: hidden;
  }
  .codeblock .cb-head {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--bg-surface); padding: 8px 14px;
    font-size: 11px; color: var(--text-secondary);
    direction: ltr;
  }
  .codeblock .cb-head .copy { font-size: 11px; color: var(--text-muted); }
  .codeblock .cb-body { padding: 16px; }

  .pipe { display: flex; align-items: stretch; gap: 0; }
  .node {
    flex: 1;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 11px 9px;
    text-align: center;
    display: flex; flex-direction: column; gap: 4px; justify-content: center;
  }
  .node .n-t { font-size: 11.5px; font-weight: 600; color: var(--text-primary); line-height: 1.25; }
  .node .n-s { font-size: 9.5px; color: var(--text-muted); }
  .arrow { align-self: center; width: 24px; text-align: center; color: var(--text-muted); font-size: 14px; flex-shrink: 0; }

  /* chips grid */
  .chips { margin-top: 13px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
  .chip {
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 12px 13px;
    background: rgba(0,0,0,0.015);
  }
  .chip .c-t { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
  .chip .c-d { font-size: 11px; color: var(--text-secondary); margin-top: 3px; line-height: 1.45; }

  /* stat strip */
  .stats { margin-top: 14px; display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; }
  .stats.three { grid-template-columns: repeat(3,1fr); }
  .stat { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 13px 9px; text-align: center; }
  .stat .s-b { font-size: 16px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
  .stat .s-l { font-size: 9.5px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }

  /* sample question / answer exchange (mini transcript) */
  .sample {
    margin-top: 13px;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    overflow: hidden;
  }
  .sample .sm-head {
    background: var(--bg-surface); padding: 7px 13px;
    font-size: 10.5px; color: var(--text-muted);
  }
  .sample .sm-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .sample .sm-q {
    align-self: flex-start; max-width: 88%;
    background: var(--bg-surface);
    border-radius: 14px; padding: 7px 12px;
    font-size: 12px; line-height: 1.5; color: var(--text-primary);
  }
  .sample .sm-a { font-size: 12px; line-height: 1.55; color: var(--text-secondary); }
  .sample .sm-a b { color: var(--text-primary); font-weight: 600; }

  /* drill card */
  .drill {
    margin-top: 14px;
    border: 1px solid var(--text-muted);
    border-radius: 14px;
    padding: 14px 16px;
    background: rgba(0,0,0,0.015);
  }
  .drill .d-k {
    font-size: 10px; color: var(--text-muted);
    letter-spacing: 0.12em; text-transform: uppercase;
    font-family: var(--mono);
  }
  .drill .d-t { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-top: 5px; }
  .drill .d-b { font-size: 12px; color: var(--text-secondary); line-height: 1.55; margin-top: 4px; }

  /* numbered steps */
  .steps { list-style: none; margin-top: 12px; counter-reset: step; display: flex; flex-direction: column; }
  .steps li {
    counter-increment: step;
    display: flex; gap: 12px; align-items: flex-start;
    padding: 10px 0; border-bottom: 1px solid var(--border-subtle);
  }
  .steps li:last-child { border-bottom: none; }
  .steps li::before {
    content: counter(step, decimal-leading-zero);
    font-family: var(--mono);
    font-size: 11px; color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    padding: 3px 7px;
    flex-shrink: 0; margin-top: 1px;
  }
  .steps .st-t { font-size: 13px; font-weight: 600; color: var(--text-primary); }
  .steps .st-d { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }

  /* two-column do / don't */
  .dodont { margin-top: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .dd { border: 1px solid var(--border-subtle); border-radius: 12px; padding: 12px 13px; }
  .dd .dd-h {
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    font-family: var(--mono); color: var(--text-muted); margin-bottom: 7px;
  }
  .dd.good .dd-h { color: var(--text-primary); }
  .dd ul { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .dd li { font-size: 11.5px; line-height: 1.45; color: var(--text-secondary); padding-inline-start: 12px; position: relative; }
  .dd li::before { content: ""; position: absolute; inset-inline-start: 0; top: 7px; width: 5px; height: 5px; border-radius: 50%; background: var(--text-muted); }
  .dd.good li { color: var(--text-primary); }
  .dd.good li::before { background: var(--text-primary); }

  /* closer card */
  .closer {
    margin-top: 18px; padding: 20px;
    border: 1px solid var(--border-subtle); border-radius: 16px;
    background: rgba(0,0,0,0.015);
    text-align: center;
  }
  .closer .big { font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em; }
  .closer .small { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

  /* syllabus map (table of contents) */
  .toc { margin-top: 12px; display: flex; flex-direction: column; }
  .toc .toc-row {
    display: flex; align-items: baseline; gap: 12px;
    padding: 8px 0; border-bottom: 1px solid var(--border-subtle);
  }
  .toc .toc-row:last-child { border-bottom: none; }
  .toc .toc-n { font-family: var(--mono); font-size: 10.5px; color: var(--text-muted); width: 26px; flex-shrink: 0; }
  .toc .toc-t { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
  .toc .toc-d { font-size: 11px; color: var(--text-secondary); margin-inline-start: auto; text-align: start; }

  /* ---------- Composer (decorative, sticky bottom) ---------- */
  .composer-wrap { padding: 8px 28px 18px; }
  .composer {
    max-width: 150mm; margin: 0 auto;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding-block: 11px;
    padding-inline-start: 18px;
    padding-inline-end: 12px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .composer .ph { flex: 1; font-size: 13.5px; color: var(--text-muted); }
  .composer .send {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--accent); flex-shrink: 0;
    position: relative;
  }
  .composer .send::after {
    content: ""; position: absolute; left: 50%; top: 52%;
    width: 8px; height: 8px; border-top: 2px solid var(--accent-ink); border-right: 2px solid var(--accent-ink);
    transform: translate(-50%,-50%) rotate(-45deg);
  }
  .disclaimer { max-width: 150mm; margin: 8px auto 0; text-align: center; font-size: 10.5px; color: var(--text-muted); }
`;

function sidebar(activePartIndex) {
  const items = PARTS.map((p, i) => {
    const n = String(i + 1).padStart(2, "0");
    const cls = i === activePartIndex ? "nav-item active" : "nav-item";
    return `      <div class="${cls}"><span class="ix ltr">${n}</span><span>${p.nav}</span></div>`;
  }).join("\n");
  return `  <aside class="sidebar">
    <div class="brand">
      <img src="${ICON}" alt="Ghost" />
      <div class="name">Ghost<span class="sub">\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d4\u05db\u05e9\u05e8\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u05d9\u05dd</span></div>
    </div>
    <div class="newchat"><span class="plus"></span><span>\u05e9\u05d9\u05d7\u05d4 \u05d7\u05d3\u05e9\u05d4</span></div>
    <div class="nav-label">\u05d7\u05dc\u05e7\u05d9 \u05d4\u05e7\u05d5\u05e8\u05e1</div>
${items}
    <div class="spacer"></div>
    <div class="foot"><b>\u05d0\u05e7\u05d3\u05de\u05d9\u05d9\u05ea Ghost</b><br />\u05de\u05e1\u05dc\u05d5\u05dc \u05d4\u05e1\u05de\u05db\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u05d9\u05dd &middot; 2026</div>
  </aside>`;
}

function renderPage(page, partIndex, pageNum, total) {
  const nn = String(pageNum).padStart(2, "0");
  const tt = String(total).padStart(2, "0");
  return `<!-- ============ PAGE ${nn} — ${page.title} ============ -->
<div class="page">
${sidebar(partIndex)}
  <div class="main">
    <div class="topbar">
      <div class="title">${page.title}</div>
      <div class="meta mono ltr">${nn} / ${tt}</div>
    </div>
    <div class="thread">
      <div class="wrap">
        <div class="msg-user"><div class="bubble">${page.q}</div></div>
        <div class="msg-ai">
          <div class="av"><img src="${ICON}" alt="Ghost" /></div>
          <div class="body">
${page.body}
          </div>
        </div>
      </div>
    </div>
    <div class="composer-wrap">
      <div class="composer"><span class="ph">${page.ph ?? "\u05e9\u05d0\u05dc \u05d0\u05ea Ghost \u05db\u05dc \u05d3\u05d1\u05e8 \u05e2\u05dc \u05d4\u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05e9\u05dc\u05da\u2026"}</span><span class="send"></span></div>
      <div class="disclaimer">\u05d0\u05e7\u05d3\u05de\u05d9\u05d9\u05ea Ghost &middot; \u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d4\u05db\u05e9\u05e8\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u05d9\u05dd &middot; \u05d7\u05e1\u05d5\u05d9</div>
    </div>
  </div>
</div>`;
}

const allPages = [];
PARTS.forEach((part, pi) => {
  part.pages.forEach((page) => allPages.push({ page, pi }));
});
const total = allPages.length;

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ghost — \u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d4\u05db\u05e9\u05e8\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u05d9\u05dd</title>
<style>${CSS}</style>
</head>
<body>

${allPages.map(({ page, pi }, i) => renderPage(page, pi, i + 1, total)).join("\n\n")}

</body>
</html>
`;

const out = join(ROOT, "operator-training-he.html");
writeFileSync(out, html);
console.log(`Wrote ${out} — ${total} pages.`);
