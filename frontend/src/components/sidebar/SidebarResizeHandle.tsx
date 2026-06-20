import { useCallback, useEffect, useRef, useState } from "react";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebarStore,
} from "../../stores/sidebarStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";

const KEYBOARD_STEP = 16;
// Long-press to confirm "intent to resize". Matches the user's request for
// "לחיצה ארוכה מוחזקת וגרירה" — short enough to feel responsive, long enough
// to filter out accidental brushes against the sidebar's inner edge.
const LONG_PRESS_MS = 180;
// If the pointer moves past this threshold before the long-press timer fires,
// activate drag immediately — power users don't have to wait the full 180ms
// once they're clearly past "accidental nudge" territory.
const MOVE_THRESHOLD_PX = 3;

export default function SidebarResizeHandle() {
  const width = useSidebarStore((s) => s.width);
  const setWidth = useSidebarStore((s) => s.setWidth);
  const resetWidth = useSidebarStore((s) => s.resetWidth);
  const dir = useLanguageStore((s) => s.dir);
  const t = useT();

  const [isHovered, setIsHovered] = useState(false);
  // `armed` = pointer is down but drag hasn't started yet (either still waiting
  // out the long-press window or movement under the threshold).
  // `active` = full resize mode — width updates flow on every move.
  const [isArmed, setIsArmed] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const armedTimerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  // dir can flip while we're mid-drag (rare), so we mirror it through a ref
  // to keep the global pointer listener in sync without re-binding it.
  const dirRef = useRef<"rtl" | "ltr">(dir);
  const isActiveRef = useRef(false);

  useEffect(() => {
    dirRef.current = dir;
  }, [dir]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const clearArmedTimer = useCallback(() => {
    if (armedTimerRef.current !== null) {
      window.clearTimeout(armedTimerRef.current);
      armedTimerRef.current = null;
    }
  }, []);

  const activateDrag = useCallback(() => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    setIsActive(true);
    useSidebarStore.getState().setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const endDrag = useCallback(() => {
    clearArmedTimer();
    setIsArmed(false);
    setIsActive(false);
    isActiveRef.current = false;
    useSidebarStore.getState().setResizing(false);
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
    if (pointerIdRef.current !== null && handleRef.current) {
      try {
        handleRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {
        // Pointer may have already been released by the browser (e.g. window
        // blur). Swallow — we've already cleared the local state.
      }
    }
    pointerIdRef.current = null;
  }, [clearArmedTimer]);

  // Window-level listeners are the safety net: pointer capture works in most
  // browsers, but if it ever drops (dev overlays, iframes, fullscreen), the
  // global handlers guarantee we still finish cleanly.
  useEffect(() => {
    if (!isArmed) return;
    const onMove = (event: PointerEvent) => {
      const delta = event.clientX - startXRef.current;
      if (!isActiveRef.current && Math.abs(delta) >= MOVE_THRESHOLD_PX) {
        activateDrag();
      }
      if (!isActiveRef.current) return;
      // In RTL the sidebar sits on the visual right; dragging toward the chat
      // (i.e. leftward) should *grow* the sidebar, so we invert the sign.
      const signed = dirRef.current === "rtl" ? -delta : delta;
      useSidebarStore.getState().setWidth(startWidthRef.current + signed);
    };
    const onUp = () => endDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
  }, [isArmed, activateDrag, endDrag]);

  useEffect(() => {
    return () => {
      clearArmedTimer();
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, [clearArmedTimer]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort; window listeners above will still track.
    }
    startXRef.current = event.clientX;
    startWidthRef.current = useSidebarStore.getState().width;
    setIsArmed(true);
    clearArmedTimer();
    armedTimerRef.current = window.setTimeout(() => {
      activateDrag();
    }, LONG_PRESS_MS);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const visualLeft = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    const visualRight = dir === "rtl" ? "ArrowLeft" : "ArrowRight";

    if (event.key === visualLeft) {
      event.preventDefault();
      setWidth(width - KEYBOARD_STEP);
    } else if (event.key === visualRight) {
      event.preventDefault();
      setWidth(width + KEYBOARD_STEP);
    } else if (event.key === "Home") {
      event.preventDefault();
      setWidth(SIDEBAR_MIN_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      setWidth(SIDEBAR_MAX_WIDTH);
    }
  };

  const handleDoubleClick = () => {
    resetWidth();
  };

  // Visual progression:
  //   idle      → invisible thin edge line, hot zone still 8px wide
  //   hover     → faint bronze line + grip dots fade in
  //   armed     → grip dots brighten (user is committing)
  //   active    → full bronze line + dots, body cursor switches to col-resize
  const lineColor = isActive
    ? "bg-ghost-bronze"
    : isArmed
      ? "bg-ghost-bronze/70"
      : isHovered
        ? "bg-ghost-bronze/40"
        : "bg-transparent";

  const dotColor = isActive
    ? "bg-ghost-bronze"
    : isArmed
      ? "bg-ghost-bronze/85"
      : "bg-ghost-bronze/55";

  const showGrip = isHovered || isArmed || isActive;

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-label={t("resizeSidebar")}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title={t("resizeSidebar")}
      data-resizing={isActive ? "true" : undefined}
      className="group absolute top-0 bottom-0 end-0 z-30 flex w-2 cursor-col-resize touch-none select-none items-center justify-center focus-visible:outline-none"
    >
      {/* Thin edge line — pinned to the inner edge, mirrors the sidebar border */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 end-0 w-px transition-colors duration-150 ${lineColor}`}
      />
      {/* Three-dot vertical grip — the "drag me" affordance */}
      <span
        aria-hidden="true"
        className={`pointer-events-none flex flex-col items-center gap-[3px] transition-all duration-150 ${
          showGrip ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <span className={`block w-[3px] h-[3px] rounded-full ${dotColor}`} />
        <span className={`block w-[3px] h-[3px] rounded-full ${dotColor}`} />
        <span className={`block w-[3px] h-[3px] rounded-full ${dotColor}`} />
      </span>
      {/* Focus ring for keyboard users — non-interfering bronze glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-2 end-[-1px] w-[2px] rounded-full opacity-0 group-focus-visible:opacity-100 bg-ghost-bronze shadow-[0_0_8px_rgb(var(--ghost-bronze)/0.7)]"
      />
    </div>
  );
}
