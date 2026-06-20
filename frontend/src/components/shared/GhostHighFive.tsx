import { useEffect, useMemo } from "react";
import {
  useCelebrationStore,
  CELEBRATION_DURATION_MS,
} from "../../stores/celebrationStore";

/**
 * Full-screen, one-off success celebration: the Ghost mark springs in and
 * throws a high-five 🖐️ at the operator, ringed by a burst of confetti and
 * sparkles, with a "Mission accomplished" stamp. Plays for
 * {@link CELEBRATION_DURATION_MS} then fades itself out.
 *
 * Fired by {@link useCelebrationStore} when a chat message mentions "נועה".
 * Purely decorative and non-interactive (``pointer-events: none``) so it never
 * blocks the chat underneath.
 */
export default function GhostHighFive() {
  const active = useCelebrationStore((s) => s.active);
  const runId = useCelebrationStore((s) => s.runId);
  const dismiss = useCelebrationStore((s) => s.dismiss);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(dismiss, CELEBRATION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, runId, dismiss]);

  // Pre-compute a confetti field once per run so positions/colors are stable
  // across the animation's lifetime (re-rolled each trigger via `runId`).
  const confetti = useMemo(() => {
    const colors = [
      "#6e8b3d", // ghost olive
      "#607484", // ghost steel
      "#e9c46a", // warm gold
      "#f4f4f5", // bone white
      "#9db05c", // light olive
    ];
    return Array.from({ length: 46 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 46 + Math.random() * 0.5;
      const dist = 160 + Math.random() * 220;
      return {
        id: i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist - 40,
        rot: Math.random() * 720 - 360,
        delay: Math.random() * 0.18,
        dur: 1.1 + Math.random() * 0.9,
        size: 6 + Math.random() * 8,
        color: colors[i % colors.length],
        round: i % 3 === 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: (360 / 10) * i,
        delay: 0.25 + (i % 5) * 0.07,
      })),
    [runId],
  );

  if (!active) return null;

  return (
    <div
      key={runId}
      className="ghost-hi5"
      role="status"
      aria-live="polite"
      aria-label="Mission accomplished"
    >
      <div className="ghost-hi5__backdrop" />

      <div className="ghost-hi5__stage">
        {/* Expanding success rings */}
        <span className="ghost-hi5__ring ghost-hi5__ring--1" />
        <span className="ghost-hi5__ring ghost-hi5__ring--2" />
        <span className="ghost-hi5__glow" />

        {/* Confetti burst */}
        <div className="ghost-hi5__confetti" aria-hidden>
          {confetti.map((c) => (
            <span
              key={c.id}
              className={`ghost-hi5__piece${c.round ? " ghost-hi5__piece--round" : ""}`}
              style={
                {
                  "--tx": `${c.tx}px`,
                  "--ty": `${c.ty}px`,
                  "--rot": `${c.rot}deg`,
                  "--delay": `${c.delay}s`,
                  "--dur": `${c.dur}s`,
                  width: `${c.size}px`,
                  height: `${c.size * (c.round ? 1 : 0.5)}px`,
                  background: c.color,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Sparkles around the ghost */}
        <div className="ghost-hi5__sparkles" aria-hidden>
          {sparkles.map((s) => (
            <span
              key={s.id}
              className="ghost-hi5__sparkle"
              style={
                {
                  "--angle": `${s.angle}deg`,
                  "--delay": `${s.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* The Ghost giving the high-five */}
        <div className="ghost-hi5__hero" aria-hidden>
          <img
            src="/ghost-icon-evl.png"
            alt=""
            draggable={false}
            className="ghost-hi5__ghost"
          />
          <span className="ghost-hi5__hand">🖐️</span>
          <span className="ghost-hi5__impact" />
        </div>

        <div className="ghost-hi5__caption">
          <span className="ghost-hi5__caption-kicker">Ghost</span>
          <span className="ghost-hi5__caption-main">High five!</span>
        </div>
      </div>
    </div>
  );
}
