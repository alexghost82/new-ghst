import type { CapabilityChapter, Capability } from "../../data/capabilities";
import type { Locale } from "../../stores/languageStore";
import { Reveal } from "./shared";
import FeatureBlock from "./FeatureBlock";

interface ChapterSectionProps {
  chapter: CapabilityChapter;
  capabilities: Capability[];
  locale: Locale;
  demoTag: string;
  learnMore: string;
  showLess: string;
}

// A thematic chapter: large display heading + intro, then its feature blocks.
export default function ChapterSection({
  chapter,
  capabilities,
  locale,
  demoTag,
  learnMore,
  showLess,
}: ChapterSectionProps) {
  const copy = chapter.copy[locale];
  const caps = chapter.capabilityIds
    .map((id) => capabilities.find((c) => c.id === id))
    .filter((c): c is Capability => Boolean(c));

  return (
    <section id={chapter.id} className="scroll-mt-24">
      <Reveal>
        <div className="max-w-2xl">
          <div className="font-mono text-[11px] tracking-[0.24em] uppercase text-ghost-text-muted">
            {copy.kicker}
          </div>
          <h2 className="ghost-display mt-4 text-[clamp(1.75rem,3.4vw,2.5rem)] text-ghost-text-primary">
            {copy.title}
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ghost-text-secondary">
            {copy.intro}
          </p>
        </div>
      </Reveal>

      <div className="mt-12 space-y-16">
        {caps.map((cap, i) => (
          <FeatureBlock
            key={cap.id}
            cap={cap}
            locale={locale}
            demoTag={demoTag}
            learnMore={learnMore}
            showLess={showLess}
            reversed={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}
