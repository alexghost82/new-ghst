import { Quote } from "lucide-react";
import type { OperatorQuote, SectionHeading } from "../../data/capabilities";
import type { Locale } from "../../stores/languageStore";
import { Reveal } from "./shared";

interface TrustedByStripProps {
  quotes: OperatorQuote[];
  heading: SectionHeading;
  locale: Locale;
}

export default function TrustedByStrip({
  quotes,
  heading,
  locale,
}: TrustedByStripProps) {
  return (
    <section className="relative overflow-hidden bg-ghost-bg-secondary border-y border-ghost-border-subtle/70">
      {/* Ambient wash — the only "color" on the surface, kept muted */}
      <div className="ghost-ambient" aria-hidden>
        <div
          className="ghost-ambient__blob ghost-ambient__blob--1"
          style={{
            top: -180,
            insetInlineStart: "-8%",
            width: 460,
            height: 460,
            background:
              "radial-gradient(circle, rgb(96 116 132 / 0.55), transparent 70%)",
          }}
        />
        <div
          className="ghost-ambient__blob ghost-ambient__blob--3"
          style={{
            bottom: -200,
            insetInlineEnd: "-7%",
            width: 480,
            height: 480,
            background:
              "radial-gradient(circle, rgb(104 116 78 / 0.45), transparent 72%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
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

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {quotes.map((q, i) => {
            const c = q.copy[locale];
            return (
              <Reveal key={i} delay={i * 80} className="h-full">
                <figure className="group h-full flex flex-col rounded-2xl border border-ghost-border-subtle/70 bg-ghost-surface/20 p-6 transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-ghost-surface/40 hover:border-ghost-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-ghost-text-muted">
                      Field log · {String(i + 1).padStart(2, "0")}
                    </span>
                    <Quote
                      size={14}
                      aria-hidden
                      className="text-ghost-text-muted/50 transition-colors duration-200 group-hover:text-ghost-text-muted"
                    />
                  </div>
                  <blockquote className="mt-4 mb-6 text-[16px] leading-relaxed text-ghost-text-secondary transition-colors duration-200 group-hover:text-ghost-text-primary">
                    {c.quote}
                  </blockquote>
                  <figcaption className="mt-auto pt-4 border-t border-ghost-border-subtle/70">
                    <div className="text-[14px] font-medium text-ghost-text-primary">
                      {c.name}
                    </div>
                    <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ghost-text-muted mt-1">
                      {c.role}
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
