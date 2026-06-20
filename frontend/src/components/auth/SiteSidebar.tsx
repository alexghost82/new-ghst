import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  GraduationCap,
  Handshake,
  Languages,
  Layers,
  Lock,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useThemeStore } from "../../stores/themeStore";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useLanguageStore, type Dir, type Locale } from "../../stores/languageStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";

// The public marketing site has six content pages. Each renders this single,
// shared navigation panel so the chrome is identical everywhere — only the
// `active` highlight and the page content change between them.
export type SitePage =
  | "defense"
  | "talk"
  | "drone"
  | "security"
  | "usecases"
  | "capabilities"
  | "team"
  | "careers"
  | "partners"
  | "training";

interface SiteSidebarProps {
  // Which page is currently shown — drives the active highlight and lets the
  // brand / active item scroll-to-top instead of re-navigating.
  active: SitePage;
  // Navigate to another marketing page (SiteApp maps this to its screen state).
  onNavigate: (page: SitePage) => void;
  // Scroll the current page to the top (brand mark + clicking the active item).
  // The home page wires this to its "ghost portal" transition.
  onScrollTop?: () => void;
  // The bordered "Back" action — returns to the Secure Access (login) screen.
  onBack: () => void;
  // The primary CTA — also routes to the login screen ("Request access").
  onAccess: () => void;
  // Some pages relabel the CTA (e.g. the drone page asks for a demonstration).
  accessLabel?: string;
  // The marketing pages render English / LTR today; callers pass these
  // explicitly so the chrome matches the page. They default to the app's
  // language store, keeping the component ready for a future bilingual site.
  locale?: Locale;
  dir?: Dir;
}

interface NavItem {
  id: SitePage;
  icon: LucideIcon;
  label: Record<Locale, string>;
}

// Combat-readiness "kits" — packaged capabilities that route to an existing
// page. New kits are added here as the catalog grows.
const KITS_ITEMS: NavItem[] = [
  {
    id: "drone",
    icon: Plane,
    label: { en: "Drone Detection Kit", he: "\u05e2\u05e8\u05db\u05ea \u05d2\u05d9\u05dc\u05d5\u05d9 \u05e8\u05d7\u05e4\u05e0\u05d9\u05dd" },
  },
];

// Everything now lives under "Explore". "Talk to Ghost" is the featured,
// highlighted entry (rendered with the tactical-card treatment below).
const EXPLORE_ITEMS: NavItem[] = [
  {
    id: "talk",
    icon: MessageSquare,
    label: { en: "Talk to Ghost", he: "\u05d3\u05d1\u05e8\u05d5 \u05e2\u05dd Ghost" },
  },
  {
    id: "capabilities",
    icon: Sparkles,
    label: { en: "What Ghost Can Do", he: "\u05de\u05d4 Ghost \u05d9\u05d5\u05d3\u05e2 \u05dc\u05e2\u05e9\u05d5\u05ea" },
  },
  {
    id: "usecases",
    icon: Layers,
    label: { en: "Use Cases", he: "\u05ea\u05e8\u05d7\u05d9\u05e9\u05d9 \u05e9\u05d9\u05de\u05d5\u05e9" },
  },
  {
    id: "team",
    icon: Users,
    label: { en: "People", he: "\u05d4\u05e6\u05d5\u05d5\u05ea" },
  },
  {
    id: "careers",
    icon: Briefcase,
    label: { en: "Careers", he: "\u05e7\u05e8\u05d9\u05d9\u05e8\u05d4" },
  },
  {
    id: "partners",
    icon: Handshake,
    label: { en: "Partners", he: "\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05e9\u05d5\u05ea\u05e4\u05d9\u05dd" },
  },
  {
    id: "security",
    icon: Lock,
    label: { en: "Security", he: "\u05d0\u05d1\u05d8\u05d7\u05ea \u05de\u05d9\u05d3\u05e2" },
  },
  {
    id: "training",
    icon: GraduationCap,
    label: {
      en: "Operator Training Syllabus",
      he: "\u05e1\u05d9\u05dc\u05d1\u05d5\u05e1 \u05dc\u05d4\u05db\u05e9\u05e8\u05ea \u05de\u05e4\u05e2\u05d9\u05dc\u05d9\u05dd",
    },
  },
];

const COPY: Record<
  Locale,
  {
    back: string;
    overview: string;
    solutions: string;
    explore: string;
    combatKits: string;
    requestAccess: string;
    switchLanguage: string;
    switchLanguageLabel: string;
    lightMode: string;
    darkMode: string;
    openNav: string;
    closeNav: string;
    home: string;
    collapseNav: string;
    expandNav: string;
  }
> = {
  en: {
    back: "Back",
    overview: "Overview",
    solutions: "Solutions",
    explore: "Explore",
    combatKits: "Combat Kits",
    requestAccess: "Request access",
    // The visible label always names the *target* language in its own script.
    switchLanguage: "עברית",
    switchLanguageLabel: "Switch to Hebrew",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    openNav: "Open navigation",
    closeNav: "Close navigation",
    home: "Go to home",
    collapseNav: "Hide navigation",
    expandNav: "Show navigation",
  },
  he: {
    back: "\u05d7\u05d6\u05e8\u05d4",
    overview: "\u05e1\u05e7\u05d9\u05e8\u05d4",
    switchLanguage: "English",
    switchLanguageLabel: "\u05de\u05e2\u05d1\u05e8 \u05dc\u05d0\u05e0\u05d2\u05dc\u05d9\u05ea",
    solutions: "\u05e4\u05ea\u05e8\u05d5\u05e0\u05d5\u05ea",
    explore: "\u05dc\u05d2\u05dc\u05d5\u05ea",
    combatKits: "\u05e2\u05e8\u05db\u05d5\u05ea \u05dc\u05d7\u05d9\u05de\u05d4",
    requestAccess: "\u05d1\u05e7\u05e9\u05ea \u05d2\u05d9\u05e9\u05d4",
    lightMode: "\u05de\u05e6\u05d1 \u05d1\u05d4\u05d9\u05e8",
    darkMode: "\u05de\u05e6\u05d1 \u05db\u05d4\u05d4",
    openNav: "\u05e4\u05ea\u05d7 \u05ea\u05e4\u05e8\u05d9\u05d8",
    closeNav: "\u05e1\u05d2\u05d5\u05e8 \u05ea\u05e4\u05e8\u05d9\u05d8",
    home: "\u05dc\u05d3\u05e3 \u05d4\u05d1\u05d9\u05ea",
    collapseNav: "\u05d4\u05e1\u05ea\u05e8 \u05ea\u05e4\u05e8\u05d9\u05d8",
    expandNav: "\u05d4\u05e6\u05d2 \u05ea\u05e4\u05e8\u05d9\u05d8",
  },
};

export default function SiteSidebar({
  active,
  onNavigate,
  onScrollTop,
  onBack,
  onAccess,
  accessLabel,
  locale: localeProp,
  dir: dirProp,
}: SiteSidebarProps) {
  const { theme, toggle: toggleTheme } = useThemeStore();
  const switchLocale = useSiteLocaleStore((s) => s.switchLocale);
  const storeLocale = useLanguageStore((s) => s.locale);
  const storeDir = useLanguageStore((s) => s.dir);
  const locale = localeProp ?? storeLocale;
  const dir = dirProp ?? storeDir;
  const t = COPY[locale];

  const collapsed = useSiteSidebarStore((s) => s.collapsed);
  const scrollHidden = useSiteSidebarStore((s) => s.scrollHidden);
  const toggleCollapsed = useSiteSidebarStore((s) => s.toggleCollapsed);
  const expand = useSiteSidebarStore((s) => s.expand);
  const setScrollHidden = useSiteSidebarStore((s) => s.setScrollHidden);

  // Persistent on desktop (lg+), a slide-in drawer on mobile.
  const [navOpen, setNavOpen] = useState(false);

  // 0 → 1 reading progress through the scroll-parent. Drives the slim edge
  // progress rail that takes over while the panel is hidden, so the operator
  // always knows how far they are from the bottom of the brief.
  const [scrollProgress, setScrollProgress] = useState(0);

  // Auto-hide on scroll: watch the scroll-parent of this fixed panel (the page
  // root, which owns `overflow-y-auto`). Scrolling down past a small threshold
  // slides the panel off-screen; scrolling up brings it back. This only nudges
  // `scrollHidden` (a transform) — it never reflows the page content.
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Fresh page: never start auto-hidden from a previous page's scroll.
    setScrollHidden(false);
    const scroller = asideRef.current?.parentElement;
    if (!scroller) return;
    let lastY = scroller.scrollTop;
    let frame = 0;
    const measureProgress = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      setScrollProgress(max > 8 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0);
    };
    measureProgress();
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = scroller.scrollTop;
        const delta = y - lastY;
        // Ignore tiny jitter; always reveal near the very top.
        if (y < 80) {
          setScrollHidden(false);
        } else if (delta > 6) {
          setScrollHidden(true);
        } else if (delta < -6) {
          setScrollHidden(false);
        }
        measureProgress();
        lastY = y;
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [setScrollHidden]);

  // When manually expanded again, clear any stale scroll-hide so the panel
  // doesn't immediately flicker back off.
  useEffect(() => {
    if (!collapsed) return;
    setScrollHidden(false);
  }, [collapsed, setScrollHidden]);

  const isRtl = dir === "rtl";
  // Logical side placement without relying on the `rtl:` ancestor variant, so
  // the panel is correct even though each page forces its own `dir`.
  const sidePlacement = isRtl ? "right-0 border-l" : "left-0 border-r";
  const closedTransform = isRtl ? "translate-x-full" : "-translate-x-full";
  // On desktop the panel hides when manually collapsed OR auto-hidden by scroll.
  const desktopHidden = collapsed || scrollHidden;
  // Literal Tailwind tokens so the JIT compiler keeps the lg: variants.
  const desktopTransform = desktopHidden
    ? isRtl
      ? "lg:translate-x-full"
      : "lg:-translate-x-full"
    : "lg:translate-x-0";

  const goHome = () => {
    setNavOpen(false);
    if (active === "defense") onScrollTop?.();
    else onNavigate("defense");
  };

  const selectItem = (id: SitePage) => {
    setNavOpen(false);
    if (id === active) onScrollTop?.();
    else onNavigate(id);
  };

  const Brand = ({ size = 8 }: { size?: number }) => (
    <button
      onClick={goHome}
      aria-label={t.home}
      className="group flex items-center gap-2.5 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
    >
      <span
        className={`rounded-lg overflow-hidden flex-shrink-0 transition-transform duration-200 group-hover:scale-105 group-active:scale-95 ${
          size === 7 ? "w-7 h-7" : "w-8 h-8"
        }`}
      >
        <img
          src="/ghost-icon.png"
          alt="Ghost"
          className="ghost-brand-icon w-full h-full object-cover"
          draggable={false}
        />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ghost-text-primary transition-colors duration-200 group-hover:text-ghost-accent">
        GHOST
      </span>
    </button>
  );

  // Shared tactical nav row — monochrome at rest, a leading accent "target"
  // indicator + accent icon when active, a smooth surface fill and a small
  // icon nudge on hover. Easing follows the brief aesthetic.
  const NavRow = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    featured = false,
  }: {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick: () => void;
    featured?: boolean;
  }) => {
    // Featured row — the tactical-card treatment from `ghost-tactical-cards`:
    // a bordered, faintly-translucent surface that stays monochrome at rest and
    // reveals an ambient color wash, a lift and an accent on intent. A small
    // live pulse marks it as the primary action.
    if (featured) {
      return (
        <button
          onClick={onClick}
          aria-current={isActive ? "page" : undefined}
          className={`group relative w-full inline-flex items-center gap-2.5 h-11 ps-4 pe-3 rounded-xl overflow-hidden border text-[14px] font-medium outline-none transition-[transform,background-color,border-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ghost-accent/40 ${
            isActive
              ? "border-ghost-accent/40 bg-ghost-surface/60 text-ghost-text-primary"
              : "border-ghost-border-subtle bg-ghost-surface/30 text-ghost-text-secondary hover:border-ghost-text-muted hover:bg-ghost-surface/50 hover:text-ghost-text-primary"
          }`}
        >
          {/* Ambient color wash — the only color, revealed on intent */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            style={{
              background:
                "radial-gradient(125% 95% at 0% 50%, rgb(96 116 132 / 0.16), transparent 70%)",
            }}
          />
          <Icon
            size={16}
            className={`relative flex-shrink-0 transition-[color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${
              isActive ? "text-ghost-accent" : "text-ghost-accent/80 group-hover:text-ghost-accent"
            }`}
          />
          <span className="relative text-start leading-tight">{label}</span>
          {/* Live pulse — flags the primary action */}
          <span aria-hidden className="relative ms-auto flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-ghost-accent opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ghost-accent" />
          </span>
        </button>
      );
    }

    return (
      <button
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={`group relative w-full inline-flex items-center gap-2.5 h-10 ps-4 pe-3 rounded-xl text-[14px] outline-none transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ghost-accent/40 ${
          isActive
            ? "bg-ghost-surface/60 text-ghost-text-primary font-medium"
            : "text-ghost-text-secondary font-normal hover:bg-ghost-surface/40 hover:text-ghost-text-primary"
        }`}
      >
        {/* Leading target indicator — full when active, a hint on hover */}
        <span
          aria-hidden
          className={`absolute inset-y-2 start-0 w-0.5 rounded-full bg-ghost-accent transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] origin-center ${
            isActive
              ? "opacity-100 scale-y-100"
              : "opacity-0 scale-y-50 group-hover:opacity-60 group-hover:scale-y-75"
          }`}
        />
        <Icon
          size={16}
          className={`flex-shrink-0 transition-[color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${
            isActive ? "text-ghost-accent" : "text-ghost-text-muted group-hover:text-ghost-text-primary"
          }`}
        />
        <span className="text-start leading-tight">{label}</span>
      </button>
    );
  };

  const renderItem = (item: NavItem) => (
    <NavRow
      key={item.id}
      icon={item.icon}
      label={item.label[locale]}
      isActive={item.id === active}
      onClick={() => selectItem(item.id)}
      featured={item.id === "talk"}
    />
  );

  return (
    <>
      {/* ── Mobile top bar — hamburger + brand + access, opens the drawer ── */}
      <div
        dir={dir}
        className="lg:hidden sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-ghost-border-subtle/60 bg-ghost-bg/80 px-4 pt-safe backdrop-blur-xl"
      >
        <button
          onClick={() => setNavOpen(true)}
          aria-label={t.openNav}
          className="w-9 h-9 -ms-1.5 rounded-xl flex items-center justify-center text-ghost-text-secondary outline-none transition-colors duration-150 hover:text-ghost-text-primary hover:bg-ghost-surface-hover focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
        >
          <Menu size={18} />
        </button>
        <Brand size={7} />
        <button
          onClick={onAccess}
          className="ms-auto inline-flex items-center gap-1.5 h-9 ps-3.5 pe-3 rounded-full bg-ghost-accent text-ghost-bg text-[13px] font-semibold outline-none transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.98]"
        >
          <span>{accessLabel ?? t.requestAccess}</span>
          <ArrowRight size={14} className="rtl:rotate-180" />
        </button>
      </div>

      {/* ── Mobile drawer scrim ── */}
      <div
        aria-hidden
        onClick={() => setNavOpen(false)}
        className={`lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* ── Persistent navigation panel ── */}
      <aside
        ref={asideRef}
        dir={dir}
        className={`isolate fixed top-0 ${sidePlacement} z-50 h-full w-[280px] lg:w-[260px] flex flex-col bg-ghost-sidebar border-ghost-border-subtle/60 pt-safe pb-safe lg:pt-0 lg:pb-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          navOpen ? "translate-x-0" : closedTransform
        } ${desktopTransform}`}
      >
        {/* Faint tactical ambient wash — the only "color" at rest */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute -top-24 -start-16 w-64 h-64 rounded-full blur-3xl opacity-50"
            style={{ background: "radial-gradient(circle, rgb(96 116 132 / 0.18), transparent 70%)" }}
          />
          <div
            className="absolute bottom-16 -end-20 w-72 h-72 rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(circle, rgb(104 116 78 / 0.16), transparent 72%)" }}
          />
        </div>

        {/* Brand header */}
        <div className="flex h-14 items-center gap-2.5 px-3">
          <Brand />
          {/* Desktop: collapse the panel to give the page full width. */}
          <button
            onClick={toggleCollapsed}
            aria-label={t.collapseNav}
            title={t.collapseNav}
            className="hidden lg:flex ms-auto w-8 h-8 rounded-xl items-center justify-center text-ghost-text-muted outline-none transition-colors duration-150 hover:text-ghost-text-primary hover:bg-ghost-surface-hover focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
          >
            <PanelLeftClose size={17} className="rtl:scale-x-[-1]" aria-hidden="true" />
          </button>
          <button
            onClick={() => setNavOpen(false)}
            aria-label={t.closeNav}
            className="lg:hidden ms-auto w-8 h-8 rounded-xl flex items-center justify-center text-ghost-text-secondary outline-none transition-colors duration-150 hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
          >
            <X size={17} />
          </button>
        </div>

        {/* Primary action — "Back" to Secure Access */}
        <div className="px-2 pt-1">
          <button
            onClick={() => {
              setNavOpen(false);
              onBack();
            }}
            className="group w-full inline-flex items-center gap-2 h-11 px-3 rounded-xl border border-ghost-border-subtle/70 text-[14px] font-medium text-ghost-text-primary outline-none transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-surface/50 hover:border-ghost-border-subtle focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
          >
            <ArrowLeft
              size={16}
              className="text-ghost-text-muted transition-[transform,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-0.5 group-hover:text-ghost-text-primary rtl:rotate-180 rtl:group-hover:translate-x-0.5"
            />
            <span>{t.back}</span>
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-2 pt-4">
          {/* Overview — the Defense & National Security brief (home) */}
          <div className="flex flex-col gap-0.5">
            <NavRow
              icon={ShieldCheck}
              label={t.overview}
              isActive={active === "defense"}
              onClick={goHome}
            />
          </div>

          <p className="flex items-center gap-2 px-4 pt-5 pb-1.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-ghost-text-muted">
              {t.explore}
            </span>
            <span className="flex-1 h-px bg-ghost-border-subtle/70" />
          </p>
          <div className="flex flex-col gap-0.5">{EXPLORE_ITEMS.map(renderItem)}</div>

          <p className="flex items-center gap-2 px-4 pt-5 pb-1.5">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-ghost-text-muted">
              {t.combatKits}
            </span>
            <span className="flex-1 h-px bg-ghost-border-subtle/70" />
          </p>
          <div className="flex flex-col gap-0.5">{KITS_ITEMS.map(renderItem)}</div>
        </nav>

        {/* Footer — language toggle + theme toggle + primary CTA */}
        <div className="px-2 pb-3 pt-2 border-t border-ghost-border-subtle/50">
          <button
            onClick={() => {
              setNavOpen(false);
              switchLocale();
            }}
            className="group w-full inline-flex items-center gap-2.5 h-10 ps-4 pe-3 rounded-xl text-[14px] font-normal text-ghost-text-secondary outline-none transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-surface/40 hover:text-ghost-text-primary focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
            aria-label={t.switchLanguageLabel}
            title={t.switchLanguageLabel}
          >
            <Languages
              size={16}
              className="flex-shrink-0 text-ghost-text-muted transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-ghost-text-primary"
            />
            <span>{t.switchLanguage}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="group mt-0.5 w-full inline-flex items-center gap-2.5 h-10 ps-4 pe-3 rounded-xl text-[14px] font-normal text-ghost-text-secondary outline-none transition-[background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-ghost-surface/40 hover:text-ghost-text-primary focus-visible:ring-2 focus-visible:ring-ghost-accent/40"
            aria-label={theme === "dark" ? t.lightMode : t.darkMode}
          >
            {theme === "dark" ? (
              <Sun size={16} className="flex-shrink-0 text-ghost-text-muted transition-[color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-ghost-text-primary group-hover:rotate-45" />
            ) : (
              <Moon size={16} className="flex-shrink-0 text-ghost-text-muted transition-[color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-ghost-text-primary group-hover:-rotate-12" />
            )}
            <span>{theme === "dark" ? t.lightMode : t.darkMode}</span>
          </button>

          <button
            onClick={() => {
              setNavOpen(false);
              onAccess();
            }}
            className="group mt-1.5 w-full inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-ghost-accent text-ghost-bg text-[14px] font-semibold outline-none transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ghost-accent/50"
          >
            <span>{accessLabel ?? t.requestAccess}</span>
            <ArrowRight
              size={15}
              className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180"
            />
          </button>
        </div>
      </aside>

      {/* ── Edge reading-progress rail ── */}
      {/* Takes over the moment the panel leaves (manual collapse or scroll-hide),
          a slim black bar pinned to the logical start edge that fills toward the
          bottom of the brief. It fades out the instant the panel returns. */}
      <div
        aria-hidden
        className={`hidden lg:block fixed inset-y-0 start-0 z-30 w-[3px] transition-opacity duration-300 ease-out ${
          desktopHidden ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Faint track */}
        <div className="absolute inset-0 bg-ghost-border-subtle/25" />
        {/* Filled segment — grows downward with reading progress */}
        <div
          className="absolute inset-x-0 top-0 will-change-[height] transition-[height] duration-150 ease-out"
          style={{
            height: `${scrollProgress * 100}%`,
            background:
              "linear-gradient(to bottom, rgb(var(--ghost-text-primary) / 0.55), rgb(var(--ghost-text-primary)) 60%, rgb(var(--ghost-accent)))",
            boxShadow: "0 0 10px 0 rgb(var(--ghost-accent) / 0.45)",
          }}
        />
        {/* Glowing leading tip riding the fill front */}
        <div
          className="absolute inset-x-[-3px] h-3.5 -translate-y-1/2 rounded-full blur-[3px] transition-[top] duration-150 ease-out"
          style={{
            top: `${scrollProgress * 100}%`,
            background: "rgb(var(--ghost-accent))",
            opacity: scrollProgress > 0.01 ? 0.9 : 0,
          }}
        />
      </div>

      {/* ── Desktop floating brand mark — whenever the panel is off-screen ── */}
      {/* Shown for both manual collapse and the scroll auto-hide. Pinned at the
          exact spot the in-panel brand icon occupies (header is h-14 with px-3,
          icon is 32px → 12px from the top and start edges) and layered *under*
          the panel (z-30 < z-50). As the panel glides off it is revealed in
          place, so the Ghost mark reads as simply staying put. Clicking it
          brings the navigation back. */}
      <button
        type="button"
        onClick={() => {
          expand();
          setScrollHidden(false);
        }}
        aria-label={t.expandNav}
        title={t.expandNav}
        className={`hidden lg:flex fixed top-3 start-3 z-30 w-8 h-8 items-center justify-center rounded-lg outline-none transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-ghost-accent/40 ${
          desktopHidden
            ? "opacity-100 translate-x-0"
            : "pointer-events-none opacity-0 -translate-x-1 rtl:translate-x-1"
        }`}
      >
        <span className="w-8 h-8 rounded-lg overflow-hidden">
          <img
            src="/ghost-icon.png"
            alt="Ghost"
            className="ghost-brand-icon w-full h-full object-cover"
            draggable={false}
          />
        </span>
      </button>

      {/* ── Desktop reopen tab — only while manually collapsed ── */}
      <button
        type="button"
        onClick={expand}
        aria-label={t.expandNav}
        title={t.expandNav}
        className={`hidden lg:flex fixed top-[120px] start-0 z-30 items-center justify-center w-7 h-10 rounded-e-md bg-ghost-sidebar border border-ghost-border-subtle border-s-0 text-ghost-text-muted shadow-[2px_0_8px_rgb(0_0_0/0.12)] outline-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-ghost-accent hover:bg-ghost-accent/10 hover:border-ghost-accent/30 focus-visible:ring-2 focus-visible:ring-ghost-accent/40 ${
          collapsed
            ? "opacity-100"
            : "pointer-events-none opacity-0 -translate-x-2 rtl:translate-x-2"
        }`}
      >
        <PanelLeftOpen size={16} className="rtl:scale-x-[-1]" aria-hidden="true" />
      </button>
    </>
  );
}
