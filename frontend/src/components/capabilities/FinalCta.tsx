import { ArrowRight, FileDown } from "lucide-react";
import type { PageChrome } from "../../data/capabilities";
import { Reveal } from "./shared";

interface FinalCtaProps {
  chrome: PageChrome;
  onDownload: () => void;
  onAccess: () => void;
}

// Large closing call-to-action — the "Try Ghost now." moment.
export default function FinalCta({ chrome, onDownload, onAccess }: FinalCtaProps) {
  return (
    <footer className="border-t border-ghost-border-subtle/70">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
        <Reveal>
          <div className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
            {chrome.finalCta.kicker}
          </div>
          <h2 className="ghost-display mt-5 text-[clamp(2.25rem,5vw,3.75rem)] text-ghost-text-primary">
            {chrome.finalCta.title}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-ghost-text-secondary max-w-xl mx-auto">
            {chrome.finalCta.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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

          <p className="mt-4 text-[12px] text-ghost-text-muted">
            {chrome.finalCta.note}
          </p>
        </Reveal>
      </div>
    </footer>
  );
}
