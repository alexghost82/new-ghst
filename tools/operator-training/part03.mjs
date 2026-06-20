// Part III — The Conversation Core (7 pages)
export default {
  nav: "The Conversation Core",
  pages: [
    {
      title: "Your First Conversation",
      q: "Walk me through starting my very first conversation.",
      ph: "Start a new conversation\u2026",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 1</div>
            <p class="lead">One conversation per camera, per concern. <span class="dim">That is the whole data model.</span></p>
            <p>Everything in Ghost lives inside conversations. A conversation typically represents one camera and one ongoing concern — "Loading Dock — North", "Pharmacy Cold Storage", "Perimeter Road East". You will open many; each keeps its own history, its own cameras, its own instructions, and its own alert rules.</p>
            <ol class="steps">
              <li><div><div class="st-t">Press the + button at the top of the sidebar</div><div class="st-d">A fresh conversation appears, stamped with the date and time. It is selected automatically and the message box is focused, ready to type.</div></div></li>
              <li><div><div class="st-t">Ask something — even without a camera</div><div class="st-d">Type a question and press Enter. Without a camera attached, Ghost converses from knowledge and from this conversation's history. Try: "What should I include in a handover summary for a night shift?"</div></div></li>
              <li><div><div class="st-t">Watch the answer stream</div><div class="st-d">Ghost replies token by token. While it streams, the message box waits — one question, one answer, in order.</div></div></li>
            </ol>
            <div class="drill">
              <div class="d-k">Field drill 1</div>
              <div class="d-t">Three conversations in three minutes</div>
              <div class="d-b">Create three conversations and exchange at least one question and answer in each. Pass condition: you can switch between them from the sidebar and each shows its own history.</div>
            </div>`,
    },
    {
      title: "Asking Good Questions",
      q: "How do I phrase questions so Ghost gives me operational answers?",
      ph: "Is the emergency exit on dock 3 blocked right now?",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 2</div>
            <p class="lead">Ask about the situation, <span class="dim">not about objects.</span></p>
            <p>Ghost reads scenes the way a briefing officer would. The more operational intent your question carries, the sharper the answer. A question that names the concern — safety, security, operations, emergency — tells Ghost what matters in the frame and what to ignore.</p>
            <div class="dodont">
              <div class="dd good">
                <div class="dd-h">Ask like this</div>
                <ul>
                  <li>"Is the forklift blocking the fire lane at the loading dock?"</li>
                  <li>"Did the fuel tanker finish unloading, and were cones placed around it?"</li>
                  <li>"Is anyone working at height on the scaffold without a harness?"</li>
                  <li>"Has the gate been left open since the last delivery?"</li>
                </ul>
              </div>
              <div class="dd">
                <div class="dd-h">Not like this</div>
                <ul>
                  <li>"Is there a person in the frame?"</li>
                  <li>"Do you see a car?"</li>
                  <li>"Detect objects."</li>
                  <li>"What's in the picture?"</li>
                </ul>
              </div>
            </div>
            <p>The left column gets you decisions; the right column gets you inventory. When an answer feels generic, your question was generic — add the operational context and ask again. Follow-ups inherit the conversation's context, so "And now?" or "Has that changed?" work exactly as they would with a human colleague.</p>`,
    },
    {
      title: "The Composer in Depth",
      q: "What does every control around the message box do?",
      ph: "Write a message to Ghost\u2026",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 3</div>
            <p class="lead">The composer is your command line. <span class="dim">Four controls, total mastery required.</span></p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">The message box</div><div class="ft-desc">Type and press Enter to send; Shift+Enter inserts a line break. While Ghost is answering, the box shows "waiting for reply" and pauses input — answers always arrive in order.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Live camera toggle</div><div class="ft-desc">The camera button beside the box. When live is on, every question you send is accompanied by freshly sampled frames from the connected cameras — Ghost answers about right now. When off, Ghost answers from history and knowledge only. This toggle is the single most important switch in the console.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Microphone</div><div class="ft-desc">When voice command is enabled in Settings, the mic button listens and types for you. Saying your send phrase (default: "go ghost") fires the message hands-free — invaluable when you are holding a radio.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Send button</div><div class="ft-desc">The arrow sends, same as Enter. If it is dimmed, either the box is empty or Ghost is still answering.</div></div></li>
            </ul>
            <p>Above the box, a thin strip reports what is attached to your next message: which cameras are live, and whether voice is listening. Read that strip before you send — it is the difference between asking about the live scene and asking about the past.</p>
            <div class="drill">
              <div class="d-k">Field drill 2</div>
              <div class="d-t">Same question, two modes</div>
              <div class="d-b">Ask the same question once with live off and once with live on (after Part IV teaches you to connect a camera, repeat this). Pass condition: you can explain the difference between the two answers.</div>
            </div>`,
    },
    {
      title: "Reading the Thread",
      q: "What should I notice inside Ghost's answers?",
      ph: "Open the sampled frame from the last answer\u2026",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 4</div>
            <p class="lead">Every answer carries evidence. <span class="dim">Learn to read all of it.</span></p>
            <p>The thread is more than text. Professional operators extract four layers from every exchange:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">The sampled frame</div><div class="ft-desc">When Ghost answered from a live camera, the answer carries a thumbnail of the exact frames it analyzed — watermarked with time and camera label. Click it to open a full-size preview; Esc closes. This is your evidence trail: the answer and what Ghost saw, side by side.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Timestamps on hover</div><div class="ft-desc">Hover any message to reveal its exact local time. In an investigation, "when was this asked" matters as much as the answer.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Copy controls</div><div class="ft-desc">Hovering your own messages reveals a copy button; code or structured blocks in Ghost's answers carry their own. Use them when filing reports — never retype evidence.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Multi-camera attribution</div><div class="ft-desc">When several cameras are live, Ghost answers per camera and labels each reply with the camera it describes. Never assume — read the label.</div></div></li>
            </ul>
            <p>If you scroll up through history, a "jump to latest" button appears — one click returns you to the live end of the thread. During fast-moving events, stay at the bottom; the thread auto-follows new answers.</p>`,
    },
    {
      title: "Managing Conversations",
      q: "How do I keep dozens of conversations under control?",
      ph: "Rename this conversation\u2026",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 5</div>
            <p class="lead">Name things like a professional. <span class="dim">Future-you is the customer.</span></p>
            <p>Hover any conversation in the sidebar and an action bar appears. These small controls are how a fifty-conversation site stays navigable:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Rename (pencil, or double-click the title)</div><div class="ft-desc">Give every long-lived conversation a name a stranger could navigate by: "Gate 2 — Vehicle Inspection Lane", not "camera test". Renaming locks the title against automatic changes.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Automatic naming (sparkles)</div><div class="ft-desc">By default, Ghost names new conversations from their content after the first exchanges. The sparkles button overrides this per conversation; the global switch lives in Settings &rarr; Response Tuning.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Delete (trash)</div><div class="ft-desc">Removes the conversation and its history immediately — there is no confirmation and no undo. Treat it like shredding a file: deliberate, never casual.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Status badges</div><div class="ft-desc">Each row shows what matters at a glance: a shield when alert mode is armed, a camera count when cameras are saved, a live badge when streaming, and the time of last activity.</div></div></li>
            </ul>
            <div class="drill">
              <div class="d-k">Field drill 3</div>
              <div class="d-t">Naming sweep</div>
              <div class="d-b">Rename the three conversations from drill 1 using the pattern "Location — Concern". Pass condition: someone who has never seen your console could pick the right conversation in five seconds.</div>
            </div>`,
    },
    {
      title: "The System Prompt",
      q: "How do I give a conversation standing instructions?",
      ph: "Edit this conversation's standing instructions\u2026",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 6</div>
            <p class="lead">The system prompt is your standing order. <span class="dim">Ghost obeys it in every single answer.</span></p>
            <p>Open it from the sliders icon in the conversation header. Whatever you write there shapes every answer in this conversation — tone, focus, format, and priorities. It is the most underused control in the console, and the one that most separates professionals from beginners.</p>
            <div class="sample">
              <div class="sm-head mono">system-prompt &middot; example &middot; loading dock</div>
              <div class="sm-body">
                <div class="sm-a">"You are watching the north loading dock of a pharmaceutical warehouse. Priorities, in order: (1) the fire lane must stay clear, (2) cold-chain pallets must not wait outside the chiller for more than 10 minutes, (3) every truck at the dock must have its wheels chocked. Answer in two sentences or fewer. When you flag a problem, name the bay number."</div>
              </div>
            </div>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Be concrete and ordered</div><div class="ft-desc">Numbered priorities beat prose. Ghost applies them in order when a scene contains several issues at once.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Dictate the format you need</div><div class="ft-desc">"Two sentences or fewer", "always include the bay number", "answer in Hebrew" — format instructions hold across the entire conversation.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Revisit on every site change</div><div class="ft-desc">New tenant, new traffic pattern, construction starting — the prompt must follow reality. A stale standing order is worse than none.</div></div></li>
            </ul>
            <div class="drill">
              <div class="d-k">Field drill 4</div>
              <div class="d-t">Write one standing order, prove it holds</div>
              <div class="d-b">Set a system prompt that forces a two-sentence answer format, then ask three different questions. Pass condition: all three answers obey the format without being reminded.</div>
            </div>`,
    },
    {
      title: "Response Tuning",
      q: "Can I trade speed for accuracy per conversation?",
      ph: "Open Settings \u2192 Response Tuning\u2026",
      body: `
            <div class="kicker mono">Conversation Core &middot; Lesson 7</div>
            <p class="lead">Every conversation has its own dials. <span class="dim">Tune them to the mission.</span></p>
            <p>Settings &rarr; Response Tuning exposes per-conversation dials. They apply to the active conversation, so a perimeter watch and an investigation desk can run completely different profiles.</p>
            <div class="chips">
              <div class="chip"><div class="c-t">Accuracy level &middot; 1&ndash;4</div><div class="c-d">Left is fastest, right is most thorough. Routine status checks run at 1&ndash;2; evidence-grade analysis of a complex scene deserves 3&ndash;4.</div></div>
              <div class="chip"><div class="c-t">Response length</div><div class="c-d">Short, medium, or long. Live operations want short — you can always ask for elaboration. Shift-end summaries want long.</div></div>
              <div class="chip"><div class="c-t">Image detail</div><div class="c-d">How closely Ghost examines sampled frames. High resolves badge text and license plates at distance; low answers faster on busy scenes.</div></div>
              <div class="chip"><div class="c-t">Capture quality</div><div class="c-d">How sharply this browser samples camera frames before sending. Sharp by default; drop to fast on weak hardware or thin networks.</div></div>
            </div>
            <p>Recommended profiles: <b>Perimeter watch</b> — accuracy 2, short answers, low detail, fast capture: cadence beats nuance. <b>Investigation</b> — accuracy 4, long answers, high detail, sharp capture: nuance beats cadence. Set the profile when you create the conversation, and you will never think about it mid-shift.</p>`,
    },
  ],
};
