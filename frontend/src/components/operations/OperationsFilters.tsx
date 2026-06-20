import { useMemo } from "react";
import { Search } from "lucide-react";
import { useConversationStore } from "../../stores/conversationStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { assignmentFor } from "../../utils/conversationGroups";
import { useT, type TranslationKey } from "../../utils/i18n";

export interface OperationsFilterState {
  search: string;
  type: "all" | "task" | "alert";
  status: "all" | "active" | "paused";
  areaId: string;
  groupId: string;
  conversationId: string;
}

export const EMPTY_OPERATIONS_FILTER: OperationsFilterState = {
  search: "",
  type: "all",
  status: "all",
  areaId: "all",
  groupId: "all",
  conversationId: "all",
};

interface OperationsFiltersProps {
  value: OperationsFilterState;
  onChange: (patch: Partial<OperationsFilterState>) => void;
}

function ChipGroup<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: Array<{ value: T; labelKey: TranslationKey }>;
  value: T;
  onSelect: (v: T) => void;
}) {
  const t = useT();
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full bg-ghost-surface/50 border border-ghost-border-subtle">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-[120ms] ${
            value === opt.value
              ? "bg-ghost-accent text-ghost-bg"
              : "text-ghost-text-secondary hover:text-ghost-text-primary"
          }`}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}

export default function OperationsFilters({
  value,
  onChange,
}: OperationsFiltersProps) {
  const t = useT();
  const conversations = useConversationStore((s) => s.conversations);
  const areas = useConversationGroupsStore((s) => s.areas);
  const groups = useConversationGroupsStore((s) => s.groups);

  const groupOptions = useMemo(
    () =>
      value.areaId === "all"
        ? groups
        : groups.filter((g) => g.area_id === value.areaId),
    [groups, value.areaId],
  );

  const conversationOptions = useMemo(() => {
    const groupsState = { areas, groups };
    return conversations.filter((c) => {
      if (value.areaId === "all" && value.groupId === "all") return true;
      const a = assignmentFor(c.id, groupsState);
      if (value.groupId !== "all") return a.groupId === value.groupId;
      if (value.areaId !== "all") return a.areaId === value.areaId;
      return true;
    });
  }, [conversations, areas, groups, value.areaId, value.groupId]);

  const selectClass =
    "min-h-[40px] bg-ghost-surface/50 border border-ghost-border-subtle rounded-xl px-3 py-2 text-[13px] text-ghost-text-primary focus:outline-none focus:border-ghost-accent transition-colors duration-[120ms] max-w-[180px]";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Search */}
      <div className="relative">
        <Search
          size={15}
          className="absolute top-1/2 -translate-y-1/2 start-3 text-ghost-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder={t("opSearchPlaceholder")}
          className="min-h-[40px] w-[200px] bg-ghost-surface/50 border border-ghost-border-subtle rounded-xl ps-9 pe-3 py-2 text-[13px] text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[120ms]"
        />
      </div>

      {/* Type chips */}
      <ChipGroup
        value={value.type}
        onSelect={(v) => onChange({ type: v })}
        options={[
          { value: "all", labelKey: "opFilterAll" },
          { value: "task", labelKey: "opTypeTask" },
          { value: "alert", labelKey: "opTypeAlert" },
        ]}
      />

      {/* Status chips */}
      <ChipGroup
        value={value.status}
        onSelect={(v) => onChange({ status: v })}
        options={[
          { value: "all", labelKey: "opFilterAll" },
          { value: "active", labelKey: "opActive" },
          { value: "paused", labelKey: "opPaused" },
        ]}
      />

      {/* Area */}
      <select
        value={value.areaId}
        onChange={(e) =>
          onChange({
            areaId: e.target.value,
            groupId: "all",
            conversationId: "all",
          })
        }
        className={selectClass}
        aria-label={t("opFilterArea")}
      >
        <option value="all">{t("opFilterArea")}</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      {/* Group */}
      <select
        value={value.groupId}
        onChange={(e) =>
          onChange({ groupId: e.target.value, conversationId: "all" })
        }
        className={selectClass}
        aria-label={t("opFilterGroup")}
      >
        <option value="all">{t("opFilterGroup")}</option>
        {groupOptions.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {/* Conversation */}
      <select
        value={value.conversationId}
        onChange={(e) => onChange({ conversationId: e.target.value })}
        className={selectClass}
        aria-label={t("opFilterConversation")}
      >
        <option value="all">{t("opFilterConversation")}</option>
        {conversationOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
