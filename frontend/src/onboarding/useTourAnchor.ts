import { useEffect, useState } from "react";

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Resolves the live bounding rect of the element carrying
 * ``data-tour="{target}"``. Because a step's target may live inside a panel
 * that is still animating in (Memory/Alert/Settings), the hook polls briefly
 * until the element appears, then keeps the rect fresh on scroll/resize and via
 * a low-frequency interval (cheap, and robust to slide-in transitions).
 *
 * Returns null when target is null or the element can't be found in time, so
 * the overlay can fall back to a centered card.
 */
export function useTourAnchor(target: string | null): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let tries = 0;
    let found = false;

    const read = (): boolean => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${target}"]`,
      );
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      return true;
    };

    const ensureVisible = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${target}"]`,
      );
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const loop = () => {
      if (cancelled) return;
      if (read()) {
        found = true;
        ensureVisible();
        // Re-measure once after the scroll settles.
        requestAnimationFrame(() => {
          if (!cancelled) read();
        });
        return;
      }
      tries += 1;
      if (tries > 90) {
        setRect(null);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onMove = () => {
      if (found) read();
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    // Keep the rect fresh while panels slide in / layout shifts.
    const interval = window.setInterval(() => {
      if (read()) found = true;
    }, 350);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      window.clearInterval(interval);
    };
  }, [target]);

  return rect;
}
