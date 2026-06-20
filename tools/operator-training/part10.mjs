// Part X — The Operator's Craft & Certification (5 pages)
export default {
  nav: "Craft & Certification",
  pages: [
    {
      title: "The Shift Routine",
      q: "Put it all together — what does a professional shift look like?",
      ph: "Start the shift checklist\u2026",
      body: `
            <div class="kicker mono">The Craft &middot; Lesson 1</div>
            <p class="lead">Excellence is a checklist <span class="dim">run so often it disappears.</span></p>
            <ol class="steps">
              <li><div><div class="st-t">Take over deliberately (first 10 minutes)</div><div class="st-d">Switch the console to your user. Read the outgoing operator's handover. Check every armed post's shield dot and status card. Run the incident board's badge to zero with triage. Then broadcast-sweep each area: "anything abnormal, unsafe, or out of place?"</div></div></li>
              <li><div><div class="st-t">Run the watch (the long middle)</div><div class="st-d">Work by exception: standing alerts interrupt, broadcast sweeps on cadence fill the gaps. Verify every alarm against its frame before acknowledging. Note actions in the incident workspace as they happen — never "later".</div></div></li>
              <li><div><div class="st-t">Investigate in the conversation, not in your head</div><div class="st-d">Every hunch becomes a question to the relevant camera. The thread is your worknotes — if you wondered it, ask it, so the record shows what was checked.</div></div></li>
              <li><div><div class="st-t">Hand over in writing (last 15 minutes)</div><div class="st-d">Final sweep per area. In each critical conversation, ask for a long-format shift summary. Open incidents get a status note. Disarmed posts get a reason and a re-arm time. Your relief should need five minutes, not fifty.</div></div></li>
            </ol>
            <p>The routine is the floor, not the ceiling: it guarantees a competent shift on your worst day and frees your attention for judgment on the days that demand it.</p>`,
    },
    {
      title: "Troubleshooting Field Guide",
      q: "Something's not working. Give me the field guide.",
      ph: "Run the connection test\u2026",
      body: `
            <div class="kicker mono">The Craft &middot; Lesson 2</div>
            <p class="lead">Diagnose in order: <span class="dim">camera, channel, rule, question.</span></p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Black or "connecting" tile</div><div class="ft-desc">Camera permission, cable, or device. Re-open the camera selector and re-pick the device; if it lists nothing, the browser lost camera permission or the camera lost power. Physical check beats refresh.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Answers ignore the live scene</div><div class="ft-desc">The live toggle is off, or no cameras are saved. Check the strip above the composer — it tells you exactly what your next message carries.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Alert never fires</div><div class="ft-desc">In order: is the conversation armed (shield dot)? Is the specific rule toggled active? Does the rule describe something visible on this camera's actual view? Run Site Intelligence and read what Ghost can see — then re-word the rule in those terms.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Alert fires constantly</div><div class="ft-desc">The rule names a normal condition. Add the distinguishing context: not "a vehicle at the gate" but "a vehicle waiting at the gate with no guard present for more than a minute".</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Yellow shield dot</div><div class="ft-desc">Armed but degraded — usually the push channel. Check the panel's status card; the channel reconnects on its own, but verify "last scan" is still advancing.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Vague answers</div><div class="ft-desc">Usually a vague question — add the operational concern. Then check the dials: accuracy and image detail may be tuned for speed on a conversation that now needs precision.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Session bounced to Secure Access</div><div class="ft-desc">Sessions expire by design. Sign back in, or keep a quick-login link from Part IX ready for exactly this moment.</div></div></li>
            </ul>
            <p>Escalate to your site administrator anything the guide does not clear in ten minutes — with the conversation name, the time, and what you already ruled out.</p>`,
    },
    {
      title: "Security & Privacy Discipline",
      q: "What are the non-negotiables on security and privacy?",
      ph: "Review the security posture\u2026",
      body: `
            <div class="kicker mono">The Craft &middot; Lesson 3</div>
            <p class="lead">You operate a sensitive instrument. <span class="dim">These rules are not optional.</span></p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Credentials</div><div class="ft-desc">API keys are never typed in view of others, never shared, never written down. Access for others flows through quick-login links over approved channels — single-use, expiring, revocable.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">The console is attributed space</div><div class="ft-desc">Work as yourself; switch users at relief; sign out when you step away. Every acknowledgment and closure carries a name — make sure it is the right one.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Privacy is built in — keep it that way</div><div class="ft-desc">Faces are masked in sampled frames before analysis; Ghost reasons about behavior and context, not identity. Do not attempt to defeat this, and follow site policy on audio monitoring and clip retention.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Evidence handling</div><div class="ft-desc">Downloaded clips and frames are controlled material: store them in your site's designated evidence location, never on personal devices, and log handoffs in the incident workspace.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Watch the watcher</div><div class="ft-desc">If Ghost ever shows a classified-content warning in the thread, treat it as a real signal: someone or something fed sensitive material into a conversation. Report it like any other security event.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Proportionality</div><div class="ft-desc">Ghost watches for deviations you define. Define them for safety, security, and operations — never for curiosity about individuals. Your rules are an ethical document; write them so you would be comfortable reading them aloud.</div></div></li>
            </ul>`,
    },
    {
      title: "Capstone Exercises",
      q: "I'm ready to prove it. What are the capstone exercises?",
      ph: "Begin the capstone\u2026",
      body: `
            <div class="kicker mono">The Craft &middot; Lesson 4</div>
            <p class="lead">Four scenarios, one console, no notes. <span class="dim">Complete all four to qualify for the exam.</span></p>
            <ol class="steps">
              <li><div><div class="st-t">Capstone A — Cold start (20 min)</div><div class="st-d">A fresh console: build a two-area tree, attach and save cameras, write system prompts for two posts, set tuning profiles. Pass: a colleague can run the site from your structure without questions.</div></div></li>
              <li><div><div class="st-t">Capstone B — The watch (20 min)</div><div class="st-d">Arm two posts with two rules each — one safety, one security. Trigger one rule legitimately on camera, work the full alarm procedure, and close the resulting incident with a signed summary. Pass: clean timeline from rule to closure.</div></div></li>
              <li><div><div class="st-t">Capstone C — The investigation (15 min)</div><div class="st-d">Using only questions to the past — no scrolling — reconstruct the last two hours of a busy conversation into a timed event log, verified against thread timestamps. Pass: no discrepancy over one minute.</div></div></li>
              <li><div><div class="st-t">Capstone D — The sweep under pressure (10 min)</div><div class="st-d">With one alert armed and live, run a complete multi-area broadcast sweep and produce a written handover — while correctly handling any alarm that fires mid-sweep. Pass: nothing missed, nothing acknowledged blind.</div></div></li>
            </ol>
            <p>Run the capstones with a supervising operator observing. The standard is not speed for its own sake — it is calm, attributable, complete work at operational tempo.</p>`,
    },
    {
      title: "Certification & Beyond",
      q: "What does certification involve, and what comes after?",
      ph: "Ask about the next cohort\u2026",
      body: `
            <div class="kicker mono">The Craft &middot; Lesson 5</div>
            <p class="lead">Certification is a beginning. <span class="dim">The craft compounds from here.</span></p>
            <p>The certification exam is a proctored, scenario-based practical on a live site: ninety minutes, unscripted events, the full breadth of this booklet. You are graded on procedure, judgment, documentation quality, and the honesty of your handover — in that order. A pass certifies you as a <b>Ghost Certified Operator</b>.</p>
            <div class="stats four">
              <div class="stat"><div class="s-b">90 min</div><div class="s-l">Practical exam, live site</div></div>
              <div class="stat"><div class="s-b">4 / 4</div><div class="s-l">Capstones required to sit</div></div>
              <div class="stat"><div class="s-b">2 days</div><div class="s-l">Typical course duration</div></div>
              <div class="stat"><div class="s-b">1 year</div><div class="s-l">Certification validity</div></div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Keep drilling</div><div class="ft-desc">The fourteen field drills in this booklet are designed for repetition. Re-run one each week — rotation keeps every capability warm.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Teach the next operator</div><div class="ft-desc">The fastest way to deepen the craft is to walk a new colleague through Parts III and VI. If you cannot explain the saved-versus-live distinction in one minute, you have found your own gap.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Feed the doctrine back</div><div class="ft-desc">Rules that earned their keep, prompts that sharpened a post, sweeps that caught what mattered — write them up for your site's playbook. Doctrine is built by operators, not manuals.</div></div></li>
            </ul>
            <div class="closer">
              <div class="big">Your cameras see everything. Now you know how to question them.</div>
              <div class="small">Ghost Academy &middot; Operator Training Program &middot; Certification Track</div>
            </div>`,
    },
  ],
};
