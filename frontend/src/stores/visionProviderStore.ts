import { create } from "zustand";

export type VisionProvider = "openai" | "local_vlm" | "auto";

const STORAGE_KEY = "ghost:vision-provider";

function readStored(): VisionProvider {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "openai" || raw === "local_vlm" || raw === "auto") return raw;
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return "auto";
}

interface VisionProviderState {
  provider: VisionProvider;
  setProvider: (provider: VisionProvider) => void;
}

export const useVisionProviderStore = create<VisionProviderState>((set) => ({
  provider: readStored(),
  setProvider: (provider) => {
    try {
      localStorage.setItem(STORAGE_KEY, provider);
    } catch {
      // ignore — preference won't persist this session.
    }
    set({ provider });
  },
}));
