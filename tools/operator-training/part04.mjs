// Part IV — Cameras & the Live Stage (7 pages)
export default {
  nav: "Cameras & the Live Stage",
  pages: [
    {
      title: "Connecting Your First Camera",
      q: "How do I attach a camera to a conversation?",
      ph: "Add a camera to this conversation\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 1</div>
            <p class="lead">A conversation with a camera attached <span class="dim">is a camera you can question.</span></p>
            <ol class="steps">
              <li><div><div class="st-t">Open the camera selector</div><div class="st-d">In the conversation header, press "Add camera" — or flip the composer's live toggle when no camera is set up yet. Ghost lists every camera the console can reach. Grant the browser camera permission the first time.</div></div></li>
              <li><div><div class="st-t">Select one or more cameras</div><div class="st-d">Click rows to select. A conversation can carry several cameras — a gate conversation often pairs the approach view with the barrier view.</div></div></li>
              <li><div><div class="st-t">Save Setup — or just Enable Live</div><div class="st-d">"Save setup" binds the cameras to this conversation permanently and starts streaming. "Enable live" streams for this session only, without saving. For any conversation you intend to keep, save.</div></div></li>
              <li><div><div class="st-t">Confirm in the header</div><div class="st-d">Saved cameras appear as labeled chips in the conversation header. The small &times; on each chip detaches it. The live stage (next lesson) appears above the composer.</div></div></li>
            </ol>
            <div class="drill">
              <div class="d-k">Field drill 5</div>
              <div class="d-t">Attach, ask, verify</div>
              <div class="d-b">Attach a camera, save the setup, and ask: "Describe what you see and anything that needs operator attention." Pass condition: the answer carries a sampled frame and clearly matches the live scene.</div>
            </div>`,
    },
    {
      title: "Saved Setup vs Live Session",
      q: "What's the difference between saving a camera and just going live?",
      ph: "Show this conversation's saved cameras\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 2</div>
            <p class="lead">Saved is the contract. <span class="dim">Live is the moment.</span></p>
            <p>This distinction trips up every new operator, so commit it to memory:</p>
            <div class="chips">
              <div class="chip"><div class="c-t">Saved setup</div><div class="c-d">Persistent. Lives with the conversation, survives sign-out and browser restarts, appears as chips in the header. Standing alerts and area-wide broadcasts use the saved setup as their source of truth.</div></div>
              <div class="chip"><div class="c-t">Live session</div><div class="c-d">Momentary. The composer toggle starts and stops streaming right now, in this browser. Turning live off does not unsave anything; turning it on without a setup opens the selector.</div></div>
            </div>
            <p>The professional pattern: save the correct camera set once, when you create the conversation — then use the live toggle freely throughout the shift. Stream when you are actively questioning; rest the toggle when you are not. Saved bindings quietly carry the rest of the system: when Part VI arms a standing alert, it watches the saved cameras; when Part V broadcasts to an area, it collects every saved camera inside it.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Removing a saved camera</div><div class="ft-desc">Press the &times; on its header chip. It detaches from the conversation and drops out of any live session at once.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Re-checking the binding</div><div class="ft-desc">Camera moved or replaced? Open the selector again and re-save. A conversation bound to yesterday's camera angle answers about the wrong scene with full confidence — re-save after every physical change.</div></div></li>
            </ul>`,
    },
    {
      title: "The Live Stage",
      q: "What is the video panel above the message box?",
      ph: "Collapse the live preview\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 3</div>
            <p class="lead">The live stage is your eyes. <span class="dim">The conversation is your judgment.</span></p>
            <p>Whenever cameras are streaming, the live stage renders above the composer — one tile per camera, side by side when several are live. It exists so you never answer "did Ghost get it right?" from memory: the scene and the conversation share one screen.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Collapse / expand</div><div class="ft-desc">The chevron shrinks the stage to a slim bar when you need thread space, and restores it on click. The setting is global — it follows you across conversations.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Resize handles</div><div class="ft-desc">Drag the bottom corners to size the stage to your monitor. Ghost remembers your preferred size.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Connection states</div><div class="ft-desc">A tile shows "connecting" while a stream warms up and an explicit error if the camera cannot be reached. A black tile is a fact to act on — Part X's troubleshooting guide covers the causes.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Scene overlays</div><div class="ft-desc">The stage can silhouette people and vehicles in the frame as a quick orientation aid. Overlays pause automatically while alert mode is armed — the watch always takes priority over decoration.</div></div></li>
            </ul>
            <p>Discipline note: the stage tempts new operators back into screen-staring. Resist it. Glance to verify; question to understand. Your throughput as an operator comes from the conversation, not the tiles.</p>`,
    },
    {
      title: "Enhance: Zoom, Pan & Views",
      q: "Can I look closer at part of the frame?",
      ph: "Enhance the view on tile 1\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 4</div>
            <p class="lead">Two ways of looking: <span class="dim">the intel view and the enhanced view.</span></p>
            <p>Each live tile carries an enhance control that switches between two operator views:</p>
            <div class="chips">
              <div class="chip"><div class="c-t">Intel view (default)</div><div class="c-d">A calm, grayscale rendering of the full frame. Built for long watches — low fatigue, full situational coverage, nothing hidden.</div></div>
              <div class="chip"><div class="c-t">Enhanced view</div><div class="c-d">Full color with zoom and pan unlocked. Built for moments: reading a container number, checking whether the contractor's badge is clipped on, confirming what a driver placed by the fence.</div></div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Zoom — wheel or buttons</div><div class="ft-desc">Scroll the mouse wheel over the tile, or use the + / &minus; controls. Up to 8&times; magnification in smooth steps.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Pan — drag</div><div class="ft-desc">Once zoomed past 1&times;, drag the image to move around the frame. The cursor switches to a grab hand.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Reset</div><div class="ft-desc">One press returns to 1&times;, centered. Always reset before handing the console over — the next operator must see the whole scene.</div></div></li>
            </ul>
            <p>Critical detail: while a tile is enhanced and zoomed, the frames Ghost samples for your questions match what you are looking at. Frame the subject, then ask — "Read the placard on this trailer" works because Ghost sees your framing.</p>`,
    },
    {
      title: "Recording & Clips",
      q: "How do I record what a camera is showing right now?",
      ph: "Start recording on this camera\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 5</div>
            <p class="lead">When something is happening, <span class="dim">record first and keep questioning.</span></p>
            <p>Every live tile has a record control. Recording captures the tile's stream into a clip you can download — your raw-footage layer for evidence and handover, running parallel to Ghost's written answers.</p>
            <ol class="steps">
              <li><div><div class="st-t">Start</div><div class="st-d">Press record on the tile. A timer counts the take. If the camera carries audio and listening is on, audio is captured too.</div></div></li>
              <li><div><div class="st-t">Stop</div><div class="st-d">Press again. The finished clip appears beside the tile, stamped with duration.</div></div></li>
              <li><div><div class="st-t">Download or discard</div><div class="st-d">Download saves the clip file to the console machine; delete discards it. Clips live in this browser session — anything worth keeping must be downloaded before you sign out.</div></div></li>
            </ol>
            <div class="drill">
              <div class="d-k">Field drill 6</div>
              <div class="d-t">The evidence sandwich</div>
              <div class="d-b">Start recording, ask Ghost two questions about the live scene, stop recording, download the clip. Pass condition: you hold a clip file plus the thread's written answers covering the same minute — a complete evidence package.</div>
            </div>
            <p>Doctrine: recording complements the conversation, it does not replace it. A clip shows what happened; the thread shows what it meant and when you knew it. Investigations want both.</p>`,
    },
    {
      title: "Audio Monitoring",
      q: "Can I listen to a camera as well as watch it?",
      ph: "Listen to audio on this camera\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 6</div>
            <p class="lead">Some incidents are heard <span class="dim">before they are seen.</span></p>
            <p>Cameras that carry a microphone expose a listen control on their live tile. One press opens the audio channel through your console; press again to mute. Cameras without a microphone show the control as unavailable — that is the hardware, not a fault.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">When to listen</div><div class="ft-desc">Verification moments: raised voices at a service counter, an alarm tone somewhere off-frame, machinery that sounds wrong before it looks wrong, glass breaking out of view.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">When to stay muted</div><div class="ft-desc">Default state. Continuous audio fatigues you faster than continuous video, and a muted channel cannot mask the radio. Open audio deliberately, close it when verified.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Audio in recordings</div><div class="ft-desc">If listening is on while you record, the clip includes the audio track — note it in your incident log, and know your site's policy on audio capture before relying on it.</div></div></li>
            </ul>
            <p>Privacy discipline applies double to audio. Many jurisdictions and most site policies treat sound differently from video. Your site lead will brief you on local rules — until then, treat audio as a verification tool, not a surveillance channel.</p>`,
    },
    {
      title: "How Ghost Samples Frames",
      q: "What actually happens when I ask a question with live cameras on?",
      ph: "Ask about the live scene\u2026",
      body: `
            <div class="kicker mono">Cameras &middot; Lesson 7</div>
            <p class="lead">Three frames, fairly sampled, <span class="dim">faces masked, then analyzed.</span></p>
            <p>Understanding the sampling pipeline makes you a sharper questioner. When you send with live cameras on:</p>
            <div class="codeblock">
              <div class="cb-head"><span class="mono">frame-sampling-pipeline</span><span class="copy mono">copy</span></div>
              <div class="cb-body">
                <div class="pipe">
                  <div class="node"><span class="n-t">Warm-up</span><span class="n-s">first frame discarded</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">3 frames</span><span class="n-s">~0.8s apart</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Face masking</span><span class="n-s">privacy layer</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Ghost analysis</span><span class="n-s">answer + evidence</span></div>
                </div>
              </div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Why three frames matter</div><div class="ft-desc">Spaced sampling captures motion: a pallet jack crossing the aisle, a door swinging shut, a vehicle still rolling versus parked. Ghost reads the change between frames, not just one frozen instant.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Why the first frame is discarded</div><div class="ft-desc">Cameras need a beat for exposure to settle. Ghost throws the warm-up frame away so analysis never runs on a half-lit image.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Faces are masked before analysis</div><div class="ft-desc">A privacy layer blurs faces in sampled frames before they leave your console. Ghost reasons about behavior, posture, equipment and context — not facial identity.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Operational consequence</div><div class="ft-desc">Sampling spans about two seconds. For a fast-moving event, ask short questions in rhythm rather than one long question after the moment has passed.</div></div></li>
            </ul>`,
    },
  ],
};
