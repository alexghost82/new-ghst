import { Camera, Clock, ShieldAlert, Timer } from "lucide-react";
import { useIncidentStore } from "../../stores/incidentStore";
import { useT } from "../../utils/i18n";
import { formatDuration } from "./incidentTime";

export default function IncidentKPIBar() {
  const t = useT();
  const kpi = useIncidentStore((s) => s.kpi);

  if (!kpi) return null;

  const handleStr = formatDuration(kpi.avg_time_to_handle_sec);
  const closeStr = formatDuration(kpi.avg_time_to_close_sec);
  const hotCameras = kpi.hot_cameras.slice(0, 3);
  const isHot = kpi.critical_count > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiTile
        icon={<Clock size={16} className="text-ghost-text-muted shrink-0" />}
        label={t("kpiAvgHandle")}
        value={handleStr}
        valueClass="text-ghost-text-primary"
      />
      <KpiTile
        icon={<Timer size={16} className="text-ghost-text-muted shrink-0" />}
        label={t("kpiAvgClose")}
        value={closeStr}
        valueClass="text-ghost-text-primary"
      />
      <KpiTile
        icon={
          <ShieldAlert
            size={16}
            className={`shrink-0 ${
              isHot ? "text-ghost-text-primary" : "text-ghost-text-muted"
            }`}
          />
        }
        label={t("kpiCriticalCount")}
        value={String(kpi.critical_count)}
        valueClass="text-ghost-text-primary"
        highlighted={isHot}
      />
      <KpiTile
        icon={<Camera size={16} className="text-ghost-text-muted shrink-0" />}
        label={t("kpiHotCameras")}
        value={
          hotCameras.length === 0
            ? "—"
            : hotCameras.map((c) => `${c.label} (${c.count})`).join(", ")
        }
        valueClass="text-ghost-text-primary"
        compact
      />
    </div>
  );
}

interface KpiTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  compact?: boolean;
  highlighted?: boolean;
}

function KpiTile({
  icon,
  label,
  value,
  valueClass,
  compact,
  highlighted,
}: KpiTileProps) {
  return (
    <div
      className={`rounded-2xl border pt-4 pb-3.5 px-4 min-h-[76px] transition-colors duration-150 ${
        highlighted
          ? "border-ghost-text-primary/35 bg-ghost-surface/50"
          : "border-ghost-border-subtle bg-ghost-surface/30 hover:border-ghost-text-primary/25"
      }`}
    >
      <div className="flex items-center gap-2 text-ghost-text-muted">
        {icon}
        <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ghost-text-muted truncate">
          {label}
        </span>
      </div>
      <p
        className={`mt-2 tabular-nums ${
          compact
            ? "text-[14px] font-medium leading-snug"
            : "text-[22px] font-semibold leading-tight"
        } truncate ${valueClass ?? "text-ghost-text-primary"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
