// Part II — Doctrine & First Entry (4 pages)
export default {
  nav: "Doctrine & First Entry",
  pages: [
    {
      title: "What Ghost Is",
      q: "Before I touch anything — what exactly is Ghost?",
      ph: "Ask what makes Ghost different\u2026",
      body: `
            <div class="kicker mono">Doctrine &middot; Lesson 1</div>
            <p class="lead">Ghost understands what your cameras see. <span class="dim">It does not just detect things in front of them.</span></p>
            <p>A conventional monitoring station shows you pixels and leaves the understanding to you. Ghost inverts that. Every camera becomes a conversation partner: you ask, in your own words, and Ghost answers about what is happening, what happened before, and what deviates from the instructions you gave it.</p>
            <p>That distinction — understanding versus detecting — is the foundation of everything in this course. Ghost does not hand you a box labeled with an object class. It reads the scene: a delivery truck idling against the flow of the loading dock during shift change is a different fact than the same truck parked there at 03:00 with its lights off.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">Past — a memory you can question</div><div class="ft-desc">"Did anyone approach the server-room door after the cleaning crew left?" Ghost answers from what it saw, with timestamps.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Present — eyes on the site right now</div><div class="ft-desc">"Is the fire lane by Gate 2 clear for the ambulance?" Ghost samples the live feed and answers in seconds.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">Future — standing instructions</div><div class="ft-desc">"From now on, tell me if a vehicle stops on the perimeter road for more than two minutes." Ghost keeps the watch and interrupts you only on deviation.</div></div></li>
            </ul>`,
    },
    {
      title: "The Operator's Role",
      q: "If Ghost does the watching, what is my job?",
      ph: "Ask what excellent operators do differently\u2026",
      body: `
            <div class="kicker mono">Doctrine &middot; Lesson 2</div>
            <p class="lead">Ghost keeps the watch. <span class="dim">You command it.</span></p>
            <p>Your job shifts from staring at screens to directing an intelligence asset. You decide what matters on this site, encode it as questions, standing instructions, and alert rules — and judge what comes back. Ghost is tireless and literal; you supply context, priorities, and decisions.</p>
            <ul class="feat">
              <li><span class="dot"></span><div><div class="ft-title">You define what "normal" means</div><div class="ft-desc">Every site has its own rhythm. The night-shift forklift that is routine at a 24/7 depot is an anomaly at a sealed pharmaceutical warehouse. You teach Ghost the difference.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">You ask the second question</div><div class="ft-desc">Ghost's first answer is rarely the end. "A maintenance contractor entered the electrical room" should trigger your follow-up: "Was he carrying anything when he left?"</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">You own every alert</div><div class="ft-desc">When Ghost interrupts, a human acknowledges, verifies on the live feed, and decides. Ghost never closes its own alerts — that is deliberate.</div></div></li>
              <li><span class="dot"></span><div><div class="ft-title">You keep the system honest</div><div class="ft-desc">Rules drift, cameras move, sites change. A professional operator reviews standing instructions at the start of every shift.</div></div></li>
            </ul>
            <div class="drill">
              <div class="d-k">Mindset check</div>
              <div class="d-t">Write your site's three questions</div>
              <div class="d-b">Before the next lesson, write down the three questions you most wish your cameras could answer about your site. You will ask Ghost all three by the end of Part III.</div>
            </div>`,
    },
    {
      title: "The 3CLICKS Principle",
      q: "I've heard Ghost people say \u201cthree clicks.\u201d What does that mean?",
      ph: "Ask how the interface stays this small\u2026",
      body: `
            <div class="kicker mono">Doctrine &middot; Lesson 3</div>
            <p class="lead">Anything that matters is at most <span class="dim">three clicks away. Usually fewer.</span></p>
            <p>Ghost's interface looks almost empty on purpose. There are no dashboards to configure, no grids of forty tiles, no nested menus. There is a sidebar of conversations and a chat. That austerity is a doctrine called 3CLICKS: an operator under pressure must reach any camera, any answer, and any control in three clicks or less.</p>
            <div class="codeblock">
              <div class="cb-head"><span class="mono">three-clicks-to-any-camera</span><span class="copy mono">copy</span></div>
              <div class="cb-body">
                <div class="pipe">
                  <div class="node"><span class="n-t">Click 1</span><span class="n-s">open the area</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Click 2</span><span class="n-s">open the group</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Click 3</span><span class="n-s">open the conversation</span></div>
                  <div class="arrow">&rarr;</div>
                  <div class="node"><span class="n-t">Ask</span><span class="n-s">plain language</span></div>
                </div>
              </div>
            </div>
            <p>Everything in this course honors that promise. When a lesson tells you where a control lives, count the clicks — you will rarely pass three. If you ever find yourself hunting through the interface, stop: you are missing a concept, not a button.</p>
            <p>The corollary matters too: because the surface is small, mastery means depth, not coverage. You will learn every control in this booklet — there are fewer than you think, and each one earns its place.</p>`,
    },
    {
      title: "First Entry: Secure Access",
      q: "How do I actually sign in to the console?",
      ph: "Ask for a quick-login link\u2026",
      body: `
            <div class="kicker mono">Orientation &middot; Lesson 4</div>
            <p class="lead">Two doors in. <span class="dim">Credentials, or a quick-login link.</span></p>
            <p>Ghost's console is reached through the Secure Access screen. You will use one of two paths, depending on how your site administrator provisioned you:</p>
            <ol class="steps">
              <li><div><div class="st-t">Agent credentials</div><div class="st-d">Enter your agent name and your Ghost API key on the Secure Access screen, then press Sign in. The eye icon next to the key field toggles its visibility — keep it hidden whenever anyone else can see your screen.</div></div></li>
              <li><div><div class="st-t">Quick-login link</div><div class="st-d">An administrator can issue you a one-time magic link. Opening it signs you straight into the console — no typing. Links are single-use and expire; treat an unused one like a key to the building.</div></div></li>
              <li><div><div class="st-t">Verify where you landed</div><div class="st-d">After sign-in you should see the conversations sidebar on one side and an empty chat inviting you to start. If you see the marketing site instead, your session expired — sign in again.</div></div></li>
            </ol>
            <div class="chips">
              <div class="chip"><div class="c-t">Session discipline</div><div class="c-d">Sessions expire on schedule. Ghost returns you to Secure Access — never leave a signed-in console unattended.</div></div>
              <div class="chip"><div class="c-t">Guided tour</div><div class="c-d">On your very first entry, a built-in tour spotlights the main controls. Let it run once — Part IX shows how to replay it.</div></div>
            </div>`,
    },
  ],
};
