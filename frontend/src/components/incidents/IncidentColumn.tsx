import { useMemo, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useIncidentStore } from "../../stores/incidentStore";
import type { IncidentStatus } from "../../types/api";
import { useT, type TranslationKey } from "../../utils/i18n";
import IncidentCard from "./IncidentCard";

interface IncidentColumnProps {
  status: IncidentStatus;
}

// Monochrome status ladder — brightness tiers on the Ghost neutral palette
// so columns stay distinguishable without bronze / olive / alarm colors.
function neutralAccent(opacity: number): string {
  return `linear-gradient(90deg, transparent, rgb(var(--ghost-text-primary) / ${opacity}) 30%, rgb(var(--ghost-text-primary) / ${opacity}) 70%, transparent)`;
}

const COLUMN_META: Record<
  IncidentStatus,
  {
    labelKey: TranslationKey;
    accentBg: string;
    dotClass: string;
    captionClass: string;
  }
> = {
  new: {
    labelKey: "incidentColumnNew",
    accentBg: neutralAccent(0.92),
    dotClass: "bg-ghost-text-primary",
    captionClass: "text-ghost-text-primary",
  },
  handling: {
    labelKey: "incidentColumnHandling",
    accentBg: neutralAccent(0.72),
    dotClass: "bg-ghost-text-primary/75",
    captionClass: "text-ghost-text-primary/90",
  },
  investigation: {
    labelKey: "incidentColumnInvestigation",
    accentBg: neutralAccent(0.52),
    dotClass: "bg-ghost-text-secondary",
    captionClass: "text-ghost-text-secondary",
  },
  closed: {
    labelKey: "incidentColumnClosed",
    accentBg: neutralAccent(0.32),
    dotClass: "bg-ghost-text-muted",
    captionClass: "text-ghost-text-muted",
  },
};

/** Initial row height guess before measureElement runs (image + body). */
const CARD_HEIGHT_ESTIMATE = 300;
const CARD_GAP = 12;

/**
 * Single Kanban column. Renders a virtualised list using
 * ``@tanstack/react-virtual`` so the board stays smooth even with
 * thousands of cards. Also doubles as a drop target so cards dragged
 * over an empty column still register a status change.
 */
export default function IncidentColumn({ status }: IncidentColumnProps) {
  const t = useT();
  const meta = COLUMN_META[status];
  const incidents = useIncidentStore((s) => s.incidents);
  const columnOrder = useIncidentStore((s) => s.columnOrder);
  const filters = useIncidentStore((s) => s.filters);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { status, type: "column" },
  });

  const ids = useMemo(() => {
    const base = columnOrder[status] ?? [];
    const search = filters.search.trim().toLowerCase();
    const filtered = base.filter((id) => {
      const inc = incidents[id];
      if (!inc) return false;
      if (filters.severity && inc.severity !== filters.severity) return false;
      if (filters.assignedTo) {
        if (filters.assignedTo === "__unassigned__") {
          if (inc.assigned_to) return false;
        } else if (inc.assigned_to !== filters.assignedTo) {
          return false;
        }
      }
      if (search) {
        const haystack = (
          (inc.title || "") +
          " " +
          (inc.summary || "") +
          " " +
          (inc.source_camera_label || "") +
          " " +
          (inc.ai_reasoning || "") +
          " " +
          (inc.tags || []).join(" ")
        ).toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    return filtered;
  }, [columnOrder, incidents, filters, status]);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => ids[index],
    estimateSize: () => CARD_HEIGHT_ESTIMATE + CARD_GAP,
    overscan: 6,
  });

  return (
    <div
      ref={setNodeRef}
      data-status={status}
      data-over={isOver ? "true" : "false"}
      className="ghost-incident-column flex flex-col h-full min-h-0 rounded-2xl border border-ghost-border-subtle overflow-hidden transition-shadow"
    >
      <header className="flex items-center justify-between gap-2 px-4 h-12 border-b border-ghost-border-subtle/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`}
            aria-hidden="true"
          />
          <h3
            className={`font-mono text-[11px] tracking-[0.18em] uppercase truncate ${meta.captionClass}`}
          >
            {t(meta.labelKey)}
          </h3>
        </div>
        <span className="shrink-0 inline-flex items-center h-6 px-2.5 rounded-full bg-ghost-surface border border-ghost-border-subtle font-mono text-[10px] tabular-nums text-ghost-text-muted">
          {String(ids.length).padStart(2, "0")}
        </span>
      </header>

      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 overflow-y-auto px-3.5 py-3.5 transition-colors ${
          isOver ? "bg-ghost-text-primary/[0.04]" : ""
        }`}
      >
        {ids.length === 0 ? (
          <div className="h-full flex items-center justify-center py-12">
            <p className="text-[13px] text-ghost-text-muted/70">
              {t("noIncidents")}
            </p>
          </div>
        ) : (
          <SortableContext
            items={ids}
            strategy={verticalListSortingStrategy}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const id = ids[virtualRow.index];
                const inc = incidents[id];
                if (!inc) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      insetInlineStart: 0,
                      insetInlineEnd: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: CARD_GAP,
                    }}
                  >
                    <IncidentCard incident={inc} />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
