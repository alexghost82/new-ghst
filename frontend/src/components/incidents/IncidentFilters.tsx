import { Search, X } from "lucide-react";
import { useIncidentStore } from "../../stores/incidentStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import type { IncidentSeverity } from "../../types/api";

const SEVERITY_OPTIONS: { value: IncidentSeverity; key: string }[] = [
  { value: "critical", key: "severityCritical" },
  { value: "high", key: "severityHigh" },
  { value: "medium", key: "severityMedium" },
  { value: "low", key: "severityLow" },
];

const SELECT_BASE_CLASS =
  "appearance-none bg-ghost-surface/70 border border-ghost-border-subtle hover:border-ghost-text-muted/50 rounded-xl ps-3 pe-9 py-2.5 min-h-[var(--incident-touch-min,44px)] text-[14px] leading-snug text-ghost-text-primary focus:outline-none focus:border-ghost-text-secondary focus:bg-ghost-surface focus-visible:ring-2 focus-visible:ring-ghost-text-primary/25 transition-colors";

export default function IncidentFilters() {
  const t = useT();
  const users = useUserStore((s) => s.users);
  const filters = useIncidentStore((s) => s.filters);
  const setFilters = useIncidentStore((s) => s.setFilters);

  const hasFilters =
    !!filters.search || !!filters.severity || !!filters.assignedTo;

  const selectStyle = {
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23999999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
    backgroundRepeat: "no-repeat" as const,
    backgroundPosition: "right 12px center",
    backgroundSize: "12px",
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <Search
          size={16}
          className="absolute top-1/2 -translate-y-1/2 start-3 text-ghost-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder={t("incidentSearchPlaceholder")}
          className="ps-10 pe-4 py-2.5 min-h-[var(--incident-touch-min,44px)] rounded-xl bg-ghost-surface/70 border border-ghost-border-subtle hover:border-ghost-text-muted/50 text-[14px] leading-snug text-ghost-text-primary placeholder:text-ghost-text-muted/80 focus:outline-none focus:border-ghost-text-secondary focus:bg-ghost-surface focus-visible:ring-2 focus-visible:ring-ghost-text-primary/25 w-64 sm:w-72 transition-colors"
        />
      </div>

      <select
        value={filters.severity ?? ""}
        onChange={(e) =>
          setFilters({
            severity: (e.target.value || undefined) as
              | IncidentSeverity
              | undefined,
          })
        }
        className={SELECT_BASE_CLASS}
        style={selectStyle}
      >
        <option value="">
          {t("incidentFilterSeverity")} · {t("incidentFilterAll")}
        </option>
        {SEVERITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.key as Parameters<typeof t>[0])}
          </option>
        ))}
      </select>

      <select
        value={filters.assignedTo ?? ""}
        onChange={(e) =>
          setFilters({ assignedTo: e.target.value || undefined })
        }
        className={SELECT_BASE_CLASS}
        style={selectStyle}
      >
        <option value="">
          {t("incidentFilterAssignee")} · {t("incidentFilterAll")}
        </option>
        <option value="__unassigned__">{t("incidentFilterUnassigned")}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nickname}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() =>
            setFilters({
              search: "",
              severity: undefined,
              assignedTo: undefined,
            })
          }
          className="inline-flex items-center justify-center min-w-[var(--incident-touch-min,44px)] min-h-[var(--incident-touch-min,44px)] rounded-xl text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ghost-text-primary/25 transition-colors"
          aria-label={t("incidentFilterAll")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
