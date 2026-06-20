import { useEffect, useRef, useState } from "react";
import LeadCapturePopup, { FIELD_GUIDE_DOC } from "./LeadCapturePopup";
import { useThemeStore } from "../../stores/themeStore";
import { useSiteSidebarStore } from "../../stores/siteSidebarStore";
import { useSiteLocaleStore } from "../../stores/siteLocaleStore";
import {
  CAPABILITIES,
  CHAPTERS,
  OPERATOR_QUOTES,
  HIGHLIGHTS,
  CHANGELOG_ITEMS,
  PAGE_CHROME,
} from "../../data/capabilities";
import SiteSidebar, { type SitePage } from "./SiteSidebar";
import CapabilitiesHero from "../capabilities/CapabilitiesHero";
import ChapterSection from "../capabilities/ChapterSection";
import TrustedByStrip from "../capabilities/TrustedByStrip";
import HighlightsGrid from "../capabilities/HighlightsGrid";
import ChangelogStrip from "../capabilities/ChangelogStrip";
import FinalCta from "../capabilities/FinalCta";

interface WhatGhostCanDoPageProps {
  onBack: () => void;
  onAccess: () => void;
  // Shared marketing-site navigation (drives the persistent sidebar).
  onNavigate: (page: SitePage) => void;
}

export default function WhatGhostCanDoPage({
  onBack,
  onAccess,
  onNavigate,
}: WhatGhostCanDoPageProps) {
  const theme = useThemeStore((s) => s.theme);
  const siteNavCollapsed = useSiteSidebarStore((s) => s.collapsed);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDownload, setShowDownload] = useState(false);

  // Bilingual page: the copy in data/capabilities.ts carries both locales;
  // direction and language follow the URL-derived site locale. The embedded
  // demos read the shared language store, which siteLocaleStore keeps in sync.
  const locale = useSiteLocaleStore((s) => s.locale);
  const dir = useSiteLocaleStore((s) => s.dir);
  const chrome = PAGE_CHROME[locale];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={scrollRef}
      className={`fixed inset-0 bg-ghost-bg overflow-y-auto overflow-x-clip cursor-default ${
        siteNavCollapsed ? "" : "lg:ps-[260px]"
      }`}
      dir={dir}
      style={theme === "dark" ? { backgroundColor: "#0a0a0a" } : undefined}
    >
      {/* ── Shared marketing-site navigation ── */}
      <SiteSidebar
        active="capabilities"
        onNavigate={onNavigate}
        onScrollTop={() =>
          scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        onBack={onBack}
        onAccess={onAccess}
        locale={locale}
        dir={dir}
      />

      {/* ── Hero ── */}
      <CapabilitiesHero
        chrome={chrome}
        onDownload={() => setShowDownload(true)}
        onAccess={onAccess}
      />

      {/* ── Chapters (the nine capabilities, grouped) ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-24">
        <div className="space-y-28">
          {CHAPTERS.map((chapter) => (
            <ChapterSection
              key={chapter.id}
              chapter={chapter}
              capabilities={CAPABILITIES}
              locale={locale}
              demoTag={chrome.demoTag}
              learnMore={chrome.learnMore}
              showLess={chrome.showLess}
            />
          ))}
        </div>
      </main>

      {/* ── Recent highlights ── */}
      <HighlightsGrid
        highlights={HIGHLIGHTS}
        heading={chrome.highlights}
        locale={locale}
        onJump={jumpTo}
      />

      {/* ── From the field ── */}
      <TrustedByStrip
        quotes={OPERATOR_QUOTES}
        heading={chrome.trustedBy}
        locale={locale}
      />

      {/* ── Changelog ── */}
      <ChangelogStrip
        items={CHANGELOG_ITEMS}
        heading={chrome.changelog}
        locale={locale}
      />

      {/* ── Final CTA ── */}
      <FinalCta
        chrome={chrome}
        onDownload={() => setShowDownload(true)}
        onAccess={onAccess}
      />

      {/* Field-guide download gate (full name + email or phone) */}
      {showDownload && (
        <LeadCapturePopup
          doc={FIELD_GUIDE_DOC}
          onClose={() => setShowDownload(false)}
        />
      )}
    </div>
  );
}
