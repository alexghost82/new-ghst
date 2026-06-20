// Part I — Welcome (3 pages)
export default {
  nav: "Welcome & Orientation",
  pages: [
    {
      title: "Welcome to the Program",
      q: "I'm starting as a Ghost operator. Where do I begin?",
      ph: "Tell Ghost what you want to learn first\u2026",
      body: `
            <div class="kicker mono">Ghost Academy &middot; Operator Certification Track</div>
            <p class="lead">Welcome. By the end of this program, <span class="dim">every camera you operate will answer to you.</span></p>
            <p>Ghost is not another wall of screens to stare at. It is a colleague that watches your site with you, remembers what it saw, and answers in plain language. Your cameras already see everything — this program teaches you to question them.</p>
            <p>You were selected for this track because operating Ghost well is a craft. The system is deliberately simple — a conversation — but the difference between an average operator and an excellent one is enormous: in the questions they ask, the standing instructions they write, the alert rules they arm, and the way they run a shift.</p>
            <div class="stats">
              <div class="stat"><div class="s-b">10</div><div class="s-l">Course parts</div></div>
              <div class="stat"><div class="s-b">50</div><div class="s-l">Lessons, one per page</div></div>
              <div class="stat"><div class="s-b">14</div><div class="s-l">Hands-on field drills</div></div>
              <div class="stat"><div class="s-b">1</div><div class="s-l">Certification exam</div></div>
            </div>
            <div class="drill">
              <div class="d-k">Before you begin</div>
              <div class="d-t">Get your access sorted</div>
              <div class="d-b">You will need operator credentials for the Ghost console and at least one connected camera to practice with. If you have neither yet, Part II walks you through both. Keep this booklet open beside the console — every lesson is designed to be performed, not just read.</div>
            </div>`,
    },
    {
      title: "How This Program Works",
      q: "How is the training structured, and how will I be evaluated?",
      ph: "Ask about the certification requirements\u2026",
      body: `
            <p class="lead">Read a lesson. Perform it on a live console. <span class="dim">Repeat until it is muscle memory.</span></p>
            <p>Each page of this booklet is one lesson, framed the way you will actually work: a question to Ghost, and Ghost's answer. Lessons build on each other — the conversation core comes before cameras, cameras before organization at scale, organization before standing alerts. Do not skip ahead; an operator who arms alerts before mastering question phrasing writes rules that fire on noise.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Lessons</div><div class="ft-desc">Plain-language explanation of one capability: what it does, where it lives on screen, and when a professional reaches for it.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Field drills</div><div class="ft-desc">Marked exercises performed on a live console with a real camera. Each drill has a pass condition — do not move on until you meet it.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Doctrine notes</div><div class="ft-desc">The reasoning behind the interface. Knowing why Ghost is built as a conversation makes you faster when something unexpected happens.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Capstone &amp; certification</div><div class="ft-desc">Part X closes with full-shift exercises and the certification exam: a timed, scenario-based practical assessment on a live site.</div></div></li>
            </ul>
            <p>Plan for roughly two focused days: one for Parts I&ndash;V (conversation, cameras, organization) and one for Parts VI&ndash;X (alerts, incidents, memory, operations, certification).</p>`,
    },
    {
      title: "The Syllabus at a Glance",
      q: "Show me the full syllabus before we start.",
      ph: "Jump to any part of the course\u2026",
      body: `
            <p class="lead">Ten parts. <span class="dim">From your first question to running an entire site.</span></p>
            <div class="toc">
              <div class="toc-row"><span class="toc-n">I</span><span class="toc-t">Welcome &amp; Orientation</span><span class="toc-d">3 lessons</span></div>
              <div class="toc-row"><span class="toc-n">II</span><span class="toc-t">Doctrine &amp; First Entry</span><span class="toc-d">4 lessons</span></div>
              <div class="toc-row"><span class="toc-n">III</span><span class="toc-t">The Conversation Core</span><span class="toc-d">7 lessons</span></div>
              <div class="toc-row"><span class="toc-n">IV</span><span class="toc-t">Cameras &amp; the Live Stage</span><span class="toc-d">7 lessons</span></div>
              <div class="toc-row"><span class="toc-n">V</span><span class="toc-t">Organizing a Site at Scale</span><span class="toc-d">5 lessons</span></div>
              <div class="toc-row"><span class="toc-n">VI</span><span class="toc-t">Standing Alerts</span><span class="toc-d">6 lessons</span></div>
              <div class="toc-row"><span class="toc-n">VII</span><span class="toc-t">Incident Management</span><span class="toc-d">4 lessons</span></div>
              <div class="toc-row"><span class="toc-n">VIII</span><span class="toc-t">Memory &amp; Site Intelligence</span><span class="toc-d">5 lessons</span></div>
              <div class="toc-row"><span class="toc-n">IX</span><span class="toc-t">Settings &amp; Daily Operations</span><span class="toc-d">4 lessons</span></div>
              <div class="toc-row"><span class="toc-n">X</span><span class="toc-t">The Operator's Craft &amp; Certification</span><span class="toc-d">5 lessons</span></div>
            </div>
            <p style="margin-top:14px;">Parts III through VI are the heart of the craft — the conversation, the cameras, the structure, and the watch. Everything after them turns a competent user into a professional operator.</p>`,
    },
  ],
};
