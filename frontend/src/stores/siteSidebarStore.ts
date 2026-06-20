import { create } from "zustand";

// Collapse state for the marketing-site navigation (SiteSidebar). This is a
// separate concern from the chat app's sidebarStore — the marketing pages are
// their own surface with their own persisted preference.
interface SiteSidebarState {
  // Manual, persisted collapse — hides the panel and lets content go full width.
  collapsed: boolean;
  // Transient auto-hide driven by scroll direction. Not persisted: it only
  // slides the panel off-screen (no content reflow) and is reset on scroll up.
  scrollHidden: boolean;
  toggleCollapsed: () => void;
  expand: () => void;
  collapse: () => void;
  setScrollHidden: (value: boolean) => void;
}

const STORAGE_KEY = "ghost-site-sidebar-collapsed";

const storedCollapsed = localStorage.getItem(STORAGE_KEY) === "true";

export const useSiteSidebarStore = create<SiteSidebarState>((set) => ({
  collapsed: storedCollapsed,
  scrollHidden: false,
  toggleCollapsed: () =>
    set((s) => {
      const next = !s.collapsed;
      localStorage.setItem(STORAGE_KEY, String(next));
      // Expanding manually also clears any lingering scroll-hide.
      return { collapsed: next, scrollHidden: next ? s.scrollHidden : false };
    }),
  expand: () => {
    localStorage.setItem(STORAGE_KEY, "false");
    set({ collapsed: false, scrollHidden: false });
  },
  collapse: () => {
    localStorage.setItem(STORAGE_KEY, "true");
    set({ collapsed: true });
  },
  setScrollHidden: (value) => set({ scrollHidden: value }),
}));
