import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import SecurityArchitecturePage from "../components/auth/SecurityArchitecturePage";
import DefenseIntelligencePage from "../components/auth/DefenseIntelligencePage";
import DroneDetectionPage from "../components/auth/DroneDetectionPage";
import UseCasesPage from "../components/auth/UseCasesPage";
import WhatGhostCanDoPage from "../components/auth/WhatGhostCanDoPage";
import TeamPage from "../components/auth/TeamPage";
import CareersPage from "../components/auth/CareersPage";
import PartnersPage from "../components/auth/PartnersPage";
import OperatorTrainingPage from "../components/auth/OperatorTrainingPage";
import TalkToGhostPage from "../components/auth/TalkToGhostPage";
import DownloadsAdminPage from "../components/auth/DownloadsAdminPage";
import LoginModal from "../components/auth/LoginModal";
import CreateUserModal from "../components/auth/CreateUserModal";
import LeadCapturePopup, {
  LKM_DRONE_DOC,
  TRAINING_SYLLABUS_DOC,
  type DownloadDoc,
} from "../components/auth/LeadCapturePopup";
import type { SitePage } from "../components/auth/SiteSidebar";
import { useUserStore } from "../stores/userStore";
import { useDocumentChrome } from "../hooks/useDocumentChrome";
import {
  buildSitePath,
  parseSitePath,
  type SiteScreen,
} from "./siteRoutes";
import { useSiteSeo } from "./useSiteSeo";
import {
  readStoredSiteLocale,
  useSiteLocaleStore,
} from "../stores/siteLocaleStore";

// Where the operational system lives. Logging in (or redeeming a magic link)
// performs a real cross-document navigation into the separate app build.
const APP_URL = "/app.html";

function enterApp() {
  window.location.assign(APP_URL);
}

// ── Path-based routing ──
// Each marketing screen owns a real URL in both languages (English at the
// bare path, Hebrew under /he/*) so it can be opened, shared, and bookmarked
// directly, with browser back/forward driving the same state machine. `/`
// (and `/he`) stay the Secure Access (login) screen; unknown paths fall back
// to login. Route tables and parsing live in ./siteRoutes — this is pure
// in-app routing, Firebase Hosting already rewrites every path to
// /index.html, so deep links resolve to this build.

// Marketing content pages where the capabilities-brief popup may surface. The
// login / create / internal-downloads screens are deliberately excluded — we
// only nudge visitors who are actually browsing the marketing material.
const CONTENT_SCREENS: ReadonlySet<SiteScreen> = new Set([
  "security",
  "defense",
  "drone",
  "usecases",
  "capabilities",
  "team",
  "careers",
  "partners",
  "training",
]);

// localStorage flag written by the popup once a visitor submits their details.
// Captured visitors are never nagged again.
const LEAD_KEY = "ghost_capabilities_lead";

function leadAlreadyCaptured(): boolean {
  try {
    return !!window.localStorage.getItem(LEAD_KEY);
  } catch {
    return false;
  }
}

// Public marketing site (pre-login). Owns the marketing page state machine plus
// the login / create flows. It never renders the operational system; once the
// visitor authenticates we hand off to the separate app build at /app.html.
export default function SiteApp() {
  const [screen, setScreen] = useState<SiteScreen>(() =>
    typeof window === "undefined"
      ? "login"
      : parseSitePath(window.location.pathname).screen,
  );
  const locale = useSiteLocaleStore((s) => s.locale);
  const applyLocale = useSiteLocaleStore((s) => s.applyLocale);
  const [useCaseSectorId, setUseCaseSectorId] = useState<string | null>(null);
  const [showLeadPopup, setShowLeadPopup] = useState(false);
  // When set, the lead popup gates a specific document (e.g. the classified
  // LKM-Drone field report). When undefined, the popup uses its default brief.
  const [leadDoc, setLeadDoc] = useState<DownloadDoc | undefined>(undefined);

  const loginWithMagicToken = useUserStore((s) => s.loginWithMagicToken);
  const startTrialSession = useUserStore((s) => s.startTrialSession);
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const magicConsumedRef = useRef(false);

  // Begin the public 8-minute trial: open a brand-new clean account named
  // after the visitor (shared demo API key), stamp the session as a trial,
  // then hand off to the operational app where the guided first-setup wizard
  // walks them through area / group / conversation / camera. The lead gate in
  // TalkToGhostPage guarantees this only runs after details are left.
  const startTrial = useCallback(
    async (lead: { name: string; email: string; phone: string }) => {
      if (trialStarting) return;
      setTrialStarting(true);
      setTrialError(null);
      const user = await startTrialSession(lead);
      if (user) {
        enterApp();
        return;
      }
      setTrialStarting(false);
      setTrialError(
        useSiteLocaleStore.getState().locale === "he"
          ? "הגישה החיה אינה זמינה כרגע. נסו שוב."
          : "Live access is unavailable right now. Please try again.",
      );
    },
    [startTrialSession, trialStarting],
  );

  // Page-transition bookkeeping for the capabilities-brief popup. We count
  // real navigations (skipping the initial landing) and, on every second one,
  // randomly surface the brief — unless the visitor already gave us details.
  const navCountRef = useRef(0);
  const navInitRef = useRef(false);
  const leadCapturedRef = useRef(false);

  useDocumentChrome();

  useEffect(() => {
    leadCapturedRef.current = leadAlreadyCaptured();
  }, []);

  useEffect(() => {
    // The first effect run is the initial landing, not a transition.
    if (!navInitRef.current) {
      navInitRef.current = true;
      return;
    }
    if (leadCapturedRef.current || showLeadPopup) return;

    navCountRef.current += 1;
    const onContentPage = CONTENT_SCREENS.has(screen);
    // Every second counted transition, surfaced randomly so it feels organic.
    if (
      onContentPage &&
      navCountRef.current % 2 === 0 &&
      Math.random() < 0.7
    ) {
      setShowLeadPopup(true);
    }
  }, [screen, showLeadPopup]);

  const closeLeadPopup = useCallback(() => {
    setShowLeadPopup(false);
    setLeadDoc(undefined);
    // Re-read the flag so a submitted lead isn't shown the popup again.
    leadCapturedRef.current = leadAlreadyCaptured();
  }, []);

  // Explicitly open the gate for a specific document (download CTA), bypassing
  // the random-nag heuristics used for the marketing brief.
  const openLeadDoc = useCallback((doc: DownloadDoc) => {
    setLeadDoc(doc);
    setShowLeadPopup(true);
  }, []);

  // Single navigation entry point: flip the screen state and push a matching
  // history entry so the URL, browser back/forward, and bookmarks all track
  // the visible page. Skips the push when the URL already matches (e.g. an
  // initial deep link or a back/forward that set the state via popstate).
  const goTo = useCallback(
    (next: SiteScreen) => {
      setScreen(next);
      if (typeof window === "undefined") return;
      const path = buildSitePath(next, locale);
      if (window.location.pathname !== path) {
        window.history.pushState({}, "", path);
      }
    },
    [locale],
  );

  // Unified sidebar navigation shared by every marketing content page. The
  // shared `SiteSidebar` emits a destination page id; we map it to the screen
  // state (resetting the use-case sector filter when leaving for it fresh).
  const navigate = useCallback(
    (page: SitePage) => {
      if (page === "usecases") setUseCaseSectorId(null);
      goTo(page);
    },
    [goTo],
  );

  // Every content page's sidebar "Back" returns to the Secure Access screen.
  const goLogin = useCallback(() => goTo("login"), [goTo]);

  // Browser back/forward: re-derive both the screen and the locale from the
  // (already-updated) URL — crossing a language switch in history must flip
  // the whole chrome back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      const parsed = parseSitePath(window.location.pathname);
      setScreen(parsed.screen);
      applyLocale(parsed.locale);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyLocale]);

  // One-time landing normalization:
  // 1. A returning visitor who explicitly chose Hebrew and lands on the bare
  //    root is quietly moved to /he (replaceState — no history entry).
  //    Explicit deep links (e.g. /defense) are respected as-is.
  // 2. An unknown path (e.g. /foo) is normalized to the login URL so the
  //    address bar matches the rendered Secure Access screen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { pathname, search, hash } = window.location;
    const parsed = parseSitePath(pathname);
    if (search.includes("magic=")) return;
    if (pathname === "/" && readStoredSiteLocale() === "he") {
      window.history.replaceState({}, "", buildSitePath("login", "he") + hash);
      applyLocale("he");
      return;
    }
    if (!parsed.known) {
      window.history.replaceState(
        {},
        "",
        buildSitePath(parsed.screen, parsed.locale) + hash,
      );
    }
    // Run once on mount; subsequent navigation manages the URL via goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab title + hreflang/canonical/og:locale for the current page & language.
  useSiteSeo(screen, locale);

  useEffect(() => {
    // Quick-login link redemption. If the URL carries ``?magic=<token>`` we
    // exchange it once for a session and then hand off to the operational app.
    // The ref guards against React StrictMode's double-mount in dev, which
    // would otherwise burn the single-use token before the handoff.
    if (magicConsumedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("magic");
    if (!token) return;
    magicConsumedRef.current = true;

    loginWithMagicToken(token).then((user) => {
      if (user) {
        enterApp();
      } else {
        // Bad / expired token — strip it so a refresh doesn't retry.
        params.delete("magic");
        const cleaned =
          window.location.pathname +
          (params.toString() ? `?${params.toString()}` : "") +
          window.location.hash;
        window.history.replaceState({}, "", cleaned);
      }
    });
  }, [loginWithMagicToken]);

  const handleKeys = useCallback(
    (e: KeyboardEvent) => {
      if (screen !== "login") return;

      // NOTE: key events from form fields are intentionally NOT ignored — the
      // c+u / l+g chords must fire even while the Agent ID input is auto-focused
      // on load. Trade-off: typing "c" then "u" quickly inside a field also
      // navigates to "create".
      const key = e.key.toLowerCase();
      if (key === "g" && keysPressed.has("l")) {
        goTo("login");
        keysPressed.clear();
      } else if (key === "l" && keysPressed.has("g")) {
        goTo("login");
        keysPressed.clear();
      } else if (key === "u" && keysPressed.has("c")) {
        goTo("create");
        keysPressed.clear();
      } else if (key === "c" && keysPressed.has("u")) {
        goTo("create");
        keysPressed.clear();
      } else {
        keysPressed.add(key);
        setTimeout(() => keysPressed.delete(key), 1500);
      }
    },
    [screen, goTo],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [handleKeys]);

  let content: ReactNode;
  if (screen === "security") {
    content = (
      <SecurityArchitecturePage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
        onOpenDownloads={() => goTo("downloads")}
      />
    );
  } else if (screen === "defense") {
    content = (
      <DefenseIntelligencePage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
        onShowUseCases={(sectorId) => {
          setUseCaseSectorId(sectorId ?? null);
          goTo("usecases");
        }}
      />
    );
  } else if (screen === "drone") {
    content = (
      <DroneDetectionPage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
        onDownloadReport={() => openLeadDoc(LKM_DRONE_DOC)}
      />
    );
  } else if (screen === "usecases") {
    content = (
      <UseCasesPage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
        initialSectorId={useCaseSectorId}
      />
    );
  } else if (screen === "capabilities") {
    content = (
      <WhatGhostCanDoPage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
      />
    );
  } else if (screen === "team") {
    content = (
      <TeamPage onBack={goLogin} onAccess={goLogin} onNavigate={navigate} />
    );
  } else if (screen === "careers") {
    content = (
      <CareersPage onBack={goLogin} onAccess={goLogin} onNavigate={navigate} />
    );
  } else if (screen === "partners") {
    content = (
      <PartnersPage onBack={goLogin} onAccess={goLogin} onNavigate={navigate} />
    );
  } else if (screen === "training") {
    content = (
      <OperatorTrainingPage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
        onJoinWaitlist={() => openLeadDoc(TRAINING_SYLLABUS_DOC)}
      />
    );
  } else if (screen === "talk") {
    content = (
      <TalkToGhostPage
        onBack={goLogin}
        onAccess={goLogin}
        onNavigate={navigate}
        onStartTrial={startTrial}
        starting={trialStarting}
        error={trialError}
      />
    );
  } else if (screen === "downloads") {
    content = <DownloadsAdminPage onBack={() => goTo("security")} />;
  } else if (screen === "create") {
    content = (
      <CreateUserModal onSuccess={enterApp} onBack={() => goTo("login")} />
    );
  } else {
    content = (
      <LoginModal
        onSuccess={enterApp}
        onShowDefense={() => goTo("defense")}
        onShowSecurity={() => goTo("security")}
        onShowTeam={() => goTo("team")}
        onShowCapabilities={() => goTo("capabilities")}
        onShowDrone={() => goTo("drone")}
        onShowTalk={() => goTo("talk")}
      />
    );
  }

  return (
    <>
      {content}
      {showLeadPopup && (
        <LeadCapturePopup onClose={closeLeadPopup} doc={leadDoc} />
      )}
    </>
  );
}

const keysPressed = new Set<string>();
