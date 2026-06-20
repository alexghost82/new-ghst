// Part VIII — Memory & Site Intelligence (5 pages)
export default {
  nav: "Memory & Intelligence",
  pages: [
    {
      title: "The Memory Panel",
      q: "Ghost says it remembers what it saw. Where do I see that memory?",
      ph: "Open the memory panel\u2026",
      body: `
            <div class="kicker mono">Memory &middot; Lesson 1</div>
            <p class="lead">Three layers of memory, <span class="dim">one brain icon in the header.</span></p>
            <p>The brain icon in the conversation header opens the memory panel — your window into what this conversation has accumulated about its scene. It holds three layers:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Tracking</div><div class="ft-desc">With the tracking toggle on, Ghost continuously logs what moves through the scene — people, vehicles, equipment — building a structured record of activity. Filters and search let you cut the log by type and time.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Observations</div><div class="ft-desc">Visual memory: entities and scene facts Ghost has noticed across its samples — the white van that visits every morning, the pallet stack that has been growing by the east wall.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Facts</div><div class="ft-desc">Distilled, standing knowledge this conversation holds: things stated or established that shape future answers. Each fact carries a delete control — memory you can prune.</div></div></li>
            </ul>
            <p>Maintenance is part of the craft: when the site changes, stale facts mislead future answers. Open the panel after every site change, read what Ghost believes, and delete what is no longer true. The tracking engine yields automatically while alert mode is armed — the watch always has priority over the diary.</p>`,
    },
    {
      title: "Site Intelligence",
      q: "What does the scan button in the header do?",
      ph: "Run a site intelligence scan\u2026",
      body: `
            <div class="kicker mono">Memory &middot; Lesson 2</div>
            <p class="lead">One press reads the whole place — <span class="dim">a structured survey of the scene.</span></p>
            <p>The scan-eye button in the conversation header triggers a <b>Site Intelligence</b> report: Ghost samples the camera and returns not an answer to a question, but a structured read of the entire environment — layout, zones, entry points, activity, equipment, and anything an experienced supervisor would flag on a first walk-through.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">When you adopt a new camera</div><div class="ft-desc">Run a scan as your first act. The report orients you — and the conversation — to what this view actually covers and where its blind edges are.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">At a shift's start on critical posts</div><div class="ft-desc">A scan gives you a baseline. Anything that deviates from it later in the shift is a question waiting to be asked.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Before writing alert rules</div><div class="ft-desc">The report names the features your rules should reference — the fire lane, the fence line, the chemical store door — in the language Ghost itself uses for this scene.</div></div></li>
            </ul>
            <div class="sample">
              <div class="sm-head mono">site-intelligence &middot; excerpt</div>
              <div class="sm-body">
                <div class="sm-a"><b>Coverage:</b> single fixed view over the north loading apron; two dock doors, one pedestrian door, fire lane along the left edge. <b>Activity:</b> one box truck at bay 2, dock plate down, two staff handling pallets. <b>Attention:</b> pedestrian door propped open; pallet stack within a meter of the fire lane boundary&hellip;</div>
              </div>
            </div>
            <p>The report lands in the thread like any answer — with its sampled frame — so it is quotable, copyable, and part of the record.</p>`,
    },
    {
      title: "Questioning the Past",
      q: "How do I investigate something that already happened?",
      ph: "Who was at the east gate during the night?\u2026",
      body: `
            <div class="kicker mono">Memory &middot; Lesson 3</div>
            <p class="lead">Ask the past like you ask the present. <span class="dim">Who, what, when — with timestamps back.</span></p>
            <p>Because every answer, frame, alert card, and tracked entity persists in the conversation, history is not footage to scrub — it is a record to question. Keep live off (you are asking about then, not now) and interrogate:</p>
            <div class="dodont">
              <div class="dd good">
                <div class="dd-h">Investigation questions</div>
                <ul>
                  <li>"Summarize everything unusual in this conversation since 22:00."</li>
                  <li>"When did the box truck at bay 2 leave, and was the dock door closed after it?"</li>
                  <li>"Did anyone enter through the propped pedestrian door while it was open?"</li>
                  <li>"List every alert tonight in order, one line each, with times."</li>
                </ul>
              </div>
              <div class="dd">
                <div class="dd-h">Keep in mind</div>
                <ul>
                  <li>Ghost's past is what it observed and recorded — sampled moments, not a continuous tape</li>
                  <li>Memory is per conversation: ask the camera that was there</li>
                  <li>For zone-wide history, ask each relevant post, then have one conversation merge the picture</li>
                </ul>
              </div>
            </div>
            <p>The discipline of timestamps: always ask for times, and always cross-check a critical time against the message hover-timestamps and the frame watermarks. When your report says 02:47, three sources should agree.</p>
            <div class="drill">
              <div class="d-k">Field drill 12</div>
              <div class="d-t">Reconstruct an hour</div>
              <div class="d-b">Pick a conversation with at least an hour of history and reconstruct that hour using questions only — no scrolling. Pass condition: a timeline of events with times, verified against the thread's own timestamps.</div>
            </div>`,
    },
    {
      title: "The Knowledge Base",
      q: "Can Ghost use my site's documents — procedures, layouts, contact lists?",
      ph: "Add a source to the knowledge base\u2026",
      body: `
            <div class="kicker mono">Memory &middot; Lesson 4</div>
            <p class="lead">Give Ghost your paperwork, <span class="dim">and its answers start citing your procedures.</span></p>
            <p>The knowledge base holds documents Ghost can draw on when answering: standard operating procedures, site maps and zone definitions, escalation contact lists, contractor schedules, safety rules. Upload files (PDF, Word, text) or paste text directly as a source; tag each source so it is findable later.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">What belongs in it</div><div class="ft-desc">Anything you would want a new operator to have read: "Fire lane policy", "After-hours contractor procedure", "Tanker unloading checklist". If your shift quotes it, Ghost should hold it.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Activate and deactivate sources</div><div class="ft-desc">Each source toggles on and off without deleting — switch seasonal procedures in and out as the site's posture changes.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Keep it current</div><div class="ft-desc">An outdated procedure in the knowledge base is worse than none: Ghost will quote it with confidence. Version your uploads and retire the old one in the same action.</div></div></li>
            </ul>
            <p>The payoff shows in answers: ask "the dock door is jammed open — what is the procedure and who do I call?" and Ghost answers from <em>your</em> SOP with <em>your</em> escalation contacts, not from generic knowledge. That is the difference between an assistant and a trained colleague.</p>`,
    },
    {
      title: "Memory Hygiene",
      q: "How do I keep all this accumulated memory accurate?",
      ph: "Review this conversation's stored facts\u2026",
      body: `
            <div class="kicker mono">Memory &middot; Lesson 5</div>
            <p class="lead">Memory is an asset <span class="dim">only while it is true.</span></p>
            <p>Everything in this part — tracking logs, observations, facts, knowledge sources — improves answers while it reflects reality and degrades them when it does not. Professional consoles run a hygiene routine:</p>
            <ol class="steps">
              <li><div><div class="st-t">Weekly: read the facts layer</div><div class="st-d">Open the memory panel on your critical conversations and read what Ghost holds as standing truth. Delete anything the site has outgrown — the relocated fuel cage, the contractor whose project ended.</div></div></li>
              <li><div><div class="st-t">On every physical change: re-baseline</div><div class="st-d">Camera moved, wall built, layout re-zoned: re-run Site Intelligence, correct the system prompt, re-check alert rules, and prune stale observations — in that order.</div></div></li>
              <li><div><div class="st-t">Monthly: audit the knowledge base</div><div class="st-d">Every source gets one question: is this still the current version? Replace or deactivate anything that is not.</div></div></li>
              <li><div><div class="st-t">Tune the tracking flow</div><div class="st-d">The memory panel's batch controls govern how tracked detections accumulate and flush. Busy scenes may warrant larger batches; quiet critical posts, immediate ones. Defaults are sound — change them with a reason.</div></div></li>
            </ol>
            <p>The principle from Part II returns: you keep the system honest. Ghost will never resent a deletion — but it will faithfully repeat yesterday's truth until you correct it.</p>`,
    },
  ],
};
