// Part V — Organizing a Site at Scale (5 pages)
export default {
  nav: "Organizing at Scale",
  pages: [
    {
      title: "Areas & Groups",
      q: "I have forty cameras. How do I keep the sidebar sane?",
      ph: "Create a new area\u2026",
      body: `
            <div class="kicker mono">Organization &middot; Lesson 1</div>
            <p class="lead">Mirror the site, not the org chart. <span class="dim">Area &rarr; group &rarr; conversation.</span></p>
            <p>The sidebar organizes conversations into a two-level tree, exactly like a well-run messaging workspace: <b>areas</b> contain <b>camera groups</b>, and groups contain conversations. A logistics campus might be: area "North Compound" &rarr; groups "Gates", "Loading Docks", "Warehouse Floor" &rarr; one conversation per camera.</p>
            <ol class="steps">
              <li><div><div class="st-t">Create an area</div><div class="st-d">Press "New area" at the top of the organization section, type a name, press Enter. Name areas after physical zones: "Perimeter", "Production Hall B", "Visitor Parking".</div></div></li>
              <li><div><div class="st-t">Add groups inside it</div><div class="st-d">Hover the area header and press the + that appears. Groups subdivide by function: "Entry Gates", "Emergency Exits", "Cold Storage".</div></div></li>
              <li><div><div class="st-t">File conversations</div><div class="st-d">Hover a conversation, press the folder button, and choose its destination — a group, or directly in an area. "Unassigned" returns it to the free list.</div></div></li>
            </ol>
            <p>Hover an area or group header for its management controls: rename, delete, and collapse. Deleting a container asks for confirmation and releases its conversations back to the free list — it never deletes the conversations themselves.</p>`,
    },
    {
      title: "Drag, Drop & Order",
      q: "Can I just drag things where I want them?",
      ph: "Drag a conversation into a group\u2026",
      body: `
            <div class="kicker mono">Organization &middot; Lesson 2</div>
            <p class="lead">Everything in the tree <span class="dim">moves by drag and drop.</span></p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Drag conversations anywhere</div><div class="ft-desc">Grab the handle on a hovered conversation and drop it into a group, directly into an area, or back onto the free list. Drop zones highlight as you pass over them.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Reorder within a container</div><div class="ft-desc">Order is yours to control. Put the busiest cameras at the top of each group — the ones you open ten times a shift should cost zero scrolling.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Move whole groups</div><div class="ft-desc">Groups drag too — reorder them inside an area or move a group to a different area entirely when the site is re-zoned.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Collapse what you are not watching</div><div class="ft-desc">The chevron on each area and group folds it away. A disciplined operator keeps only the active zone expanded — the tree shows state of attention, not just structure.</div></div></li>
            </ul>
            <div class="drill">
              <div class="d-k">Field drill 7</div>
              <div class="d-t">Build your site tree</div>
              <div class="d-b">Create two areas with two groups each and file your existing conversations into them. Pass condition: nothing remains unassigned, and the busiest conversation sits first in its group.</div>
            </div>
            <p>Note: the tree is your console's working layout. Build it once, maintain it weekly — a tidy tree is what makes the three-clicks promise real on a large site.</p>`,
    },
    {
      title: "Broadcast: One Question, Many Cameras",
      q: "Can I ask every camera in a zone the same question at once?",
      ph: "Send to all cameras in this area\u2026",
      body: `
            <div class="kicker mono">Organization &middot; Lesson 3</div>
            <p class="lead">Question the zone, <span class="dim">not the camera.</span></p>
            <p>Every area and group can be opened as a <b>broadcast conversation</b>: one question, sent simultaneously to every saved camera inside that scope, with one labeled answer per camera. This is the control-room power move — a sweep of an entire zone in a single message.</p>
            <ol class="steps">
              <li><div><div class="st-t">Open the scope</div><div class="st-d">Click the area or group name in the sidebar (or its radio icon, or the breadcrumb in the conversation header). The main view switches to the broadcast chat, showing the scope name and how many cameras it resolved.</div></div></li>
              <li><div><div class="st-t">Ask once</div><div class="st-d">"Are all emergency exits clear and unobstructed?" — send. Ghost samples every camera in the scope and streams back one answer per camera, each labeled with its conversation and camera.</div></div></li>
              <li><div><div class="st-t">Read by exception, then close</div><div class="st-d">Scan for the answers that report a problem; follow up inside the specific camera's own conversation. The &times; returns you to normal chat. Broadcast transcripts are ephemeral — working sessions, not archives.</div></div></li>
            </ol>
            <div class="sample">
              <div class="sm-head mono">broadcast &middot; area: North Compound &middot; 6 cameras</div>
              <div class="sm-body">
                <div class="sm-q">End-of-shift sweep: any door open, any vehicle remaining, anything that needs attention before lockdown?</div>
                <div class="sm-a"><b>Gate 1:</b> barrier down, lane empty. <b>Dock 3:</b> one box truck still at bay 2, driver in cab. <b>Warehouse East:</b> pedestrian door propped open with a pallet&hellip;</div>
              </div>
            </div>`,
    },
    {
      title: "Mastering the Sidebar",
      q: "Any sidebar tricks I should know before a busy shift?",
      ph: "Resize the sidebar\u2026",
      body: `
            <div class="kicker mono">Organization &middot; Lesson 4</div>
            <p class="lead">The sidebar is your map table. <span class="dim">Set it up like you mean it.</span></p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Resize by dragging the edge</div><div class="ft-desc">Drag the sidebar's inner edge to any width between compact and wide; double-click the handle to snap back to the default. Long conversation names deserve a wider rail.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Collapse for full-screen focus</div><div class="ft-desc">The close control folds the sidebar away entirely — the thread takes the whole monitor. A slim tab on the screen edge brings it back. Ghost remembers your choice between sessions.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Chat / Incidents tabs</div><div class="ft-desc">Two view tabs sit at the top of the rail. "Chat" is everything you have learned so far; "Incidents" opens the incident board from Part VII. A counter badge on the Incidents tab shows new incidents waiting for triage.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Live thumbnails on hover</div><div class="ft-desc">Hover a conversation that has saved cameras and its row shows a live thumbnail glimpse — confirm you are entering the right camera before you click.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">The operator clock</div><div class="ft-desc">The header carries a seconds-precision local clock. When you log an event time in a report, that clock is your reference.</div></div></li>
            </ul>
            <p>Footer controls — user switcher, theme toggle, Settings, and sign-out — are covered in Part IX. For now: know they live at the bottom of the rail, one click away.</p>`,
    },
    {
      title: "The Three-Clicks Doctrine in Practice",
      q: "Tie it together — how does a real shift use this structure?",
      ph: "Open the area chat for the perimeter\u2026",
      body: `
            <div class="kicker mono">Organization &middot; Lesson 5</div>
            <p class="lead">Structure is speed. <span class="dim">Here is the rhythm of a well-run console.</span></p>
            <p>With the tree built and broadcast in your toolkit, a site sweep that once took twenty minutes of tile-staring becomes three moves:</p>
            <div class="codeblock">
              <div class="cb-head"><span class="mono">shift-sweep-pattern</span><span class="copy mono">copy</span></div>
              <div class="cb-body">
                <div class="pipe">
                  <div class="node"><span class="n-t">Broadcast the area</span><span class="n-s">one question, every camera</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Read by exception</span><span class="n-s">only flagged answers</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Drill into the camera</span><span class="n-s">its own conversation</span></div>
                </div>
              </div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Start of shift</div><div class="ft-desc">Broadcast each area: "Anything abnormal, unsafe, or out of place I should know about at handover?" Three areas, three questions, full situational picture in five minutes.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">During the shift</div><div class="ft-desc">Work by exception. Standing alerts (Part VI) interrupt you when rules break; between interrupts, broadcast sweeps on a cadence appropriate to the site's risk.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">End of shift</div><div class="ft-desc">A final broadcast sweep per area, plus a long-format summary question in each critical conversation — that output is the skeleton of your handover report.</div></div></li>
            </ul>
            <div class="drill">
              <div class="d-k">Field drill 8</div>
              <div class="d-t">The five-minute sweep</div>
              <div class="d-b">Run a full start-of-shift sweep of your practice tree using broadcasts only. Pass condition: complete situational picture, under five minutes, without opening a single camera tile manually.</div>
            </div>`,
    },
  ],
};
