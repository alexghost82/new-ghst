import { create } from "zustand";
import {
  TOUR_CHAPTERS,
  chapterIndexOf,
  stepAt,
  type ChapterId,
  type TourStep,
} from "../onboarding/tourSteps";

// Device-local persistence. Demo/trial visitors all share the same backend
// ``ghostdemo`` user id, so onboarding progress is scoped to the browser/device
// rather than to a user id. A version field lets us re-offer the tour when the
// curriculum changes meaningfully.
const STORAGE_KEY = "ghost-onboarding-v1";
const TOUR_VERSION = 1;

type Status = "idle" | "running" | "completed";

interface PersistedOnboarding {
  version: number;
  status: Status;
  currentChapterId: ChapterId | null;
  currentStepIndex: number;
  completedChapterIds: ChapterId[];
  completedStepIds: string[];
  dismissed: boolean;
}

interface OnboardingState {
  /** True when a valid record existed in localStorage at load time. Used to
   *  decide whether this is a genuine first visit (auto-launch) or a return. */
  hydrated: boolean;
  status: Status;
  currentChapterId: ChapterId | null;
  currentStepIndex: number;
  completedChapterIds: ChapterId[];
  completedStepIds: string[];
  dismissed: boolean;
  hubOpen: boolean;

  startTour: () => void;
  startChapter: (id: ChapterId) => void;
  restart: () => void;
  next: () => void;
  prev: () => void;
  exit: () => void;
  finish: () => void;
  openHub: () => void;
  closeHub: () => void;
}

function loadPersisted(): {
  hydrated: boolean;
  state: Partial<OnboardingState>;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { hydrated: false, state: {} };
    const parsed = JSON.parse(raw) as PersistedOnboarding;
    if (!parsed || parsed.version !== TOUR_VERSION) {
      // Curriculum/version changed — treat as fresh so the tour is re-offered.
      return { hydrated: false, state: {} };
    }
    return {
      hydrated: true,
      state: {
        // Never auto-resume straight into "running" on reload; the launcher
        // offers "continue" instead. Completed stays completed.
        status: parsed.status === "completed" ? "completed" : "idle",
        currentChapterId: parsed.currentChapterId ?? null,
        currentStepIndex: parsed.currentStepIndex ?? 0,
        completedChapterIds: parsed.completedChapterIds ?? [],
        completedStepIds: parsed.completedStepIds ?? [],
        dismissed: parsed.dismissed ?? false,
      },
    };
  } catch {
    return { hydrated: false, state: {} };
  }
}

export const useOnboardingStore = create<OnboardingState>((set, get) => {
  const { hydrated, state: loaded } = loadPersisted();

  const save = () => {
    const s = get();
    const data: PersistedOnboarding = {
      version: TOUR_VERSION,
      status: s.status,
      currentChapterId: s.currentChapterId,
      currentStepIndex: s.currentStepIndex,
      completedChapterIds: s.completedChapterIds,
      completedStepIds: s.completedStepIds,
      dismissed: s.dismissed,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage unavailable — keep in-memory progress only.
    }
  };

  const enter = (chapterId: ChapterId, stepIndex: number) => {
    const step = stepAt(chapterId, stepIndex);
    set((s) => ({
      status: "running",
      currentChapterId: chapterId,
      currentStepIndex: stepIndex,
      hubOpen: false,
      completedStepIds:
        step && !s.completedStepIds.includes(step.id)
          ? [...s.completedStepIds, step.id]
          : s.completedStepIds,
    }));
    save();
  };

  return {
    hydrated,
    status: loaded.status ?? "idle",
    currentChapterId: loaded.currentChapterId ?? null,
    currentStepIndex: loaded.currentStepIndex ?? 0,
    completedChapterIds: loaded.completedChapterIds ?? [],
    completedStepIds: loaded.completedStepIds ?? [],
    dismissed: loaded.dismissed ?? false,
    hubOpen: false,

    startTour: () => {
      const s = get();
      if (
        s.status !== "completed" &&
        s.currentChapterId &&
        chapterIndexOf(s.currentChapterId) >= 0
      ) {
        enter(s.currentChapterId, s.currentStepIndex);
      } else {
        enter(TOUR_CHAPTERS[0].id, 0);
      }
    },

    startChapter: (id: ChapterId) => {
      if (chapterIndexOf(id) < 0) return;
      enter(id, 0);
    },

    restart: () => {
      set({
        completedChapterIds: [],
        completedStepIds: [],
        dismissed: false,
        currentChapterId: null,
        currentStepIndex: 0,
        status: "idle",
      });
      enter(TOUR_CHAPTERS[0].id, 0);
    },

    next: () => {
      const s = get();
      const ci = chapterIndexOf(s.currentChapterId);
      if (ci < 0) return;
      const chapter = TOUR_CHAPTERS[ci];
      const nextIndex = s.currentStepIndex + 1;

      if (nextIndex < chapter.steps.length) {
        enter(chapter.id, nextIndex);
        return;
      }

      // Reached the end of the chapter — mark it complete.
      const completedChapterIds = s.completedChapterIds.includes(chapter.id)
        ? s.completedChapterIds
        : [...s.completedChapterIds, chapter.id];
      set({ completedChapterIds });

      const nextChapter = TOUR_CHAPTERS[ci + 1];
      if (nextChapter) {
        enter(nextChapter.id, 0);
      } else {
        set({
          status: "completed",
          dismissed: true,
          currentChapterId: null,
          currentStepIndex: 0,
          hubOpen: false,
        });
        save();
      }
    },

    prev: () => {
      const s = get();
      const ci = chapterIndexOf(s.currentChapterId);
      if (ci < 0) return;
      if (s.currentStepIndex > 0) {
        enter(s.currentChapterId as ChapterId, s.currentStepIndex - 1);
        return;
      }
      const prevChapter = TOUR_CHAPTERS[ci - 1];
      if (prevChapter) {
        enter(prevChapter.id, prevChapter.steps.length - 1);
      }
    },

    exit: () => {
      set({ status: "idle", hubOpen: false, dismissed: true });
      save();
    },

    finish: () => {
      set({
        status: "completed",
        hubOpen: false,
        dismissed: true,
        currentChapterId: null,
        currentStepIndex: 0,
        completedChapterIds: TOUR_CHAPTERS.map((c) => c.id),
        completedStepIds: TOUR_CHAPTERS.flatMap((c) => c.steps.map((st) => st.id)),
      });
      save();
    },

    openHub: () => set({ hubOpen: true }),
    closeHub: () => set({ hubOpen: false }),
  };
});

/** Returns the currently active step, or null when the tour isn't running. */
export function selectActiveStep(s: OnboardingState): TourStep | null {
  if (s.status !== "running" || !s.currentChapterId) return null;
  return stepAt(s.currentChapterId, s.currentStepIndex);
}
