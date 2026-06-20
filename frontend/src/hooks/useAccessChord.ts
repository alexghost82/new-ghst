import { useCallback, useEffect, useRef, useState } from "react";

// Hidden access gesture: press and hold "1" + "4" + "8" together for four
// seconds to unlock the retro secure-terminal variant of the Secure Access
// screen. Deliberately a sustained chord (not a sequence) so it can't be
// triggered by ordinary typing — and we never call preventDefault, so holding
// digits never blocks a visitor entering an API key that contains them.
const REQUIRED_KEYS = ["1", "4", "8"];
const HOLD_MS = 4000;

export type ChordPhase = "idle" | "holding" | "granted" | "aborted";

interface ChordState {
  phase: ChordPhase;
  progress: number;
  remaining: number;
  pressed: string[];
}

export function useAccessChord(
  onGranted: () => void,
  active: boolean,
): ChordState {
  const [phase, setPhase] = useState<ChordPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(4);
  const [pressed, setPressed] = useState<string[]>([]);

  const pressedRef = useRef<Set<string>>(new Set());
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const grantedRef = useRef(false);

  const allHeld = useCallback(
    () => REQUIRED_KEYS.every((k) => pressedRef.current.has(k)),
    [],
  );

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
  }, []);

  const tick = useCallback(() => {
    if (startRef.current === null) return;
    const elapsed = performance.now() - startRef.current;
    const p = Math.min(elapsed / HOLD_MS, 1);
    setProgress(p);
    setRemaining(Math.max(0, Math.ceil((HOLD_MS - elapsed) / 1000)));
    if (p >= 1) {
      stopLoop();
      grantedRef.current = true;
      setPhase("granted");
      setProgress(1);
      setRemaining(0);
      onGranted();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onGranted, stopLoop]);

  useEffect(() => {
    if (!active) return;

    const sync = () => setPressed([...pressedRef.current]);

    const onKeyDown = (e: KeyboardEvent) => {
      if (grantedRef.current) return;
      if (!REQUIRED_KEYS.includes(e.key)) return;
      pressedRef.current.add(e.key);
      sync();
      if (allHeld() && startRef.current === null) {
        startRef.current = performance.now();
        setPhase("holding");
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (grantedRef.current) return;
      if (!REQUIRED_KEYS.includes(e.key)) return;
      pressedRef.current.delete(e.key);
      sync();
      if (!allHeld() && startRef.current !== null) {
        stopLoop();
        setProgress(0);
        setRemaining(4);
        setPhase("aborted");
        window.setTimeout(() => {
          if (!grantedRef.current && !allHeld()) setPhase("idle");
        }, 900);
      }
    };

    const onBlur = () => {
      pressedRef.current.clear();
      sync();
      if (!grantedRef.current) {
        stopLoop();
        setProgress(0);
        setRemaining(4);
        setPhase("idle");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      stopLoop();
    };
  }, [active, allHeld, tick, stopLoop]);

  return { phase, progress, remaining, pressed };
}
