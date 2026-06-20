import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Capability } from "../../data/capabilities";
import type { Locale } from "../../stores/languageStore";
import { Reveal, DemoFrame } from "./shared";

interface FeatureBlockProps {
  cap: Capability;
  locale: Locale;
  demoTag: string;
  learnMore: string;
  showLess: string;
  /** Flip text/demo order for visual rhythm down the page. */
  reversed?: boolean;
}

// One sub-capability inside a chapter: small title + one-liner + a monochrome
// "Learn more →" that reveals the ordered steps, paired with its live demo.
export default function FeatureBlock({
  cap,
  locale,
  demoTag,
  learnMore,
  showLess,
  reversed = false,
}: FeatureBlockProps) {
  const copy = cap.copy[locale];
  const [open, setOpen] = useState(false);

  return (
    <section id={cap.id} className="scroll-mt-24">
      <div className="grid lg:grid-cols-2 gap-x-12 gap-y-6 items-center">
        <Reveal
          delay={60}
          className={reversed ? "lg:order-2" : undefined}
        >
          <div>
            <h3 className="text-[18px] font-medium tracking-[-0.01em] text-ghost-text-primary">
              {copy.title}
            </h3>
            <p className="mt-3 text-[16px] leading-relaxed text-ghost-text-secondary">
              {copy.simple}
            </p>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="ghost-link-arrow mt-4 font-medium"
            >
              <span>{open ? showLess : learnMore}</span>
              <ArrowRight
                size={14}
                className={open ? "-rotate-90" : ""}
                aria-hidden="true"
              />
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <ol className="mt-5 space-y-3">
                  {copy.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-ghost-surface border border-ghost-border-subtle flex items-center justify-center text-[12px] font-semibold text-ghost-text-secondary tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-[15px] leading-relaxed text-ghost-text-secondary">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal
          delay={120}
          className={reversed ? "lg:order-1" : undefined}
        >
          <DemoFrame demo={cap.demo} tag={demoTag} />
        </Reveal>
      </div>
    </section>
  );
}
