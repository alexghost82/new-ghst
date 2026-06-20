// Builds operator-training-appendix.html — Visual Field Appendix to the Ghost
// Operator Training Program. Same gopdf LIGHT design line as the main booklet,
// but every page centers on a REAL screenshot of the operational console with
// a numbered instruction layer (callout markers positioned over the actual
// controls) and a step legend: action → meaning → result.
//
// Usage:  node tools/operator-training/appendix-build.mjs
// Render: .cursor/skills/gopdf/scripts/render.sh operator-training-appendix.html Ghost_Operator_Training_Visual_Appendix.pdf

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ICON = "frontend/public/ghost-icon.png";
const SHOTS = "tools/operator-training/shots";

// ── Page data ─────────────────────────────────────────────────────────────────
// markers: positions in % of the screenshot (x,y = marker center).
// alert: true → markers render in functional red (alerts only, per brand).
// mask: optional identity-protection patches over faces.
// steps: [n, action, result] — rendered as the numbered legend.

const SECTIONS = [
  {
    nav: "Reading This Appendix",
    pages: [
      {
        title: "How to Read This Appendix",
        q: "Show me the console exactly as I will see it.",
        ph: "Every page: one real screen, one skill\u2026",
        shot: "01-console-home.png",
        intro:
          "This appendix is the visual companion to the Operator Training Program. Every page shows a <b>real, unedited screenshot</b> of the Ghost console, with numbered markers placed on the actual controls. The legend under each image tells you three things per marker: what to do, what it means, and what happens next. The console runs Hebrew, right-to-left — the conversations sidebar sits on the right, the chat fills the rest.",
        markers: [
          { n: 1, x: 89.0, y: 2.9 },
          { n: 2, x: 82.4, y: 2.9 },
          { n: 3, x: 89.3, y: 8.5 },
          { n: 4, x: 89.5, y: 30.0 },
          { n: 5, x: 92.0, y: 62.0 },
          { n: 6, x: 86.0, y: 96.8 },
        ],
        steps: [
          [1, "The operator clock", "Local time with red seconds — your reference whenever you log an event time."],
          [2, "New conversation (+)", "One press opens a fresh conversation — the basic unit of work in Ghost."],
          [3, "View tabs: \u05e6'\u05d0\u05d8 / \u05e0\u05d9\u05d4\u05d5\u05dc \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd", "Chat is where you question cameras; Incidents is the case board. A counter badge shows cases waiting."],
          [4, "The organization tree", "Areas contain camera groups, groups contain conversations — \u05de\u05e4\u05e2\u05dc \u05de\u05d2\u05dd \u05e6\u05d9\u05e4\u05d5\u05e8\u05d9 holds two groups here."],
          [5, "Free conversations", "Anything not yet filed into an area. Keep this list short — file what you keep."],
          [6, "The footer strip", "Active user, theme toggle, Settings and sign-out — identity and console controls in one row."],
        ],
      },
    ],
  },
  {
    nav: "Entry & First Conversation",
    pages: [
      {
        title: "Secure Access",
        q: "What does the door to the console look like?",
        ph: "Sign in with agent credentials\u2026",
        shot: "00-secure-access.png",
        intro:
          "The Secure Access screen is the only door into the console. It is always dark, always English — a deliberate checkpoint before the operational interface.",
        markers: [
          { n: 1, x: 50.0, y: 39.0 },
          { n: 2, x: 50.0, y: 44.5 },
          { n: 3, x: 58.3, y: 44.5 },
          { n: 4, x: 50.0, y: 53.0 },
          { n: 5, x: 50.0, y: 88.0 },
        ],
        steps: [
          [1, "Type your agent name in \u201cAgent Access\u201d", "Your operator identity — every action you take is attributed to it."],
          [2, "Paste your key into \u201cGhost Key\u201d", "The credential itself. Never type it while anyone can see your screen."],
          [3, "The eye toggle", "Reveals the key while you paste, hides it again with one press. Default: hidden."],
          [4, "Press \u201cSign in\u201d", "Valid credentials hand you straight into the console. A quick-login link skips this screen entirely."],
          [5, "Briefs & Documents", "Public PDFs offered at the door — these are for visitors; your work starts after sign-in."],
        ],
      },
      {
        title: "Creating a Conversation",
        q: "I pressed + . What am I looking at?",
        ph: "\u05db\u05ea\u05d5\u05d1 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05dc\u05de\u05d8\u05d4 \u05db\u05d3\u05d9 \u05dc\u05d4\u05ea\u05d7\u05d9\u05dc\u2026",
        shot: "02-new-conversation.png",
        intro:
          "One press on + and you are standing in a fresh conversation. Nothing is configured yet — no camera, no rules — and that emptiness is the point: each conversation grows into one camera and one concern.",
        markers: [
          { n: 1, x: 82.4, y: 2.9 },
          { n: 2, x: 89.5, y: 50.5 },
          { n: 3, x: 39.4, y: 32.0 },
          { n: 4, x: 40.0, y: 93.3 },
          { n: 5, x: 14.2, y: 93.3 },
          { n: 6, x: 5.8, y: 2.6 },
        ],
        steps: [
          [1, "The + you just pressed", "Creates and selects the conversation in one motion."],
          [2, "The new row appears", "Stamped with date and time (\u05e9\u05d9\u05d7\u05d4 \u05d7\u05d3\u05e9\u05d4 26-6-9 21:46) and marked \u05e2\u05db\u05e9\u05d9\u05d5 — auto-naming will rename it after the first exchange."],
          [3, "GHOST // SESSION — \u05d0\u05d9\u05da \u05d0\u05e4\u05e9\u05e8 \u05dc\u05e2\u05d6\u05d5\u05e8?", "The empty state. Ghost is ready; the thread fills as you ask."],
          [4, "The message box, already focused", "Type and press Enter. Shift+Enter inserts a line break."],
          [5, "Camera and voice controls", "The live toggle and microphone sit beside the box — Parts IV and IX of the booklet."],
          [6, "Header tools", "System prompt, alert mode, memory, site scan and language — one icon each, covered page by page in this appendix."],
        ],
      },
      {
        title: "The Composer, Armed",
        q: "What changes the moment I type?",
        ph: "\u05de\u05d4 \u05d7\u05e9\u05d5\u05d1 \u05dc\u05db\u05dc\u05d5\u05dc \u05d1\u05ea\u05d3\u05e8\u05d9\u05da \u05de\u05e9\u05de\u05e8\u05ea \u05dc\u05d9\u05dc\u05d4?\u2026",
        shot: "03-composer-typed.png",
        intro:
          "A question is typed and everything around the box reports readiness: the send arrow is live, and because voice command is enabled, a listening strip explains how to fire the message hands-free.",
        markers: [
          { n: 1, x: 40.0, y: 92.8 },
          { n: 2, x: 19.0, y: 93.2 },
          { n: 3, x: 21.0, y: 93.2 },
          { n: 4, x: 47.0, y: 88.6 },
        ],
        steps: [
          [1, "The question, in plain language", "\u201c\u05de\u05d4 \u05d7\u05e9\u05d5\u05d1 \u05dc\u05db\u05dc\u05d5\u05dc \u05d1\u05ea\u05d3\u05e8\u05d9\u05da \u05de\u05e9\u05de\u05e8\u05ea \u05dc\u05dc\u05d9\u05dc\u05d4 \u05e9\u05e7\u05d8 \u05d1\u05de\u05ea\u05e7\u05df \u05dc\u05d5\u05d2\u05d9\u05e1\u05d8\u05d9?\u201d — operational intent, not object lists."],
          [2, "Send arrow — armed", "Dark and active the moment the box holds text. Enter does the same."],
          [3, "Microphone — listening", "Voice command is on: speech becomes text in the box."],
          [4, "The voice strip", "\u05de\u05d0\u05d6\u05d9\u05df\u2026 \u05d0\u05de\u05d5\u05e8 \u201c\u05d1\u05d9\u05e6\u05d5\u05e2\u201d \u05db\u05d3\u05d9 \u05dc\u05e9\u05dc\u05d5\u05d7 — say the send phrase and the message fires hands-free."],
        ],
      },
      {
        title: "Reading the Answer",
        q: "The answer arrived. What should I notice?",
        ph: "Ask a follow-up\u2026",
        shot: "04-thread-answer.png",
        intro:
          "Ghost answers in a structured brief — and the console quietly does one more thing: it reads the exchange and renames the conversation to match its content.",
        markers: [
          { n: 1, x: 33.0, y: 11.2 },
          { n: 2, x: 45.0, y: 45.0 },
          { n: 3, x: 71.5, y: 3.0 },
          { n: 4, x: 91.0, y: 50.5 },
          { n: 5, x: 40.0, y: 97.6 },
        ],
        steps: [
          [1, "Your question, right-aligned", "User messages sit in bubbles; hover one to reveal its exact timestamp and a copy button."],
          [2, "Ghost's answer, streamed", "A full operational checklist for the night-shift briefing — note the structure: opening read, then itemized points."],
          [3, "The title changed itself", "Auto-naming renamed the conversation to \u05ea\u05d3\u05e8\u05d9\u05da \u05de\u05e9\u05de\u05e8\u05ea \u05dc\u05d9\u05dc\u05d4 from the content."],
          [4, "The sidebar row followed", "Same new name in the list — rename manually (pencil) and the automatic naming locks out."],
          [5, "The disclaimer line", "\u201cGhost \u05e2\u05dc\u05d5\u05dc \u05dc\u05d8\u05e2\u05d5\u05ea\u201d — the standing reminder that you are the verifying human."],
        ],
      },
      {
        title: "The System Prompt Editor",
        q: "Where do I write standing instructions?",
        ph: "Edit the standing orders\u2026",
        shot: "05-system-prompt.png",
        intro:
          "The sliders icon in the header opens the System Prompt — the standing order this conversation obeys in every answer. Here a real watch order for a northern loading dock is being written.",
        markers: [
          { n: 1, x: 61.5, y: 32.0 },
          { n: 2, x: 50.0, y: 43.0 },
          { n: 3, x: 38.5, y: 61.8 },
          { n: 4, x: 38.7, y: 67.4 },
          { n: 5, x: 43.0, y: 67.4 },
        ],
        steps: [
          [1, "The editor opens as a focused modal", "Everything else dims — standing orders deserve full attention."],
          [2, "Numbered priorities, concrete conditions", "\u201c(1) \u05e0\u05ea\u05d9\u05d1 \u05d4\u05d7\u05d9\u05e8\u05d5\u05dd \u05d7\u05d9\u05d9\u05d1 \u05dc\u05d4\u05d9\u05e9\u05d0\u05e8 \u05e4\u05e0\u05d5\u05d9\u2026\u201d — ordered, observable, and a fixed answer format at the end."],
          [3, "Character count", "186 \u05ea\u05d5\u05d5\u05d9\u05dd — short enough to stay sharp. A page-long prompt is a sign you need two conversations."],
          [4, "\u05e9\u05de\u05d9\u05e8\u05d4 (Save)", "The order takes effect on the very next message and every one after it."],
          [5, "\u05d1\u05d9\u05d8\u05d5\u05dc (Cancel)", "Discards the edit; the previous prompt stays in force."],
        ],
      },
    ],
  },
  {
    nav: "Cameras & Live Work",
    pages: [
      {
        title: "The Camera Selector",
        q: "How do I bind a real camera to this conversation?",
        ph: "\u05d1\u05d7\u05e8 \u05de\u05e6\u05dc\u05de\u05d5\u05ea\u2026",
        shot: "08-camera-selector.png",
        intro:
          "Flip the live toggle (or press \u05d4\u05d5\u05e1\u05e3 \u05de\u05e6\u05dc\u05de\u05d4 in the header) and GHOST // CAMERAS lists every camera this console can reach — here, a MacBook camera and a paired iPhone.",
        markers: [
          { n: 1, x: 50.0, y: 48.0 },
          { n: 2, x: 50.0, y: 53.2 },
          { n: 3, x: 56.8, y: 60.3 },
          { n: 4, x: 42.8, y: 60.3 },
          { n: 5, x: 41.2, y: 39.8 },
        ],
        steps: [
          [1, "Camera row — click to select", "Multi-select: a gate conversation often pairs the approach view with the barrier view."],
          [2, "A second device", "Phones, capture cards and fixed cameras all appear the same way — pick what covers the scene."],
          [3, "\u05e9\u05de\u05d5\u05e8 Setup", "Binds the selection to this conversation permanently and starts streaming. Alerts and broadcasts use this saved set."],
          [4, "\u05d4\u05e4\u05e2\u05dc \u05dc\u05d9\u05d9\u05d1", "Streams for this session only — nothing is saved. For a conversation you keep, always save."],
          [5, "Close (\u00d7)", "The only way out — the backdrop deliberately does not dismiss a camera decision."],
        ],
      },
      {
        title: "The Live Stage",
        q: "The camera is on. What are all these tile controls?",
        ph: "\u05d4\u05d2\u05d3\u05dc \u05d0\u05ea \u05d4\u05ea\u05e6\u05d5\u05d2\u05d4 \u05d4\u05d7\u05d9\u05d4\u2026",
        shot: "09-live-stage.png",
        intro:
          "With a saved setup the live stage renders above the composer. The default view is the calm grayscale intel view; Ghost silhouettes people it recognizes in the scene as an orientation aid.",
        mask: [{ x: 31.0, y: 41.0, w: 15.0, h: 21.0, label: "IDENTITY PROTECTED" }],
        markers: [
          { n: 1, x: 39.0, y: 64.0 },
          { n: 2, x: 59.7, y: 44.1 },
          { n: 3, x: 59.7, y: 47.5 },
          { n: 4, x: 18.8, y: 84.2 },
          { n: 5, x: 57.0, y: 44.5 },
          { n: 6, x: 53.5, y: 8.0 },
        ],
        steps: [
          [1, "The live tile — intel view", "Grayscale by design for long watches; the teal silhouette is Ghost marking a person in the scene."],
          [2, "Record", "Captures the stream into a downloadable clip with a running timer — your raw-footage evidence layer."],
          [3, "Enhance — \u05de\u05e6\u05d1 \u05e6\u05d1\u05e2 + \u05d6\u05d5\u05dd/PTZ", "Switches to full color and unlocks wheel-zoom (up to 8\u00d7) and drag-pan for reading details."],
          [4, "Audio listen", "Opens the camera's microphone channel if it has one. Default muted — open deliberately, close when verified."],
          [5, "REC indicator & camera label", "Every tile is labeled with its device name; the red dot confirms an active recording."],
          [6, "Header camera chip", "\u05de\u05e6\u05dc\u05de\u05ea \u05d4-MacBook Air with \u00d7 to detach, plus \u05d4\u05d5\u05e1\u05e3 \u05de\u05e6\u05dc\u05de\u05d4 to grow the setup."],
        ],
      },
      {
        title: "Asking With Live Cameras",
        q: "I asked while live was on. What did Ghost actually see?",
        ph: "\u05ea\u05d0\u05e8 \u05de\u05d4 \u05d0\u05ea\u05d4 \u05e8\u05d5\u05d0\u05d4 \u05db\u05e8\u05d2\u05e2\u2026",
        shot: "10-live-answer-frame.png",
        intro:
          "Every live question carries evidence. Ghost samples three frames about 0.8 seconds apart, masks faces, and pins the collage to its answer — the answer and what it saw, side by side, forever.",
        markers: [
          { n: 1, x: 29.0, y: 49.5 },
          { n: 2, x: 38.0, y: 63.5 },
          { n: 3, x: 23.0, y: 70.0 },
          { n: 4, x: 44.0, y: 76.5 },
          { n: 5, x: 40.5, y: 84.7 },
        ],
        steps: [
          [1, "The live question", "\u201c\u05ea\u05d0\u05e8 \u05de\u05d4 \u05d0\u05ea\u05d4 \u05e8\u05d5\u05d0\u05d4 \u05db\u05e8\u05d2\u05e2 \u05d5\u05e6\u05d9\u05d9\u05df \u05db\u05dc \u05d3\u05d1\u05e8 \u05e9\u05d3\u05d5\u05e8\u05e9 \u05ea\u05e9\u05d5\u05de\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u201d — present tense, because live is on."],
          [2, "The sampled-frame collage", "Three spaced frames reveal motion, not just a frozen instant. Click it for the full-size view."],
          [3, "Timestamp watermark", "2026-06-09 21:56 burned into the frame — evidence carries its own time."],
          [4, "Ghost's read", "\u201c\u05e9\u05e7\u05d8\u2026 \u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9\u05ea \u05ea\u05e9\u05d5\u05de\u05ea \u05de\u05e4\u05e2\u05d9\u05dc \u05db\u05e8\u05d2\u05e2\u201d — a decision-grade answer, not an inventory."],
          [5, "\u05d4\u05e6\u05d2 \u05e9\u05d9\u05d3\u05d5\u05e8 \u05d7\u05d9 — collapsed stage", "The live stage folds to a slim bar when you need thread space; one click restores it."],
        ],
      },
      {
        title: "The Frame Lightbox",
        q: "Can I inspect the exact frames at full size?",
        ph: "Esc closes the preview\u2026",
        shot: "11-frame-lightbox.png",
        intro:
          "Click any sampled frame and it opens full-screen. This is the evidence view — what Ghost analyzed, at inspection size, with the privacy layer visibly applied.",
        markers: [
          { n: 1, x: 50.0, y: 48.0 },
          { n: 2, x: 6.5, y: 63.5 },
          { n: 3, x: 2.0, y: 3.2 },
          { n: 4, x: 50.0, y: 67.0 },
        ],
        steps: [
          [1, "Three frames, full size", "Spaced sampling: compare the frames to read motion — what moved, what stayed."],
          [2, "Timestamp watermark", "Burned into the lower corner of the collage."],
          [3, "Close (\u00d7) — or press Esc", "Returns to the thread exactly where you were."],
          [4, "Face masking, visible", "The blurred patch at the bottom is the privacy layer — identity is masked before analysis, by design."],
        ],
      },
      {
        title: "Site Intelligence",
        q: "What does the scan button produce?",
        ph: "\u05e1\u05e8\u05d9\u05e7\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4\u2026",
        shot: "12-site-intelligence.png",
        intro:
          "One press on the scan-eye icon and Ghost surveys the whole scene — not an answer to a question, but a structured read of the site: layout, activity, and what deserves operator attention.",
        markers: [
          { n: 1, x: 8.4, y: 2.8 },
          { n: 2, x: 26.5, y: 19.0 },
          { n: 3, x: 38.0, y: 50.0 },
          { n: 4, x: 40.0, y: 86.0 },
          { n: 5, x: 40.0, y: 91.5 },
        ],
        steps: [
          [1, "The scan-eye button", "Lives in the header. Disabled with a hint when no camera is set up — the scan needs eyes."],
          [2, "\u201cSite Intelligence Report — \u05e1\u05e8\u05d9\u05e7\u05ea \u05e1\u05d1\u05d9\u05d1\u05d4\u201d", "The scan lands in the thread as a labeled exchange — quotable and permanent like any answer."],
          [3, "The surveyed frame", "Sampled at scan time, faces masked, time-stamped — the report's evidence base."],
          [4, "The report itself", "\u05d3\u05d5\u05d7 \u05de\u05d1\u05d5\u05e1\u05e1 \u05e2\u05dc \u05e0\u05d9\u05ea\u05d5\u05d7 \u05e4\u05e8\u05d9\u05d9\u05dd \u05d1\u05d5\u05d3\u05d3 — layout, storage, lighting, risks. Run one on every new camera."],
          [5, "\u05e7\u05e4\u05d5\u05e5 \u05dc\u05d4\u05d5\u05d3\u05e2\u05d4 \u05d4\u05d0\u05d7\u05e8\u05d5\u05e0\u05d4", "Appears whenever you scroll up — one click back to the live end of the thread."],
        ],
      },
      {
        title: "The Memory Panel",
        q: "Where do I see what this conversation remembers?",
        ph: "\u05e4\u05ea\u05d7 \u05d0\u05ea \u05e4\u05d0\u05e0\u05dc \u05d4\u05d6\u05d9\u05db\u05e8\u05d5\u05df\u2026",
        shot: "13-memory-panel.png",
        intro:
          "The brain icon opens the memory panel — three layers of what this conversation has accumulated, each one inspectable and prunable.",
        markers: [
          { n: 1, x: 15.0, y: 6.9 },
          { n: 2, x: 9.0, y: 6.9 },
          { n: 3, x: 3.0, y: 6.9 },
          { n: 4, x: 2.5, y: 11.9 },
          { n: 5, x: 7.0, y: 16.0 },
        ],
        steps: [
          [1, "\u05d8\u05e8\u05e7\u05d9\u05e0\u05d2 (Tracking)", "Continuous activity logging — people, vehicles, equipment moving through the scene, filterable by type and time."],
          [2, "\u05ea\u05e6\u05e4\u05d9\u05d5\u05ea (Observations)", "Visual memory: entities and scene facts Ghost noticed across its samples."],
          [3, "\u05e2\u05d5\u05d1\u05d3\u05d5\u05ea (Facts)", "Standing knowledge that shapes future answers — each fact carries a delete control. Prune after every site change."],
          [4, "The tracking toggle", "Off by default. Arm it on posts where an activity diary earns its cost."],
          [5, "Batch controls", "0 / 8 — how detections accumulate before flushing. \u05e9\u05dc\u05d7 \u05e2\u05db\u05e9\u05d9\u05d5 forces an immediate flush."],
        ],
      },
    ],
  },
  {
    nav: "Standing Alerts",
    pages: [
      {
        title: "The Alert Panel",
        q: "Open the shield. What am I configuring?",
        ph: "\u05ea\u05d0\u05e8 \u05de\u05e6\u05d1, \u05d0\u05d5\u05d1\u05d9\u05d9\u05e7\u05d8 \u05d0\u05d5 \u05d0\u05d9\u05e8\u05d5\u05e2\u2026",
        shot: "06-alert-panel.png",
        alert: true,
        intro:
          "The shield icon opens the alert panel — where a conversation learns to watch itself. Everything here is disarmed; the next two pages arm it.",
        markers: [
          { n: 1, x: 3.7, y: 12.0 },
          { n: 2, x: 12.0, y: 21.5 },
          { n: 3, x: 13.0, y: 35.5 },
          { n: 4, x: 2.5, y: 35.5 },
          { n: 5, x: 12.0, y: 46.5 },
        ],
        steps: [
          [1, "\u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4 \u05db\u05d1\u05d5\u05d9 — the arming toggle", "Off. The conversation answers questions but keeps no watch."],
          [2, "The camera prerequisite warning", "\u05d9\u05e9 \u05dc\u05d4\u05d2\u05d3\u05d9\u05e8 \u05de\u05e6\u05dc\u05de\u05d4 \u05dc\u05e9\u05d9\u05d7\u05d4 — arming requires a saved camera. The inline link opens the selector."],
          [3, "The rule box", "A real rule mid-typing: \u201c\u05d0\u05d3\u05dd \u05de\u05e8\u05d9\u05dd \u05d9\u05d3 \u05d2\u05d1\u05d5\u05d4 \u05de\u05e2\u05dc \u05d4\u05e8\u05d0\u05e9\u201d — observable posture, one deviation, plain words."],
          [4, "Add (+)", "Press, or hit Enter, to add the rule to this conversation's watch list."],
          [5, "\u05d0\u05d9\u05df \u05e9\u05d5\u05e8\u05d5\u05ea \u05d4\u05ea\u05e8\u05d0\u05d4 — empty list", "No rules yet. A conversation can hold several, each toggled independently."],
        ],
      },
      {
        title: "A Rule, Added & Active",
        q: "I added the rule. How do I know it counts?",
        ph: "\u05d4\u05d5\u05e1\u05e3 \u05e9\u05d5\u05e8\u05ea \u05d4\u05ea\u05e8\u05d0\u05d4 \u05e0\u05d5\u05e1\u05e4\u05ea\u2026",
        shot: "07-alert-rule-added.png",
        alert: true,
        intro:
          "The rule is now on the books. Note what changed: a counter, a live toggle on the rule itself, and a cleared input ready for the next rule.",
        markers: [
          { n: 1, x: 11.5, y: 41.5 },
          { n: 2, x: 20.5, y: 42.5 },
          { n: 3, x: 5.5, y: 31.5 },
          { n: 4, x: 12.0, y: 34.0 },
        ],
        steps: [
          [1, "The rule row", "\u201c\u05d0\u05d3\u05dd \u05de\u05e8\u05d9\u05dd \u05d9\u05d3 \u05d2\u05d1\u05d5\u05d4 \u05de\u05e2\u05dc \u05d4\u05e8\u05d0\u05e9\u201d — exactly as you wrote it. Hover reveals a delete control."],
          [2, "The green per-rule toggle", "Active. Green is reserved for live/connected states — this rule will be scanned for once armed."],
          [3, "\u05e9\u05d5\u05e8\u05d5\u05ea \u05d4\u05ea\u05e8\u05d0\u05d4: 1", "The counter confirms one active rule on this post."],
          [4, "The input, cleared", "Ready for the next rule — one deviation per rule, several rules per post."],
        ],
      },
      {
        title: "The Armed Watch",
        q: "Alert mode is on. Read me the status card.",
        ph: "\u05d1\u05d3\u05d9\u05e7\u05ea \u05d7\u05d9\u05d1\u05d5\u05e8\u2026",
        shot: "14-alert-armed.png",
        alert: true,
        intro:
          "Armed. The toggle is green, the status card is live, and the conversation's sidebar row now carries a red \u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4 badge so every operator can see this post watches itself.",
        markers: [
          { n: 1, x: 3.7, y: 12.5 },
          { n: 2, x: 9.0, y: 28.5 },
          { n: 3, x: 9.0, y: 33.5 },
          { n: 4, x: 9.0, y: 40.5 },
          { n: 5, x: 9.0, y: 47.5 },
          { n: 6, x: 92.5, y: 51.7 },
        ],
        steps: [
          [1, "\u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4 \u05e4\u05e2\u05d9\u05dc", "The watch is live: Ghost continuously scans the saved cameras against your rules."],
          [2, "\u05e1\u05d8\u05d8\u05d5\u05e1 \u05de\u05e2\u05e8\u05db\u05ea — the heartbeat card", "Read it at every check-in; an armed watch you never verify is a story you tell yourself."],
          [3, "\u05de\u05e6\u05dc\u05de\u05d4: \u05e1\u05d5\u05e8\u05e7\u2026", "Frames are flowing from the MacBook camera into the scan loop."],
          [4, "\u05e2\u05e8\u05d5\u05e5 \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05e4\u05e2\u05d9\u05dc (green)", "The push channel is connected — a firing alert reaches this console instantly."],
          [5, "\u05e1\u05e8\u05d9\u05e7\u05d4 \u05d0\u05d7\u05e8\u05d5\u05e0\u05d4: \u05db\u05e2\u05ea", "The freshness clock. If it stops advancing: disarm, fix, re-arm."],
          [6, "The red sidebar badge", "\u05de\u05e6\u05d1 \u05d4\u05ea\u05e8\u05d0\u05d4 on the row — armed state is visible from across the room."],
        ],
      },
    ],
  },
  {
    nav: "Organization & Broadcast",
    pages: [
      {
        title: "Conversation Row Actions",
        q: "What hides behind a conversation row?",
        ph: "\u05e8\u05d7\u05e3 \u05de\u05e2\u05dc \u05e9\u05d5\u05e8\u05ea \u05e9\u05d9\u05d7\u05d4\u2026",
        shot: "17-row-actions.png",
        intro:
          "Hover any conversation row and its timestamp gives way to an action bar — four small controls that keep a fifty-conversation site navigable.",
        markers: [
          { n: 1, x: 84.5, y: 50.0 },
          { n: 2, x: 83.0, y: 50.0 },
          { n: 3, x: 81.5, y: 50.0 },
          { n: 4, x: 80.0, y: 50.0 },
          { n: 5, x: 86.2, y: 50.0 },
        ],
        steps: [
          [1, "\u05e9\u05d9\u05d9\u05da \u05dc\u05d0\u05d6\u05d5\u05e8 (folder)", "Opens the filing menu — next page — to place this conversation in an area or group."],
          [2, "\u05e9\u05d9\u05d5\u05dd \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 (sparkles)", "Per-conversation override of automatic naming, on top of the global switch in Settings."],
          [3, "\u05e9\u05e0\u05d4 \u05e9\u05dd (pencil)", "Inline rename — or double-click the title. A manual name locks auto-naming out."],
          [4, "\u05de\u05d7\u05e7 \u05e9\u05d9\u05d7\u05d4 (trash)", "Immediate and permanent — no confirmation, no undo. Deliberate, never casual."],
          [5, "Drag handle", "Grab to reorder, or drop the row into any area or group in the tree."],
        ],
      },
      {
        title: "The Filing Menu",
        q: "I pressed the folder. Where can this conversation go?",
        ph: "\u05d1\u05d7\u05e8 \u05d9\u05e2\u05d3\u2026",
        shot: "18-assign-menu.png",
        intro:
          "The \u05d1\u05d7\u05e8 \u05d9\u05e2\u05d3 popover lists every destination: existing areas and their groups, direct-in-area placement, brand-new containers, or back to the free list.",
        markers: [
          { n: 1, x: 91.5, y: 36.5 },
          { n: 2, x: 86.0, y: 36.8 },
          { n: 3, x: 88.0, y: 41.5 },
          { n: 4, x: 87.5, y: 46.5 },
          { n: 5, x: 86.5, y: 50.5 },
        ],
        steps: [
          [1, "The area — \u05de\u05e4\u05e2\u05dc \u05de\u05d2\u05dd \u05e6\u05d9\u05e4\u05d5\u05e8\u05d9", "Hover an area to unfold its placement options."],
          [2, "\u05d9\u05e9\u05d9\u05e8\u05d5\u05ea \u05d1\u05d0\u05d6\u05d5\u05e8", "Files the conversation directly under the area, outside any group."],
          [3, "The groups — \u05d7\u05e0\u05d9\u05d9\u05d4 / \u05de\u05e4\u05e2\u05dc \u05d2\u05d5\u05de\u05d9", "One click files the conversation into that camera group."],
          [4, "\u05e7\u05d1\u05d5\u05e6\u05d4 \u05d7\u05d3\u05e9\u05d4", "Creates a group and files the conversation into it in a single motion."],
          [5, "\u05dc\u05dc\u05d0 \u05e9\u05d9\u05d5\u05da", "Returns the conversation to the free list. Esc or an outside click closes the menu."],
        ],
      },
      {
        title: "Broadcast: The Prerequisite",
        q: "I opened an area chat and the box is locked. Why?",
        ph: "\u05d0\u05d9\u05df \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05de\u05e7\u05d5\u05e9\u05e8\u05d5\u05ea \u05d1\u05e9\u05d9\u05d3\u05d5\u05e8\u2026",
        shot: "16-broadcast-empty.png",
        intro:
          "Broadcast sends one question to every saved camera in a scope. This area resolved zero cameras — so the console refuses to pretend, and tells you exactly what is missing.",
        markers: [
          { n: 1, x: 73.5, y: 2.6 },
          { n: 2, x: 71.5, y: 4.2 },
          { n: 3, x: 39.5, y: 27.0 },
          { n: 4, x: 39.5, y: 93.2 },
          { n: 5, x: 76.6, y: 7.5 },
        ],
        steps: [
          [1, "Scope header — \u05de\u05e4\u05e2\u05dc \u05de\u05d2\u05dd \u05e6\u05d9\u05e4\u05d5\u05e8\u05d9 \u00b7 \u05d0\u05d6\u05d5\u05e8", "You are talking to a zone now, not a single camera."],
          [2, "0 \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05d1\u05e9\u05d9\u05d3\u05d5\u05e8", "The resolver counted saved cameras across every conversation in the area — and found none."],
          [3, "The explanation", "\u05e6\u05e8\u05e3 \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05dc\u05e9\u05d9\u05d7\u05d5\u05ea \u05e9\u05d1\u05d0\u05d6\u05d5\u05e8 — broadcast rides on each conversation's saved setup."],
          [4, "The locked composer", "Disabled with the reason in the placeholder. No cameras, no broadcast — by design."],
          [5, "Close (\u00d7)", "Back to normal chat. Fix the setups, then return — next page."],
        ],
      },
      {
        title: "Broadcast, Live",
        q: "Now the area has a camera. What does a sweep look like?",
        ph: "\u05e9\u05dc\u05d7 \u05d4\u05d5\u05d3\u05e2\u05d4 \u05d0\u05d7\u05ea \u05dc\u05db\u05dc \u05d4\u05de\u05e6\u05dc\u05de\u05d5\u05ea\u2026",
        shot: "19-broadcast-live.png",
        intro:
          "One question, every camera in the zone, one labeled answer per camera. This is the end-of-shift sweep from the booklet, running for real.",
        markers: [
          { n: 1, x: 71.0, y: 2.8 },
          { n: 2, x: 29.0, y: 10.5 },
          { n: 3, x: 39.0, y: 23.5 },
          { n: 4, x: 51.5, y: 17.5 },
          { n: 5, x: 33.0, y: 37.5 },
          { n: 6, x: 91.5, y: 49.0 },
        ],
        steps: [
          [1, "1 \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05d1\u05e9\u05d9\u05d3\u05d5\u05e8", "The scope now resolves the saved camera of the conversation filed into this area."],
          [2, "The sweep question", "\u201c\u05e1\u05e8\u05d9\u05e7\u05ea \u05e1\u05d5\u05e3 \u05de\u05e9\u05de\u05e8\u05ea: \u05d3\u05d5\u05d5\u05d7 \u05de\u05d4 \u05e7\u05d5\u05e8\u05d4 \u05d1\u05e9\u05d8\u05d7 \u05e9\u05dc\u05da\u2026\u201d — asked once, delivered to every camera."],
          [3, "Per-camera answer", "Labeled MacBook Air (0000:0001) — each camera answers in its own name with its own sampled frames."],
          [4, "The evidence collage", "Same three-frame sampling as a normal live question, per camera."],
          [5, "The verdict", "\u05e9\u05e7\u05d8\u2026 \u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9\u05ea \u05ea\u05e9\u05d5\u05de\u05ea \u05de\u05e4\u05e2\u05d9\u05dc — read broadcasts by exception and drill into what flags."],
          [6, "The filed conversation", "\u05ea\u05d3\u05e8\u05d9\u05da \u05de\u05e9\u05de\u05e8\u05ea \u05dc\u05dc\u05d9\u05dc\u05d4 \u05e9\u05e7\u05d8 now sits inside the area — that filing is what the broadcast resolved."],
        ],
      },
      {
        title: "The Incident Board",
        q: "Switch to \u05e0\u05d9\u05d4\u05d5\u05dc \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd. What am I triaging?",
        ph: "\u05d7\u05d9\u05e4\u05d5\u05e9 \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd\u2026",
        shot: "20-incident-board.png",
        alert: true,
        intro:
          "The Incidents tab turns alert noise into casework: real fired alerts — \u05d0\u05d3\u05dd \u05de\u05e8\u05d9\u05dd \u05d9\u05d3 \u05dc\u05de\u05e2\u05dc\u05d4 — merged into incidents, graded, and flowing across columns toward closure.",
        markers: [
          { n: 1, x: 68.5, y: 22.0 },
          { n: 2, x: 47.5, y: 22.0 },
          { n: 3, x: 68.5, y: 40.0 },
          { n: 4, x: 35.0, y: 14.0 },
          { n: 5, x: 22.5, y: 2.6 },
          { n: 6, x: 79.8, y: 7.3 },
        ],
        steps: [
          [1, "\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05d7\u05d3\u05e9\u05d9\u05dd — the triage column", "Three fresh cases, each with the alert frame, severity grade (\u05e0\u05de\u05d5\u05da) and the AI's one-line read."],
          [2, "\u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05d1\u05d8\u05d9\u05e4\u05d5\u05dc / \u05d1\u05d1\u05d9\u05e8\u05d5\u05e8", "Cases an operator owns. One case, one owner — shared ownership is how cases stall."],
          [3, "The incident card", "Time, camera, frame, AI assessment, event count — enough to triage without opening."],
          [4, "KPI strip", "Open counts and response statistics — the shift's performance picture at a glance."],
          [5, "Search & filters", "\u05d7\u05d9\u05e4\u05d5\u05e9 \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd, severity and assignee filters — cut the board to what you own."],
          [6, "The tab badge (3)", "Cases awaiting triage. A professional console runs this number to zero every shift."],
        ],
      },
    ],
  },
  {
    nav: "Settings & Operations",
    pages: [
      {
        title: "Settings: Account & Users",
        q: "Who is this console working as?",
        ph: "\u05e0\u05d4\u05dc \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd\u2026",
        shot: "21-settings-account.png",
        intro:
          "Settings opens from the gear in the sidebar footer. The first section answers the most important operational question on a shared console: who is this work attributed to?",
        markers: [
          { n: 1, x: 75.5, y: 17.5 },
          { n: 2, x: 43.0, y: 31.5 },
          { n: 3, x: 52.5, y: 47.5 },
          { n: 4, x: 33.5, y: 47.5 },
          { n: 5, x: 27.3, y: 53.5 },
        ],
        steps: [
          [1, "The section nav", "\u05d7\u05e9\u05d1\u05d5\u05df \u05d5\u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd, \u05db\u05e0\u05d9\u05e1\u05d4 \u05de\u05d4\u05d9\u05e8\u05d4, \u05e4\u05e7\u05d5\u05d3\u05d4 \u05e7\u05d5\u05dc\u05d9\u05ea, \u05db\u05d5\u05d5\u05e0\u05d5\u05df \u05ea\u05d2\u05d5\u05d1\u05d5\u05ea, \u05de\u05e8\u05db\u05d6 \u05d4\u05dc\u05de\u05d9\u05d3\u05d4 — five sections, covered in order."],
          [2, "The user list", "tester with a green active dot — acknowledgments, notes and closures are signed by this identity."],
          [3, "\u05db\u05d9\u05e0\u05d5\u05d9 — nickname field", "A new operator starts with a name\u2026"],
          [4, "\u05de\u05e4\u05ea\u05d7 Ghost API", "\u2026and a key. The eye toggle reveals it only while you paste."],
          [5, "\u05e6\u05d5\u05e8 \u05de\u05e9\u05ea\u05de\u05e9", "Creates the operator. Switching identities happens in the sidebar footer at every relief."],
        ],
      },
      {
        title: "Settings: Quick-Login Link",
        q: "How do I hand access to a teammate without sharing keys?",
        ph: "\u05e6\u05d5\u05e8 \u05dc\u05d9\u05e0\u05e7 \u05db\u05e0\u05d9\u05e1\u05d4 \u05de\u05d4\u05d9\u05e8\u05d4\u2026",
        shot: "22-settings-quicklink.png",
        intro:
          "\u05db\u05e0\u05d9\u05e1\u05d4 \u05de\u05d4\u05d9\u05e8\u05d4 mints a one-time magic link — the correct way to hand the console to a relief operator, a supervisor, or your own second device.",
        markers: [
          { n: 1, x: 47.5, y: 29.5 },
          { n: 2, x: 31.5, y: 29.5 },
          { n: 3, x: 25.5, y: 29.5 },
          { n: 4, x: 27.0, y: 33.5 },
          { n: 5, x: 27.5, y: 24.7 },
        ],
        steps: [
          [1, "The minted link", "https://\u2026?magic=\u2026 — single-use, already on your clipboard the moment it is created."],
          [2, "\u05d4\u05e2\u05ea\u05e7 \u05dc\u05d9\u05e0\u05e7", "Copies again. Deliver only over your site's approved channel — an unsent link is a signed blank pass."],
          [3, "Open in new tab", "Test door: opening the link lands signed-in, no typing."],
          [4, "\u05e6\u05d5\u05e8 \u05dc\u05d9\u05e0\u05e7 \u05d7\u05d3\u05e9", "Regenerates — voiding the old link. If a link may have leaked: regenerate first, investigate second."],
          [5, "\u05e4\u05d2 \u05ea\u05d5\u05e7\u05e3 \u05d1\u05e2\u05d5\u05d3 15 \u05d3\u05e7\u05f3", "The countdown. Links expire on their own; never archive them."],
        ],
      },
      {
        title: "Settings: Voice Command",
        q: "Configure hands-free operation for me.",
        ph: "\u05d0\u05de\u05d5\u05e8 \u05d0\u05ea \u05de\u05d9\u05dc\u05ea \u05d4\u05e9\u05dc\u05d9\u05d7\u05d4\u2026",
        shot: "23-settings-voice.png",
        intro:
          "\u05e4\u05e7\u05d5\u05d3\u05ea \u05e9\u05dc\u05d9\u05d7\u05d4 \u05e7\u05d5\u05dc\u05d9\u05ea: with voice on, speech becomes text in the composer, and speaking your send phrase fires the message — eyes on the scene, hands on the radio.",
        markers: [
          { n: 1, x: 26.0, y: 27.5 },
          { n: 2, x: 45.5, y: 32.8 },
          { n: 3, x: 26.5, y: 32.8 },
        ],
        steps: [
          [1, "\u05d4\u05e4\u05e2\u05dc\u05ea \u05e4\u05e7\u05d5\u05d3\u05d4 \u05e7\u05d5\u05dc\u05d9\u05ea — master switch", "On: the composer gains a microphone. Off: no listening, ever — some rooms require that posture."],
          [2, "The send phrase — \u05d1\u05d9\u05e6\u05d5\u05e2", "Up to two words, Hebrew or English. Pick something you never say mid-sentence."],
          [3, "\u05e9\u05de\u05d9\u05e8\u05d4", "Saves the phrase. In open-plan rooms, coordinate phrases with neighboring consoles."],
        ],
      },
      {
        title: "Settings: Response Tuning",
        q: "Where are the speed-versus-depth dials?",
        ph: "\u05db\u05d5\u05d5\u05df \u05d0\u05ea \u05d4\u05ea\u05d2\u05d5\u05d1\u05d5\u05ea\u2026",
        shot: "24-settings-tuning.png",
        intro:
          "\u05db\u05d5\u05d5\u05e0\u05d5\u05df \u05ea\u05d2\u05d5\u05d1\u05d5\u05ea holds the dials. Per-conversation dials (accuracy, length, image detail) need an active conversation; the two shown here are console-wide.",
        markers: [
          { n: 1, x: 49.0, y: 26.5 },
          { n: 2, x: 30.0, y: 37.0 },
          { n: 3, x: 30.0, y: 44.0 },
          { n: 4, x: 59.5, y: 66.5 },
        ],
        steps: [
          [1, "\u05de\u05d4\u05d9\u05e8\u05d5\u05ea \u05de\u05d5\u05dc \u05d3\u05d9\u05d5\u05e7 — per-conversation", "Open a conversation first; then this section adds the accuracy (1\u20134), length and image-detail dials for that post."],
          [2, "\u05d0\u05d9\u05db\u05d5\u05ea \u05d4\u05e6\u05d9\u05dc\u05d5\u05dd: \u05d7\u05d3 / \u05de\u05d0\u05d5\u05d6\u05df / \u05de\u05d4\u05d9\u05e8", "How sharply this browser samples frames before sending. \u05d7\u05d3 (sharp) is selected — drop to fast on weak hardware."],
          [3, "The explainer card", "\u05de\u05d4 \u05d6\u05d4 \u05d0\u05d5\u05de\u05e8 \u05d1\u05e4\u05d5\u05e2\u05dc — every dial explains its trade-off in plain words. Read before you turn."],
          [4, "\u05e9\u05d9\u05d5\u05dd \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9: \u05de\u05d5\u05e4\u05e2\u05dc / \u05db\u05d1\u05d5\u05d9", "The global auto-naming switch — the sparkles button on each row overrides it per conversation."],
        ],
      },
      {
        title: "The Learning Center",
        q: "Where do I replay the guided chapters?",
        ph: "\u05d4\u05de\u05e9\u05da \u05de\u05d4\u05d9\u05db\u05df \u05e9\u05e2\u05e6\u05e8\u05ea\u2026",
        shot: "26-onboarding-hub.png",
        intro:
          "\u05de\u05e8\u05db\u05d6 \u05d4\u05dc\u05de\u05d9\u05d3\u05d4 holds eleven guided chapters that spotlight the real console, control by control. When a feature has gone unused for a month, replay its chapter before the shift that needs it.",
        markers: [
          { n: 1, x: 50.0, y: 17.0 },
          { n: 2, x: 50.0, y: 23.0 },
          { n: 3, x: 50.0, y: 64.0 },
          { n: 4, x: 47.0, y: 88.8 },
          { n: 5, x: 59.0, y: 88.8 },
        ],
        steps: [
          [1, "Progress — 0/11 \u05e4\u05e8\u05e7\u05d9\u05dd \u05d4\u05d5\u05e9\u05dc\u05de\u05d5", "Your track record through the chapters, also mirrored in Settings \u2192 \u05de\u05e8\u05db\u05d6 \u05d4\u05dc\u05de\u05d9\u05d3\u05d4."],
          [2, "Chapter 01 — \u05d1\u05e8\u05d5\u05db\u05d9\u05dd \u05d4\u05d1\u05d0\u05d9\u05dd", "The first-entry tour you saw on day one — replayable any time."],
          [3, "Chapters 02\u201311", "\u05ea\u05e4\u05e8\u05d9\u05d8 \u05d4\u05e6\u05d3, \u05de\u05e6\u05dc\u05de\u05d5\u05ea \u05d5\u05e9\u05d9\u05d3\u05d5\u05e8 \u05d7\u05d9, \u05d6\u05d9\u05db\u05e8\u05d5\u05df, \u05d4\u05ea\u05e8\u05d0\u05d5\u05ea\u2026 — each opens a live spotlight on the actual control."],
          [4, "\u05d4\u05de\u05e9\u05da \u05de\u05d4\u05d9\u05db\u05df \u05e9\u05e2\u05e6\u05e8\u05ea", "Resumes mid-course — the hub remembers your place."],
          [5, "\u05d4\u05ea\u05d7\u05dc \u05de\u05d7\u05d3\u05e9", "Resets progress and runs the full course again — recommended before the certification exam."],
        ],
      },
    ],
  },
  {
    nav: "Discipline & Variants",
    pages: [
      {
        title: "The Classified-Information Guard",
        q: "What happens if someone interrogates Ghost about itself?",
        ph: "Ghost \u05dc\u05d0 \u05de\u05e9\u05ea\u05e3 \u05e4\u05e2\u05d5\u05dc\u05d4 \u05e4\u05e0\u05d9\u05de\u05d9\u05ea\u2026",
        shot: "15-security-block-breadcrumbs.png",
        alert: true,
        intro:
          "A real probing attempt, caught live: questions about Ghost's internals draw red classified-information warnings, and the attempt itself is logged. This page also shows the breadcrumb trail of a filed conversation.",
        markers: [
          { n: 1, x: 26.0, y: 47.0 },
          { n: 2, x: 38.0, y: 57.5 },
          { n: 3, x: 38.0, y: 79.0 },
          { n: 4, x: 73.0, y: 2.8 },
        ],
        steps: [
          [1, "The probing question", "\u201c\u05d0\u05d9\u05d6\u05d4 \u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05d5\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea \u05d0\u05d5\u05ea\u05da?\u201d — operators do not need this, and Ghost knows it."],
          [2, "\u05d0\u05d6\u05d4\u05e8\u05ea \u05d3\u05dc\u05d9\u05e4\u05ea \u05de\u05d9\u05d3\u05e2 \u05de\u05e1\u05d5\u05d5\u05d2 — the red block", "\u05de\u05d9\u05d3\u05e2 \u05de\u05e1\u05d5\u05d5\u05d2. Ghost \u05dc\u05d0 \u05d7\u05d5\u05e9\u05e3 \u05d0\u05ea \u05d0\u05d5\u05e4\u05df \u05e4\u05e2\u05d5\u05dc\u05ea\u05d5 — the refusal is branded, calm, and final."],
          [3, "The logged attempt", "\u201cThis request has been logged as an attempt to access classified technical information\u201d — treat a colleague probing like this as a reportable event."],
          [4, "Breadcrumbs — \u05de\u05e4\u05e2\u05dc \u05de\u05d2\u05dd \u05e6\u05d9\u05e4\u05d5\u05e8\u05d9 \u203a \u05d7\u05e0\u05d9\u05d9\u05d4 \u203a 1 \u05de\u05dc\u05d0 \u05de\u05d4\u05d9\u05e8", "A filed conversation shows its full path; clicking an ancestor opens that scope's broadcast."],
        ],
      },
      {
        title: "Dark Mode",
        q: "Show me the console the way a night shift runs it.",
        ph: "\u05d4\u05d7\u05dc\u05e3 \u05e2\u05e8\u05db\u05ea \u05e0\u05d5\u05e9\u05d0\u2026",
        shot: "27-dark-mode.png",
        intro:
          "The sun/moon control in the sidebar footer flips the entire console to dark — doctrine for night shifts and dim control rooms. Every control you have learned sits exactly where you left it.",
        markers: [
          { n: 1, x: 84.8, y: 96.8 },
          { n: 2, x: 89.5, y: 2.6 },
          { n: 3, x: 40.0, y: 50.0 },
          { n: 4, x: 40.0, y: 94.0 },
        ],
        steps: [
          [1, "The theme toggle", "One press in the footer; the choice persists on this console between sessions."],
          [2, "Same chrome, inverted ink", "Clock, tabs and tree — identical layout, monochrome dark palette, red still reserved for alerts and seconds."],
          [3, "The thread, readable in the dark", "Contrast is tuned for long night watches — body text stays soft, evidence frames stay bright."],
          [4, "The composer, unchanged", "Muscle memory survives the theme: every control from this appendix is in the same place."],
        ],
      },
    ],
  },
];

// ── CSS (light gopdf line + figure/instruction layer) ────────────────────────
const CSS = `
  :root {
    --bg-primary: #ffffff; --bg-sidebar: #f7f7f7; --bg-surface: #f0f0f0;
    --bg-surface-hover: #e8e8e8; --bg-code: #fafafa;
    --text-primary: #161616; --text-secondary: #5d5d5d; --text-muted: #9a9a9a;
    --border-subtle: #e2e2e2; --accent: #161616; --accent-ink: #ffffff;
    --alert: #c43c3c;
    --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    --mono: ui-monospace, "Cascadia Code", "SF Mono", Menlo, Consolas, monospace;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #ededed; color: var(--text-primary); font-family: var(--sans); -webkit-font-smoothing: antialiased; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .mono { font-family: var(--mono); letter-spacing: 0.04em; }

  .page { width: 210mm; height: 297mm; margin: 0 auto; background: var(--bg-primary); display: flex; overflow: hidden; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .sidebar { width: 58mm; flex-shrink: 0; background: var(--bg-sidebar); border-right: 1px solid var(--border-subtle); display: flex; flex-direction: column; padding: 16px 12px; gap: 8px; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 6px 6px 14px; }
  .brand img { width: 30px; height: 30px; border-radius: 9px; display: block; }
  .brand .name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  .brand .name .sub { display: block; font-size: 9.5px; font-weight: 400; color: var(--text-muted); margin-top: 1px; }
  .newchat { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border: 1px solid var(--border-subtle); border-radius: 12px; color: var(--text-secondary); font-size: 13px; background: var(--bg-primary); }
  .newchat .plus { width: 16px; height: 16px; position: relative; opacity: 0.85; }
  .newchat .plus::before, .newchat .plus::after { content: ""; position: absolute; background: var(--text-secondary); }
  .newchat .plus::before { left: 7px; top: 1px; width: 2px; height: 14px; border-radius: 2px; }
  .newchat .plus::after { top: 7px; left: 1px; height: 2px; width: 14px; border-radius: 2px; }
  .nav-label { font-size: 11px; font-weight: 600; color: var(--text-muted); padding: 14px 10px 4px; }
  .nav-item { display: flex; align-items: center; gap: 9px; height: 36px; padding: 0 11px; border-radius: 11px; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nav-item .ix { font-size: 10px; color: var(--text-muted); width: 16px; flex-shrink: 0; }
  .nav-item.active { background: var(--bg-surface-hover); color: var(--text-primary); }
  .nav-item.active .ix { color: var(--text-primary); }
  .sidebar .spacer { flex: 1; }
  .sidebar .foot { border-top: 1px solid var(--border-subtle); padding: 12px 10px 2px; font-size: 10.5px; color: var(--text-muted); line-height: 1.5; }
  .sidebar .foot b { color: var(--text-secondary); font-weight: 600; }

  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar { height: 50px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 22px; border-bottom: 1px solid var(--border-subtle); }
  .topbar .title { font-size: 14px; font-weight: 600; }
  .topbar .meta { font-size: 11px; color: var(--text-muted); }

  .thread { flex: 1; overflow: hidden; padding: 18px 22px 6px; display: flex; flex-direction: column; }
  .wrap { width: 100%; max-width: 168mm; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }

  .msg-user { display: flex; justify-content: flex-end; }
  .msg-user .bubble { max-width: 80%; background: var(--bg-surface); border-radius: 18px; padding: 9px 15px; font-size: 13px; line-height: 1.5; }

  .msg-ai { display: flex; gap: 12px; }
  .msg-ai .av { width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0; overflow: hidden; margin-top: 2px; }
  .msg-ai .av img { width: 100%; height: 100%; display: block; }
  .msg-ai .body { flex: 1; min-width: 0; }
  .msg-ai .body .kicker { font-size: 10px; color: var(--text-muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6px; font-family: var(--mono); }
  .msg-ai .body .intro { font-size: 12px; line-height: 1.55; color: var(--text-primary); }
  .msg-ai .body .intro b { font-weight: 600; }

  /* screenshot figure with instruction layer */
  .fig { margin-top: 10px; position: relative; border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
  .fig img { width: 100%; display: block; }
  .marker { position: absolute; width: 19px; height: 19px; margin: -9.5px 0 0 -9.5px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-family: var(--mono); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 3.5px rgba(22,22,22,0.35), 0 1px 4px rgba(0,0,0,0.4); }
  .marker.red { background: var(--alert); box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 3.5px rgba(196,60,60,0.4), 0 1px 4px rgba(0,0,0,0.4); }
  .figbar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; padding: 4px 10px; background: linear-gradient(to top, rgba(22,22,22,0.55), transparent); }
  .figbar span { font-family: var(--mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.9); }
  .maskbox { position: absolute; background: rgba(120,120,120,0.92); border: 1px solid rgba(255,255,255,0.6); display: flex; align-items: flex-end; justify-content: center; }
  .maskbox span { font-family: var(--mono); font-size: 6.5px; letter-spacing: 0.14em; color: rgba(255,255,255,0.85); padding-bottom: 3px; text-transform: uppercase; }

  /* step legend */
  .legend { margin-top: 10px; display: flex; flex-direction: column; }
  .legend .step { display: flex; gap: 10px; align-items: flex-start; padding: 6.5px 0; border-bottom: 1px solid var(--border-subtle); }
  .legend .step:last-child { border-bottom: none; }
  .legend .num { flex-shrink: 0; width: 17px; height: 17px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-family: var(--mono); font-size: 9.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .legend .num.red { background: var(--alert); }
  .legend .tx { min-width: 0; font-size: 11px; line-height: 1.45; }
  .legend .tx b { font-weight: 600; color: var(--text-primary); }
  .legend .tx span { color: var(--text-secondary); }

  .composer-wrap { padding: 6px 22px 14px; }
  .composer { max-width: 168mm; margin: 0 auto; background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: 24px; padding: 9px 12px 9px 18px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .composer .ph { flex: 1; font-size: 12.5px; color: var(--text-muted); }
  .composer .send { width: 27px; height: 27px; border-radius: 50%; background: var(--accent); flex-shrink: 0; position: relative; }
  .composer .send::after { content: ""; position: absolute; left: 50%; top: 52%; width: 7px; height: 7px; border-top: 2px solid var(--accent-ink); border-right: 2px solid var(--accent-ink); transform: translate(-50%,-50%) rotate(-45deg); }
  .disclaimer { max-width: 168mm; margin: 7px auto 0; text-align: center; font-size: 10px; color: var(--text-muted); }
`;

function sidebar(activeIdx) {
  const items = SECTIONS.map((s, i) => {
    const n = String(i + 1).padStart(2, "0");
    return `      <div class="nav-item${i === activeIdx ? " active" : ""}"><span class="ix">${n}</span><span>${s.nav}</span></div>`;
  }).join("\n");
  return `  <aside class="sidebar">
    <div class="brand">
      <img src="${ICON}" alt="Ghost" />
      <div class="name">Ghost<span class="sub">Visual Field Appendix</span></div>
    </div>
    <div class="newchat"><span class="plus"></span><span>New conversation</span></div>
    <div class="nav-label">Sections</div>
${items}
    <div class="spacer"></div>
    <div class="foot"><b>Ghost Academy</b><br />Appendix A &middot; Real Console Screens &middot; 2026</div>
  </aside>`;
}

function renderPage(page, sectionIdx, num, total) {
  const nn = String(num).padStart(2, "0");
  const tt = String(total).padStart(2, "0");
  const red = page.alert ? " red" : "";
  const markers = (page.markers || [])
    .map((m) => `        <span class="marker${red}" style="left:${m.x}%;top:${m.y}%;">${m.n}</span>`)
    .join("\n");
  const masks = (page.mask || [])
    .map((m) => `        <span class="maskbox" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%;"><span>${m.label}</span></span>`)
    .join("\n");
  const steps = page.steps
    .map(
      ([n, action, result]) => `            <div class="step"><span class="num${red}">${n}</span><div class="tx"><b>${action}</b> — <span>${result}</span></div></div>`,
    )
    .join("\n");
  return `<!-- ============ APPENDIX PAGE ${nn} — ${page.title} ============ -->
<div class="page">
${sidebar(sectionIdx)}
  <div class="main">
    <div class="topbar">
      <div class="title">${page.title}</div>
      <div class="meta mono">A-${nn} / A-${tt}</div>
    </div>
    <div class="thread">
      <div class="wrap">
        <div class="msg-user"><div class="bubble">${page.q}</div></div>
        <div class="msg-ai">
          <div class="av"><img src="${ICON}" alt="Ghost" /></div>
          <div class="body">
            <div class="kicker">Live console capture &middot; unedited screen</div>
            <p class="intro">${page.intro}</p>
          </div>
        </div>
        <figure class="fig">
          <img src="${SHOTS}/${page.shot}" alt="${page.title}" />
${masks}
${markers}
          <div class="figbar"><span>Ghost // Console</span><span>Captured live &middot; 2026</span></div>
        </figure>
        <div class="legend">
${steps}
        </div>
      </div>
    </div>
    <div class="composer-wrap">
      <div class="composer"><span class="ph">${page.ph}</span><span class="send"></span></div>
      <div class="disclaimer">Ghost Academy &middot; Operator Training Program &middot; Visual Field Appendix &middot; Confidential</div>
    </div>
  </div>
</div>`;
}

const flat = [];
SECTIONS.forEach((s, si) => s.pages.forEach((p) => flat.push({ p, si })));
const total = flat.length;

const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ghost — Operator Training: Visual Field Appendix</title>
<style>${CSS}</style>
</head>
<body>

${flat.map(({ p, si }, i) => renderPage(p, si, i + 1, total)).join("\n\n")}

</body>
</html>
`;

writeFileSync(join(ROOT, "operator-training-appendix.html"), html);
console.log(`Wrote operator-training-appendix.html — ${total} pages.`);
