// Part VII — Incident Management (4 pages)
export default {
  nav: "Incident Management",
  pages: [
    {
      title: "The Incident Board",
      q: "What is the Incidents tab in the sidebar?",
      ph: "Open the incident board\u2026",
      body: `
            <div class="kicker mono">Incidents &middot; Lesson 1</div>
            <p class="lead">Alerts are moments. <span class="dim">Incidents are the cases they become.</span></p>
            <p>Switch the sidebar to the <b>Incidents</b> tab and the main view becomes the incident board — a column flow that tracks every case from first signal to closure. Ghost feeds it automatically: alert events arriving close together on the same post are merged into a single incident, given an AI severity assessment and a working summary, and placed in the first column.</p>
            <div class="codeblock">
              <div class="cb-head"><span class="mono">incident-flow</span><span class="copy mono">copy</span></div>
              <div class="cb-body">
                <div class="pipe">
                  <div class="node"><span class="n-t">New</span><span class="n-s">awaiting triage</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Investigating</span><span class="n-s">operator assigned</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Resolved</span><span class="n-s">action complete</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Closed</span><span class="n-s">documented</span></div>
                </div>
              </div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">The badge is your queue</div><div class="ft-desc">The counter on the Incidents tab shows cases awaiting triage. A professional console runs that badge to zero every shift.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Merging tames alarm storms</div><div class="ft-desc">A person testing the fence will trip the same rule five times in a minute. The board shows one incident with five events — you triage a case, not a flood.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">KPIs across the top</div><div class="ft-desc">Open counts, response times, and closure statistics — your shift's performance picture at a glance.</div></div></li>
            </ul>`,
    },
    {
      title: "The Incident Workspace",
      q: "I opened an incident. What can I do inside it?",
      ph: "Open the incident timeline\u2026",
      body: `
            <div class="kicker mono">Incidents &middot; Lesson 2</div>
            <p class="lead">One case, one room: <span class="dim">timeline, evidence, notes, people.</span></p>
            <p>Clicking an incident opens its workspace — the case file where everything about the event lives together:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Timeline</div><div class="ft-desc">Every event in the case in strict order: the triggering alerts, status changes, assignments, notes, and closures — each stamped with time and author. This is the document an after-action review reads first.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Evidence</div><div class="ft-desc">Alert frames attach automatically; you add more as the case develops — additional captures, downloaded clips, relevant documents. Evidence added during the event is worth ten times evidence reconstructed after it.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Notes</div><div class="ft-desc">Your operational annotations: "Patrol dispatched 14:32", "Contractor confirmed authorized by site manager", "Gate relocked and verified". Write notes as facts with times, not impressions.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Assignment</div><div class="ft-desc">Assign the incident to the operator who owns it. One case, one owner — shared ownership is how cases stall between shifts.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Status &amp; severity</div><div class="ft-desc">Move the case along the column flow and correct the AI's severity call when your judgment differs. The human grade is the one that counts.</div></div></li>
            </ul>
            <p>Correlated incidents — other cases involving the same post or window — surface alongside, so a pattern across three nights is visible the moment you open the third case.</p>`,
    },
    {
      title: "AI Investigation & Summaries",
      q: "Can Ghost help me investigate and write up a case?",
      ph: "Run an AI investigation on this incident\u2026",
      body: `
            <div class="kicker mono">Incidents &middot; Lesson 3</div>
            <p class="lead">Ghost drafts. <span class="dim">You verify, correct, and sign.</span></p>
            <p>Two AI actions inside the workspace save you the slowest parts of casework:</p>
            <div class="chips">
              <div class="chip"><div class="c-t">Investigate</div><div class="c-d">Ghost reviews the incident's events, frames, and notes, and returns an analysis: most likely sequence, gaps worth checking, follow-up questions worth asking the cameras.</div></div>
              <div class="chip"><div class="c-t">Summarize</div><div class="c-d">Ghost drafts a case summary from the timeline — what fired, when, what was done, how it ended. The skeleton of your closure report, generated in seconds.</div></div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Treat AI output as a draft from a sharp junior analyst</div><div class="ft-desc">Usually right, occasionally confidently wrong. Check every time against the frames before a claim enters the official record.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Feed the case file first</div><div class="ft-desc">Investigation quality tracks evidence quality. Notes with times, attached frames, and clean status changes give Ghost — and the next shift — something real to reason over.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Loop back to the cameras</div><div class="ft-desc">The investigation's open questions are literally askable: jump to the post's conversation and put them to the camera. "Did the vehicle return after 02:00?" closes a gap in one exchange.</div></div></li>
            </ul>
            <div class="drill">
              <div class="d-k">Field drill 11</div>
              <div class="d-t">Case work, end to end</div>
              <div class="d-b">Take the incident created by your drill-9 alert: assign it to yourself, add one note with a time, run Investigate, then Summarize. Pass condition: the summary is accurate enough that you would sign it with one edit or fewer.</div>
            </div>`,
    },
    {
      title: "Closing Incidents & KPIs",
      q: "When and how do I close a case properly?",
      ph: "Close this incident with a resolution\u2026",
      body: `
            <div class="kicker mono">Incidents &middot; Lesson 4</div>
            <p class="lead">A case is closed when the story is complete — <span class="dim">not when the noise stops.</span></p>
            <p>Closure is a deliberate act with its own dialog: a resolution classification and a closing summary, stamped into the timeline forever. Before you close, run the three-question audit:</p>
            <ol class="steps">
              <li><div><div class="st-t">Is the cause established?</div><div class="st-d">"Contractor entered the wrong door — badge valid, signage missing" closes. "It stopped happening" does not; that case is resolved-unexplained and your handover should say so.</div></div></li>
              <li><div><div class="st-t">Is the action recorded?</div><div class="st-d">Whatever was done — patrol dispatched, door secured, rule reworded, no action warranted — must appear in notes with a time. An empty timeline plus a closed status is an audit finding waiting to happen.</div></div></li>
              <li><div><div class="st-t">Did the system learn?</div><div class="st-d">Every false alarm is a rule asking to be sharpened, and every real catch may justify widening a watch. Feed the lesson back into Part VI before you close the tab.</div></div></li>
            </ol>
            <p>The board's KPIs aggregate from exactly these habits: time-to-acknowledge, time-to-close, open-case age. They are not surveillance of you — they are the site's early-warning system for understaffed shifts and noisy rules. Keep the data honest by keeping the casework honest.</p>
            <p>Heads-up displays come and go; the incident archive is the institution's memory. Five years from now, the only account of tonight will be what you wrote in that workspace.</p>`,
    },
  ],
};
