import type { IncidentSeverity } from "../../types/api";
import { useT } from "../../utils/i18n";

interface SeverityBadgeProps {
  severity: IncidentSeverity;
  size?: "xs" | "sm";
}

// Monochrome severity ladder — contrast tiers on neutral tokens only.
const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  critical:
    "bg-ghost-text-primary/12 text-ghost-text-primary border-ghost-text-primary/50 shadow-[inset_0_0_0_1px_rgb(var(--ghost-text-primary)/0.08)]",
  high:
    "bg-ghost-surface-hover/80 text-ghost-text-primary border-ghost-text-primary/35",
  medium:
    "bg-ghost-surface/60 text-ghost-text-secondary border-ghost-border-subtle",
  low:
    "bg-ghost-surface/60 text-ghost-text-muted border-ghost-border-subtle",
};

const SEVERITY_LABEL_KEYS = {
  critical: "severityCritical",
  high: "severityHigh",
  medium: "severityMedium",
  low: "severityLow",
} as const;

export default function SeverityBadge({
  severity,
  size = "xs",
}: SeverityBadgeProps) {
  const t = useT();
  const padding = size === "xs" ? "px-2 py-1" : "px-2.5 py-1.5";
  const fontSize = size === "xs" ? "text-[11px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center ${padding} ${fontSize} font-bold uppercase rounded-[4px] border ${SEVERITY_STYLES[severity]}`}
      style={{ letterSpacing: "0.1em", lineHeight: 1.2 }}
    >
      {t(SEVERITY_LABEL_KEYS[severity])}
    </span>
  );
}
