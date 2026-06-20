import { FileText, Download } from "lucide-react";
import { useLanguageStore } from "../../stores/languageStore";
import { useT } from "../../utils/i18n";
import { OFFERABLE_DOCS } from "../../utils/docOfferMarker";

interface DocOfferCardProps {
  docIds: string[];
}

/**
 * Small in-chat card rendered beneath a Ghost answer when the reply was drawn
 * from one of Ghost's official source documents. Offers each matching document
 * for download. Brand line: monochrome surface, subtle border, mono kicker.
 */
export default function DocOfferCard({ docIds }: DocOfferCardProps) {
  const t = useT();
  const dir = useLanguageStore((s) => s.dir);
  const locale = useLanguageStore((s) => s.locale);

  const docs = docIds
    .map((id) => OFFERABLE_DOCS[id])
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  if (docs.length === 0) return null;

  return (
    <div
      className="mt-3 max-w-[420px] rounded-2xl border border-ghost-border-subtle bg-ghost-surface/40 overflow-hidden"
      dir={dir}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ghost-border-subtle/60">
        <FileText size={14} className="text-ghost-text-secondary flex-shrink-0" />
        <span className="text-[13px] font-semibold text-ghost-text-primary">
          {t("docOfferTitle")}
        </span>
        <span className="ms-auto font-mono text-[9px] tracking-[0.2em] uppercase text-ghost-text-muted flex-shrink-0">
          Ghost // Docs
        </span>
      </div>
      <p className="px-4 pt-3 text-[12.5px] text-ghost-text-secondary leading-relaxed">
        {t("docOfferHint")}
      </p>
      <div className="px-4 py-3 flex flex-col gap-2">
        {docs.map((doc) => (
          <a
            key={doc.id}
            href={doc.path}
            download
            className="group flex items-center gap-2.5 min-h-[40px] rounded-xl border border-ghost-border-subtle bg-ghost-bg/40 px-3 py-2 hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          >
            <FileText
              size={15}
              className="text-ghost-text-muted flex-shrink-0"
            />
            <span className="flex-1 min-w-0 truncate text-[13px] text-ghost-text-primary">
              {doc.title[locale]}
            </span>
            <span className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-ghost-text-secondary group-hover:text-ghost-text-primary">
              <Download size={13} />
              {t("docOfferDownload")}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
