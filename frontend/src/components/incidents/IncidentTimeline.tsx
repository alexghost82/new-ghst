import {
  ArrowRight,
  CircleAlert,
  FileText,
  Layers,
  Paperclip,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import type { IncidentActivity } from "../../types/api";
import { useUserStore } from "../../stores/userStore";
import { useT, type TranslationKey } from "../../utils/i18n";
import { sanitizeBrand } from "../../utils/sanitize";
import { formatLocalTime } from "./incidentTime";

interface IncidentTimelineProps {
  items: IncidentActivity[];
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  created: CircleAlert,
  status_changed: ArrowRight,
  assigned: User,
  note: FileText,
  evidence_added: Paperclip,
  ai_summary: Sparkles,
  merge: Layers,
  investigation_started: Search,
};

const LABEL_KEY: Record<string, TranslationKey> = {
  created: "activityCreated",
  status_changed: "activityStatusChanged",
  assigned: "activityAssigned",
  note: "activityNote",
  evidence_added: "activityEvidenceAdded",
  ai_summary: "activityAiSummary",
  merge: "activityMerge",
  investigation_started: "activityInvestigationStarted",
};

export default function IncidentTimeline({ items }: IncidentTimelineProps) {
  const t = useT();
  const users = useUserStore((s) => s.users);

  if (items.length === 0) {
    return (
      <p className="text-small text-ghost-text-muted text-center py-8 opacity-70">
        {t("noTimelineYet")}
      </p>
    );
  }

  return (
    <ol className="relative ps-4">
      <span
        className="absolute top-1 bottom-1 start-1.5 w-px bg-ghost-border-subtle"
        aria-hidden="true"
      />
      {items.map((item) => {
        const Icon = ICON_MAP[item.type] ?? CircleAlert;
        const labelKey = LABEL_KEY[item.type];
        const label = labelKey ? t(labelKey) : item.type;
        const actor =
          item.actor === "system"
            ? "Ghost"
            : users.find((u) => u.id === item.actor)?.nickname || item.actor;
        const content = sanitizeBrand(item.content || "");

        return (
          <li key={item.id} className="relative mb-3 pb-1">
            <span className="absolute -start-1 top-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-ghost-bg-secondary border border-ghost-border-subtle">
              <Icon size={9} className="text-ghost-text-muted" />
            </span>
            <div className="ps-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-small text-ghost-text-primary font-medium">
                  {label}
                </p>
                <span className="text-xs text-ghost-text-muted tabular-nums flex-shrink-0">
                  {formatLocalTime(item.created_at)}
                </span>
              </div>
              {content && (
                <p className="text-xs text-ghost-text-secondary mt-0.5 leading-relaxed break-words">
                  {content}
                </p>
              )}
              {actor && actor !== "Ghost" && (
                <p className="text-[11px] text-ghost-text-muted mt-0.5">
                  {actor}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
