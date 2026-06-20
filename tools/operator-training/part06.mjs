// Part VI — Standing Alerts (6 pages)
export default {
  nav: "Standing Alerts",
  pages: [
    {
      title: "The Alert Doctrine",
      q: "What exactly is alert mode, and when do I use it?",
      ph: "Open the alert panel\u2026",
      body: `
            <div class="kicker mono">Standing Alerts &middot; Lesson 1</div>
            <p class="lead">You write the rule in plain language. <span class="dim">Ghost keeps the watch. You decide.</span></p>
            <p>Alert mode turns a conversation from a place you ask questions into a post that watches itself. You describe, in ordinary words, what counts as a deviation — Ghost continuously scans the conversation's saved cameras and interrupts you the moment reality matches the rule.</p>
            <div class="codeblock">
              <div class="cb-head"><span class="mono">alert-loop</span><span class="copy mono">copy</span></div>
              <div class="cb-body">
                <div class="pipe">
                  <div class="node"><span class="n-t">Rule</span><span class="n-s">plain language</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Continuous scan</span><span class="n-s">saved cameras</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Match</span><span class="n-s">deviation found</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Interrupt</span><span class="n-s">overlay + siren</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Operator</span><span class="n-s">verify &amp; decide</span></div>
                </div>
              </div>
            </div>
            <p>Each conversation carries its own rules and its own armed state — the cold-storage door watch and the perimeter loitering watch run independently, on their own cameras, with their own definitions of trouble.</p>
            <p>Everything alert-related lives behind the shield icon in the conversation header. The small dot on the shield is a health summary you will learn to read in Lesson 4: green is watching, yellow is degraded, red needs you. The next five lessons take you from writing your first rule to handling a live alarm.</p>`,
    },
    {
      title: "Writing Good Watch Rules",
      q: "How do I write rules that catch real events and ignore noise?",
      ph: "Add a watch rule to this conversation\u2026",
      body: `
            <div class="kicker mono">Standing Alerts &middot; Lesson 2</div>
            <p class="lead">A good rule reads like an order to a guard: <span class="dim">subject, condition, context.</span></p>
            <p>Open the alert panel (shield icon), type a rule into the rule box, press Enter or the + to add it. A conversation can hold several rules; each has its own on/off toggle, and hover reveals a delete control. The craft is in the wording:</p>
            <div class="dodont">
              <div class="dd good">
                <div class="dd-h">Rules that work</div>
                <ul>
                  <li>"A person climbs or reaches over the perimeter fence"</li>
                  <li>"A vehicle stops in the fire lane for more than a moment"</li>
                  <li>"Someone enters the chemical store without a hi-vis vest"</li>
                  <li>"The loading bay door is open with no staff present"</li>
                  <li>"A person raises a hand high above their head"</li>
                </ul>
              </div>
              <div class="dd">
                <div class="dd-h">Rules that misfire</div>
                <ul>
                  <li>"Anything suspicious" — no observable condition</li>
                  <li>"A person appears" — fires on every employee</li>
                  <li>"Theft" — a legal conclusion, not a visible event</li>
                  <li>"Motion" — that is noise, not a rule</li>
                </ul>
              </div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Describe what the camera can see</div><div class="ft-desc">Posture, position, clothing, equipment, door states, vehicle behavior. If a human watching the feed could not call it, neither can the rule.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">One deviation per rule</div><div class="ft-desc">Split "open door or missing vest or loitering" into three rules. You get cleaner alerts and can toggle each watch independently.</div></div></li>
            </ul>`,
    },
    {
      title: "Arming the Watch",
      q: "My rules are written. How do I go live?",
      ph: "Arm alert mode\u2026",
      body: `
            <div class="kicker mono">Standing Alerts &middot; Lesson 3</div>
            <p class="lead">Test the eyes, <span class="dim">then arm the watch.</span></p>
            <ol class="steps">
              <li><div><div class="st-t">Confirm prerequisites</div><div class="st-d">Arming requires a saved camera setup and at least one active rule. If the panel warns that a camera is required, the "Add camera" link inside the warning opens the selector directly.</div></div></li>
              <li><div><div class="st-t">Run the connection test</div><div class="st-d">Press "Test connection". Ghost grabs a trial capture from the saved cameras and confirms the watch will actually see. Never skip this — an armed watch on a dead camera is a false sense of security, which is worse than none.</div></div></li>
              <li><div><div class="st-t">Flip the arming toggle</div><div class="st-d">The conversation enters alert mode: scanning begins on the saved cameras, the shield dot goes green, and the conversation's sidebar row gains an alert-mode badge so every operator can see the post is armed.</div></div></li>
              <li><div><div class="st-t">Disarm deliberately</div><div class="st-d">The same toggle stands the watch down. Disarm when work crews will legitimately trigger the rule, and re-arm when they leave — and say both in the handover log.</div></div></li>
            </ol>
            <div class="drill">
              <div class="d-k">Field drill 9</div>
              <div class="d-t">First armed watch</div>
              <div class="d-b">Add the rule "a person raises a hand high above their head" to a conversation with your practice camera, test the connection, arm it, then step in front of the camera and raise your hand. Pass condition: the alert fires on you. Acknowledge it (next lessons), then disarm.</div>
            </div>`,
    },
    {
      title: "Reading the Watch Status",
      q: "How do I know the armed watch is actually healthy?",
      ph: "Check the alert system status\u2026",
      body: `
            <div class="kicker mono">Standing Alerts &middot; Lesson 4</div>
            <p class="lead">An armed watch you never verify <span class="dim">is a story you tell yourself.</span></p>
            <p>While armed, the alert panel shows a live status card — the heartbeat of the watch. Make reading it a habit at every check-in:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Camera channel</div><div class="ft-desc">Confirms frames are flowing from the saved cameras into the scan loop. If this degrades, the watch is blind — re-run the connection test and check the camera physically if it fails.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Push channel</div><div class="ft-desc">The live link that delivers alarms to your console instantly. "Connected" means an alert will reach you the second it fires; "disconnected" means delivery may lag — check your network, the channel reconnects automatically.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Last scan</div><div class="ft-desc">Timestamp of the most recent completed scan. It should refresh continuously — a stale value that stops advancing is your cue to disarm, fix, and re-arm.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">The shield dot, decoded</div><div class="ft-desc">Green: armed and healthy. Yellow: armed but degraded (push channel down or scans lagging). Red: attention required. The dot is on the header — you see it from across the room.</div></div></li>
            </ul>
            <p>Posts on trial access auto-disarm after a short demonstration window, with a countdown in the panel. Production credentials keep the watch armed until you stand it down.</p>`,
    },
    {
      title: "When the Alarm Fires",
      q: "An alert just fired. What is the procedure?",
      ph: "Acknowledge the active alert\u2026",
      body: `
            <div class="kicker mono">Standing Alerts &middot; Lesson 5</div>
            <p class="lead">Mute. Verify. Acknowledge. <span class="dim">In that order, every time.</span></p>
            <p>A firing alert takes the whole screen: a full-screen overlay with a strobe border, an audible siren, the matched rule, Ghost's description of what it saw, and the captured frame. It is designed to be impossible to miss. Your procedure:</p>
            <ol class="steps">
              <li><div><div class="st-t">Mute the siren</div><div class="st-d">Press the mute control or the M key. Silence buys you focus; the overlay stays until you act on it.</div></div></li>
              <li><div><div class="st-t">Verify against the evidence</div><div class="st-d">Read the matched rule, read Ghost's description, study the captured frame. Is this the deviation the rule was written for? You have the live feed one click away if you need the present tense.</div></div></li>
              <li><div><div class="st-t">Go to the conversation — or acknowledge</div><div class="st-d">"Go to conversation" jumps you into the alerting camera's thread with the alert recorded in it, ready for follow-up questions: "Is the person still there? Which way did they go?" Acknowledge (Enter or Esc) closes the overlay and logs you as the human who took it.</div></div></li>
              <li><div><div class="st-t">Act per your site's escalation order</div><div class="st-d">Ghost ends at the decision boundary. Radio, dispatch, lockdown calls — those belong to your standing orders. The thread you just built is your timeline when you write it up.</div></div></li>
            </ol>
            <p>Acknowledgment is accountability: every alert records who cleared it. Never acknowledge an alarm you have not looked at — clearing blind is the cardinal sin of this profession.</p>`,
    },
    {
      title: "Alert Cards in the Thread",
      q: "Where do alerts live after the overlay is gone?",
      ph: "Show recent alert events in this conversation\u2026",
      body: `
            <div class="kicker mono">Standing Alerts &middot; Lesson 6</div>
            <p class="lead">Every alarm leaves a permanent record card <span class="dim">in the conversation it came from.</span></p>
            <p>After acknowledgment, the event remains as an alert card in the conversation's thread — a compact, SOC-style record:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">The matched rule</div><div class="ft-desc">Exactly which standing instruction fired, quoted verbatim — essential when a conversation carries several rules.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Ghost's analysis</div><div class="ft-desc">What Ghost saw and why it judged the rule matched, in plain language. This is what you quote in the incident report.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">The alert frame</div><div class="ft-desc">The captured frame, time-stamped and camera-labeled. Click to open it full size — the primary exhibit for any review.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Signal metadata</div><div class="ft-desc">Severity, camera feed tag, and event identifiers — the connective tissue that links this card to the incident pipeline in Part VII.</div></div></li>
            </ul>
            <p>Because cards live in the thread, your follow-up questions sit directly beneath the evidence — the alert, the verification, and the resolution read as one continuous narrative. That narrative is what makes audits painless.</p>
            <div class="drill">
              <div class="d-k">Field drill 10</div>
              <div class="d-t">Narrate an alert end-to-end</div>
              <div class="d-b">Using drill 9's alert: under its card, ask Ghost two follow-up questions about the scene, then write one summary line of your own. Pass condition: a colleague reading just that thread understands what happened, when, and how it ended.</div>
            </div>`,
    },
  ],
};
