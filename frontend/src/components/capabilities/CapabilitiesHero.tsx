import { ArrowRight, FileDown } from "lucide-react";
import type { PageChrome } from "../../data/capabilities";
import { Reveal, DemoFrame } from "./shared";

interface CapabilitiesHeroProps {
  chrome: PageChrome;
  onDownload: () => void;
  onAccess: () => void;
}

// Cinematic hero: large display title + dual CTA, over an overlapping live-demo
// composition floating above the ambient grid. Collapses to a single frame on
// small screens.
export default function CapabilitiesHero({
  chrome,
  onDownload,
  onAccess,
}: CapabilitiesHeroProps) {
  return (
    <header className="relative overflow-hidden">
      <div className="ghost-ambient ghost-ambient--page" aria-hidden="true">
        <div className="ghost-ambient__grid" />
        <div className="ghost-ambient__blob ghost-ambient__blob--1" />
        <div className="ghost-ambient__blob ghost-ambient__blob--2" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-20">
        <div className="max-w-3xl">
          <Reveal>
            <div className="mb-6 inline-flex max-w-full flex-wrap items-center gap-2 min-h-7 py-1 ps-2.5 pe-3 rounded-full border border-ghost-border-subtle bg-ghost-surface/40">
              <span className="ghost-alert-dot" />
              <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.16em] sm:tracking-[0.22em] uppercase text-ghost-text-muted">
                {chrome.heroKicker}
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="ghost-display text-[clamp(2.5rem,6vw,4.5rem)] text-ghost-text-primary">
              {chrome.heroTitle}
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 text-[17px] leading-relaxed text-ghost-text-secondary max-w-2xl">
              {chrome.heroSubtitle}
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={onDownload}
                className="group inline-flex items-center gap-2 h-11 ps-5 pe-5 rounded-full bg-ghost-accent text-ghost-bg text-[14px] font-semibold outline-none transition-all duration-200 hover:bg-ghost-accent-hover active:scale-[0.98]"
              >
                <FileDown size={15} />
                <span>{chrome.downloadGuide}</span>
              </button>
              <button
                onClick={onAccess}
                className="ghost-glass group inline-flex items-center gap-2 h-11 ps-5 pe-4 rounded-full text-[14px] font-semibold text-ghost-text-primary"
              >
                <span>{chrome.requestAccess}</span>
                <ArrowRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180"
                />
              </button>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-5 font-mono text-[12px] tracking-wide text-ghost-text-muted">
              {chrome.heroNote}
            </p>
          </Reveal>
        </div>

        {/* Overlapping live-demo composition */}
        <Reveal delay={220} className="mt-12 sm:mt-16">
          <div className="relative">
            <DemoFrame
              demo="chat"
              tag={chrome.demoTag}
              className="ghost-glass relative z-10 max-w-3xl"
            />
            {/* Floating secondary frame — desktop only, collapses out below lg */}
            <div className="hidden lg:block absolute -bottom-10 end-0 w-[340px] z-20">
              <DemoFrame
                demo="cameras"
                tag={chrome.demoTag}
                className="ghost-glass shadow-xl"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </header>
  );
}
