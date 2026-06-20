import { useEffect } from "react";
import { Camera, Image as ImageIcon, ShieldAlert, Sparkles } from "lucide-react";
import type {
  IncidentCorrelation,
  IncidentEvidence as IncidentEvidenceItem,
} from "../../types/api";
import { useIncidentStore } from "../../stores/incidentStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import { sanitizeBrand } from "../../utils/sanitize";
import { formatLocalTime } from "./incidentTime";

interface IncidentEvidenceProps {
  incidentId: string;
  evidence: IncidentEvidenceItem[];
}

export default function IncidentEvidence({
  incidentId,
  evidence,
}: IncidentEvidenceProps) {
  const t = useT();
  const activeUserId = useUserStore((s) => s.activeUserId);
  const fetchCorrelation = useIncidentStore((s) => s.fetchCorrelation);
  const correlated: IncidentCorrelation | undefined = useIncidentStore(
    (s) => s.correlated[incidentId],
  );

  useEffect(() => {
    if (!activeUserId) return;
    if (!correlated) fetchCorrelation(incidentId, activeUserId);
  }, [activeUserId, incidentId, correlated, fetchCorrelation]);

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted mb-2 font-semibold">
          {t("incidentEvidence")}
        </h4>
        {evidence.length === 0 ? (
          <p className="text-small text-ghost-text-muted text-center py-6 opacity-70">
            {t("noEvidenceYet")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {evidence.map((e) => (
              <li
                key={e.id}
                className="bg-ghost-surface rounded-lg border border-ghost-border-subtle overflow-hidden"
              >
                {e.image_path ? (
                  <img
                    src={e.image_path}
                    alt={e.type}
                    className="w-full h-24 object-cover block"
                    style={{ filter: "grayscale(0.5) contrast(1.05)" }}
                    onError={(ev) => {
                      (ev.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-20 bg-ghost-bg flex items-center justify-center text-ghost-text-muted">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-ghost-text-primary capitalize flex items-center gap-1">
                    {e.type === "alert" ? (
                      <ShieldAlert size={10} className="text-ghost-text-primary" />
                    ) : (
                      <Sparkles size={10} />
                    )}
                    {e.type}
                  </p>
                  <p className="text-[10px] text-ghost-text-muted tabular-nums mt-0.5">
                    {formatLocalTime(e.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted mb-2 font-semibold">
          {t("correlatedEntities")}
        </h4>
        {!correlated ? (
          <p className="text-xs text-ghost-text-muted opacity-70">
            {t("loading")}
          </p>
        ) : correlated.entities.length === 0 ? (
          <p className="text-xs text-ghost-text-muted opacity-70">
            {t("noCorrelation")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {correlated.entities.slice(0, 5).map((entity) => (
              <li
                key={entity.id}
                className="bg-ghost-surface rounded-lg border border-ghost-border-subtle px-3 py-2"
              >
                <p className="text-xs font-medium text-ghost-text-primary capitalize">
                  {entity.entity_type}
                </p>
                <p className="text-xs text-ghost-text-secondary leading-relaxed mt-0.5">
                  {sanitizeBrand(entity.canonical_description)}
                </p>
                <p className="text-[10px] text-ghost-text-muted mt-1 tabular-nums">
                  {entity.times_seen}× · {entity.cameras_seen.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {correlated && correlated.suggested_cameras.length > 0 && (
        <section>
          <h4 className="text-[10px] uppercase tracking-wider text-ghost-text-muted mb-2 font-semibold">
            {t("suggestedCameras")}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {correlated.suggested_cameras.map((cam) => (
              <span
                key={cam}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ghost-surface border border-ghost-border-subtle text-xs text-ghost-text-secondary"
              >
                <Camera size={10} />
                {cam}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
