import { create } from "zustand";

/**
 * Drives the one-off "Ghost high-five" celebration overlay.
 *
 * Triggered when a chat message arrives that mentions the keyword "נועה"
 * (see {@link mentionsNoa}). The overlay plays a short, polished success
 * animation and then auto-dismisses after {@link CELEBRATION_DURATION_MS}.
 */
interface CelebrationState {
  /** Whether the celebration overlay is currently visible. */
  active: boolean;
  /** Bumped on every trigger so the overlay can re-key/replay its animation. */
  runId: number;
  /** Fire the celebration. Re-triggers cleanly even if one is already playing. */
  celebrate: () => void;
  /** Hide the overlay (called by the overlay itself when its timer elapses). */
  dismiss: () => void;
}

/** Visible lifetime of the celebration, in ms (~4s as requested). */
export const CELEBRATION_DURATION_MS = 4000;

/** Keyword that fires the celebration when present in a chat message. */
const NOA_KEYWORD = "נועה";

/** True when the given text contains the trigger keyword. */
export function mentionsNoa(text: string | null | undefined): boolean {
  return !!text && text.includes(NOA_KEYWORD);
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  active: false,
  runId: 0,
  celebrate: () =>
    set((s) => ({ active: true, runId: s.runId + 1 })),
  dismiss: () => set({ active: false }),
}));
