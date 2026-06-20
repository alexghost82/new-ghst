import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Camera,
  CircleCheck,
  Sparkles,
  Tag,
  UserCircle2,
} from "lucide-react";
import type { IncidentEvent } from "../../types/api";
import { useUserStore } from "../../stores/userStore";
import { useIncidentStore } from "../../stores/incidentStore";
import { useT } from "../../utils/i18n";
import { sanitizeBrand } from "../../utils/sanitize";
import SeverityBadge from "./SeverityBadge";
import { formatLocalTime, relativeDuration } from "./incidentTime";

interface IncidentCardProps {
  incident: IncidentEvent;
  draggingOverlay?: boolean;
}

/**
 * Single Kanban card. The drag handle covers the entire card surface
 * so the operator can grab anywhere; the click-to-open handler bails
 * out when ``isDragging`` is true to prevent accidental opens.
 */
export default function IncidentCard({
  incident,
  draggingOverlay = false,
}: IncidentCardProps) {
  const t = useT();
  const users = useUserStore((s) => s.users);
  const openWorkspace = useIncidentStore((s) => s.openWorkspace);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: incident.id,
    data: { status: incident.status, type: "incident" },
    disabled: draggingOverlay,
  });

  const style = draggingOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      };

  const assignee = incident.assigned_to
    ? users.find((u) => u.id === incident.assigned_to)
    : undefined;

  const rel = relativeDuration(incident.created_at);
  const time = formatLocalTime(incident.created_at);
  const isCritical = incident.severity === "critical";
  const isNew = incident.status === "new";
  const isClosed = incident.status === "closed";

  // Closed cards lead with the operator's written closure summary
  // (persisted on the incident's ``summary`` field by ``confirmClose``).
  // Active cards keep the initial AI reasoning visible. Both are
  // sanitized to strip any AI-provider branding.
  const closureSummary = sanitizeBrand(incident.summary || "");
  const reasoning = sanitizeBrand(incident.ai_reasoning || "");
  const bodyText = isClosed && closureSummary ? closureSummary : reasoning;

  const handleClick = () => {
    if (isDragging) return;
    openWorkspace(incident.id);
  };

  const relativeText =
    rel.key === "sNow"
      ? t("sNow")
      : t(rel.key).replace("{n}", String(rel.value));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={handleClick}
      className={`ghost-incident-card group bg-ghost-surface rounded-xl border ${
        isCritical
          ? "ghost-incident-card-critical"
          : "border-ghost-border-subtle"
      } px-4 py-3.5 cursor-grab active:cursor-grabbing select-none`}
    >
      <div className="flex items-start gap-2.5 mb-3">
        <SeverityBadge severity={incident.severity} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-ghost-text-primary truncate leading-snug">
            {incident.title}
          </p>
          <p className="ghost-incident-meta mt-1 text-[12px] text-ghost-text-secondary truncate">
            <span>{time}</span>
            {incident.source_camera_label && (
              <>
                <span className="mx-2 opacity-40">·</span>
                <Camera
                  size={13}
                  className="inline mb-[2px] me-1 opacity-80"
                />
                <span className="font-sans">
                  {incident.source_camera_label}
                </span>
              </>
            )}
          </p>
        </div>
        {isNew && (
          <span className="ghost-incident-new-dot mt-1.5" aria-hidden="true" />
        )}
      </div>

      {incident.preview_image_path && (
        <div className="ghost-visint-frame mt-1.5 mb-3 rounded-lg overflow-hidden border border-ghost-border-subtle">
          <img
            src={incident.preview_image_path}
            alt={incident.title}
            className="ghost-visint-image w-full h-32 object-cover block"
            draggable={false}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="ghost-visint-overlay" />
          <span className="ghost-visint-corner ghost-visint-corner--tl" />
          <span className="ghost-visint-corner ghost-visint-corner--tr" />
        </div>
      )}

      {bodyText && (
        <div
          className={`text-[13px] leading-relaxed overflow-hidden ${
            isClosed && closureSummary
              ? "rounded-lg border border-ghost-border-subtle bg-ghost-surface-hover/50 px-3 py-2 text-ghost-text-primary"
              : "px-0.5 text-ghost-text-secondary"
          }`}
        >
          {isClosed && closureSummary ? (
            <p className="flex items-center gap-1.5 mb-1.5 font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted">
              <CircleCheck size={12} />
              {t("closedSummaryLabel")}
            </p>
          ) : (
            <span className="flex items-center gap-1.5 text-ghost-text-muted/80 mb-1">
              <Sparkles size={12} className="text-ghost-text-muted" />
            </span>
          )}
          <p
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {bodyText}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-ghost-border-subtle/60">
        <div className="flex items-center gap-2 text-[12px] text-ghost-text-secondary min-w-0">
          <UserCircle2
            size={15}
            className={`flex-shrink-0 ${
              assignee ? "text-ghost-text-primary" : "opacity-60"
            }`}
          />
          <span className="truncate font-medium">
            {assignee?.nickname ?? t("incidentFilterUnassigned")}
          </span>
        </div>
        <div className="ghost-incident-meta flex items-center gap-2.5 text-[12px] text-ghost-text-muted shrink-0">
          {incident.tags && incident.tags.length > 0 && (
            <span className="inline-flex items-center gap-1 text-ghost-text-muted/80">
              <Tag size={13} className="opacity-80" />
              {incident.tags.length}
            </span>
          )}
          <span>{relativeText}</span>
        </div>
      </div>
    </div>
  );
}
