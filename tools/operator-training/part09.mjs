// Part IX — Settings & Daily Operations (4 pages)
export default {
  nav: "Settings & Operations",
  pages: [
    {
      title: "Account & Users",
      q: "How are operator accounts managed on a shared console?",
      ph: "Open Settings \u2192 Account\u2026",
      body: `
            <div class="kicker mono">Operations &middot; Lesson 1</div>
            <p class="lead">One console, many operators — <span class="dim">each with their own identity.</span></p>
            <p>The Settings panel opens from the gear at the bottom of the sidebar (Esc closes it). Its first section, <b>Account &amp; Users</b>, manages who the console works as:</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">The user list</div><div class="ft-desc">Every operator provisioned on this console, with the active one badged. Conversations, areas, and alert ownership follow the active user.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Adding an operator</div><div class="ft-desc">A nickname plus a Ghost API key creates a new operator identity. The eye toggle shows the key while you paste it — hide it again before anyone walks past.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Switching operators</div><div class="ft-desc">The user row in the sidebar footer switches the active operator — at shift change, switch before you type anything, so the night's record is attributed to the right person.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Signing out</div><div class="ft-desc">The sign-out control in the sidebar footer ends the session and returns to Secure Access. Walking away from a signed-in console is the operational equivalent of leaving keys in a door.</div></div></li>
            </ul>
            <p>Attribution is the quiet backbone of everything in Parts VI and VII: acknowledgments, notes, and closures are signed by the active user. Keep the identity honest and the audit trail stays honest by itself.</p>`,
    },
    {
      title: "Quick-Login Links",
      q: "How do I get a teammate into the console without sharing keys?",
      ph: "Generate a quick-login link\u2026",
      body: `
            <div class="kicker mono">Operations &middot; Lesson 2</div>
            <p class="lead">A link instead of a key: <span class="dim">single-use, expiring, copy-safe.</span></p>
            <p>Settings &rarr; <b>Quick Access</b> issues magic login links — the right way to hand access to a teammate, a relief operator, or your own second device. Never share API keys; share links.</p>
            <ol class="steps">
              <li><div><div class="st-t">Generate</div><div class="st-d">One press creates a fresh link for the active user and copies it to the clipboard automatically. A countdown shows its remaining validity.</div></div></li>
              <li><div><div class="st-t">Deliver over a trusted channel</div><div class="st-d">Hand the link over your site's approved messaging channel. Whoever opens it lands signed in — so treat an unsent link like a signed blank pass.</div></div></li>
              <li><div><div class="st-t">Regenerate when in doubt</div><div class="st-d">Links are single-use and time-boxed; the regenerate control voids the old one and issues fresh. If a link may have leaked, regenerate first and investigate second.</div></div></li>
            </ol>
            <div class="chips">
              <div class="chip"><div class="c-t">Use for</div><div class="c-d">Shift relief, supervisor spot-checks, your own tablet at the gatehouse, controlled demonstrations.</div></div>
              <div class="chip"><div class="c-t">Never for</div><div class="c-d">Posting in group chats, email signatures, taping to the monitor, or anyone you would not badge into the control room.</div></div>
            </div>`,
    },
    {
      title: "Voice Command",
      q: "Can I operate Ghost hands-free?",
      ph: "Say your send phrase\u2026",
      body: `
            <div class="kicker mono">Operations &middot; Lesson 3</div>
            <p class="lead">Eyes on the scene, hands on the radio — <span class="dim">voice runs the console.</span></p>
            <p>Settings &rarr; <b>Voice Command</b> configures hands-free operation. With voice enabled, the composer gains a microphone; speech becomes text in the message box, and speaking your <b>send phrase</b> fires the message without touching anything.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">The enable switch</div><div class="ft-desc">Turns the voice system on or off for this console. Off means no microphone button and no listening, ever — some rooms require that posture.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">The send phrase</div><div class="ft-desc">One or two words, your choice (default: "go ghost"). Pick something you will never say mid-sentence — "send it" fires accidentally; "ghost go" does not. Save to apply.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">The listening strip</div><div class="ft-desc">While the mic is hot, a strip above the composer shows what is being heard and reminds you of the send phrase. Glance at it before you speak the phrase — confirm the transcription says what you mean.</div></div></li>
            </ul>
            <p>Where voice earns its keep: gatehouse posts where your hands hold a barrier remote and a radio; live pursuits across the stage where looking down costs you the subject; gloved hands in cold rooms. Where it does not: open-plan control rooms where three consoles would hear each other's phrases — coordinate phrases with your neighbors, or keep voice off.</p>`,
    },
    {
      title: "Language, Theme & Learning",
      q: "How do I adapt the console itself — language, appearance, refreshers?",
      ph: "Switch the interface language\u2026",
      body: `
            <div class="kicker mono">Operations &middot; Lesson 4</div>
            <p class="lead">The console adapts to the operator — <span class="dim">not the other way around.</span></p>
            <div class="chips">
              <div class="chip"><div class="c-t">Language — HE / EN</div><div class="c-d">The toggle in the conversation header flips the entire interface between Hebrew (right-to-left) and English (left-to-right) instantly. Ghost's answers follow the language you ask in, regardless of interface language.</div></div>
              <div class="chip"><div class="c-t">Theme — dark / light</div><div class="c-d">The sun/moon control in the sidebar footer. Dark is doctrine for night shifts and dim rooms; light holds up in sun-washed gatehouses. Your choice persists per console.</div></div>
              <div class="chip"><div class="c-t">Auto-naming — global switch</div><div class="c-d">Settings &rarr; Response Tuning carries the global switch for automatic conversation naming, alongside the per-conversation sparkles override from Part III.</div></div>
              <div class="chip"><div class="c-t">Learning center</div><div class="c-d">Settings &rarr; Learning tracks your progress through the built-in guided chapters and reopens any of them — including the first-entry tour — on demand.</div></div>
            </div>
            <p>The learning center is your refresher between formal trainings: eleven short guided chapters, each spotlighting one capability on the live console. A professional habit worth stealing: when a feature in this booklet has gone unused for a month, replay its chapter before the shift where you will need it.</p>
            <div class="drill">
              <div class="d-k">Field drill 13</div>
              <div class="d-t">Console personalization pass</div>
              <div class="d-b">Set your preferred language and theme, confirm your send phrase, and replay one learning-center chapter of your choice. Pass condition: under three minutes for the full pass — these controls should be reflex by now.</div>
            </div>`,
    },
  ],
};
