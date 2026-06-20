import type { Highlight, SectionHeading } from "../../data/capabilities";
import type { Locale } from "../../stores/languageStore";
import { Reveal } from "./shared";

interface HighlightsGridProps {
  highlights: Highlight[];
  heading: SectionHeading;
  locale: Locale;
  /** Jump to a capability/chapter anchor when a card is clicked. */
  onJump?: (id: string) => void;
}

export default function HighlightsGrid({
  highlights,
  heading,
  locale,
  onJump,
}: HighlightsGridProps) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
      <Reveal>
        <div className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
          {heading.kicker}
        </div>
        <h2 className="ghost-display mt-4 text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary max-w-2xl">
          {heading.title}
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {highlights.map((h, i) => {
          const c = h.copy[locale];
          const clickable = Boolean(h.capabilityId && onJump);
          const Tag = clickable ? "button" : "div";
          return (
            <Reveal key={i} delay={i * 80}>
              <Tag
                {...(clickable
                  ? {
                      type: "button" as const,
                      onClick: () => onJump?.(h.capabilityId as string),
                    }
                  : {})}
                className={`group h-full w-full text-start flex flex-col rounded-2xl border border-ghost-border-subtle bg-ghost-surface/20 p-6 transition-all duration-200 ${
                  clickable
                    ? "hover:bg-ghost-surface/40 hover:border-ghost-border active:scale-[0.99] cursor-pointer"
                    : ""
                }`}
              >
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ghost-text-muted">
                  {c.tag}
                </span>
                <h3 className="mt-3 text-[18px] font-medium tracking-[-0.01em] text-ghost-text-primary">
                  {c.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ghost-text-secondary">
                  {c.body}
                </p>
              </Tag>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
