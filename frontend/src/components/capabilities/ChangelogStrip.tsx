import type { ChangelogItem, SectionHeading } from "../../data/capabilities";
import type { Locale } from "../../stores/languageStore";
import { Reveal } from "./shared";

interface ChangelogStripProps {
  items: ChangelogItem[];
  heading: SectionHeading;
  locale: Locale;
}

export default function ChangelogStrip({
  items,
  heading,
  locale,
}: ChangelogStripProps) {
  return (
    <section className="bg-ghost-bg-secondary border-y border-ghost-border-subtle/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
              {heading.kicker}
            </span>
            <span className="flex-1 h-px bg-ghost-border-subtle" aria-hidden />
          </div>
          <h2 className="ghost-display mt-4 text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary max-w-2xl">
            {heading.title}
          </h2>
        </Reveal>

        {/* Timeline — quiet vertical rail, node per release */}
        <ol className="mt-12 ms-1.5 border-s border-ghost-border-subtle/70">
          {items.map((item, i) => {
            const c = item.copy[locale];
            return (
              <li key={i} className="group relative ps-8 pb-10 last:pb-0">
                <span
                  aria-hidden
                  className="absolute -start-[5px] top-[5px] w-[9px] h-[9px] rounded-full border border-ghost-border-subtle bg-ghost-bg-secondary transition-colors duration-200 group-hover:bg-ghost-text-primary group-hover:border-ghost-text-primary"
                />
                <Reveal delay={i * 70}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-ghost-text-muted tabular-nums">
                      {item.date}
                    </span>
                    {i === 0 && (
                      <span className="inline-flex items-center h-[18px] px-2 rounded-full border border-ghost-border-subtle bg-ghost-surface/30 font-mono text-[9px] tracking-[0.16em] uppercase text-ghost-text-muted">
                        Latest
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-[16px] font-medium text-ghost-text-primary">
                    {c.title}
                  </h3>
                  <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ghost-text-secondary">
                    {c.note}
                  </p>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
