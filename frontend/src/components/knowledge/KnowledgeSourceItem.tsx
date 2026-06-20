import { FileText, Trash2, Pencil } from "lucide-react";
import type { KnowledgeSource } from "../../types/api";

interface KnowledgeSourceItemProps {
  source: KnowledgeSource;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function parseTags(tags: string[] | string | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function KnowledgeSourceItem({
  source,
  onToggle,
  onDelete,
  onEdit,
}: KnowledgeSourceItemProps) {
  const tagList = parseTags(source.tags);

  return (
    <div className="group bg-ghost-surface rounded-lg p-3 border border-ghost-border-subtle hover:border-ghost-surface-hover transition-colors duration-[100ms]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-ghost-bg flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileText size={14} className="text-ghost-text-muted" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-ghost-text-primary truncate">
              {source.filename || "קטע טקסט"}
            </p>
            <p className="text-xs text-ghost-text-muted mt-0.5">
              {source.chunk_count} חלקים
              {" / "}
              {new Date(source.created_at).toLocaleDateString("he-IL", {
                month: "short",
                day: "numeric",
              })}
            </p>
            {tagList.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded bg-ghost-bg text-ghost-text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggle}
            className={`
              relative w-9 h-5 rounded-full transition-colors duration-[160ms]
              ${source.is_active ? "bg-ghost-accent" : "bg-ghost-surface-hover"}
            `}
            dir="ltr"
            aria-label={source.is_active ? "Deactivate" : "Activate"}
          >
            <span
              className={`
                absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm
                transition-transform duration-[160ms]
                ${source.is_active ? "translate-x-[18px]" : "translate-x-0.5"}
              `}
            />
          </button>
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-ghost-text-muted hover:text-ghost-accent transition-all duration-[100ms]"
            aria-label="Edit source"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-ghost-text-muted hover:text-ghost-error transition-all duration-[100ms]"
            aria-label="Delete source"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
