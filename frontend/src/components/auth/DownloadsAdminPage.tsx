import { useEffect, useMemo, useState } from "react";
import GhostIcon from "../shared/GhostIcon";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  MapPin,
  Globe,
  Clock,
  Mail,
  AlertTriangle,
  Users,
  FileText,
} from "lucide-react";
import { api, withAdminRetry } from "../../api/client";
import type { DownloadLead } from "../../types/api";

interface DownloadsAdminPageProps {
  onBack: () => void;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatLocation(lead: DownloadLead): string {
  const parts = [lead.city, lead.region, lead.country].filter(Boolean);
  if (parts.length === 0) return "Unknown";
  return parts.join(", ");
}

function shortUA(ua: string | null): string {
  if (!ua) return "—";
  // Extract the leading browser token for a compact display; full UA is in title.
  const match = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/[\d.]+/);
  if (match) return match[0];
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}

export default function DownloadsAdminPage({
  onBack,
}: DownloadsAdminPageProps) {
  const [leads, setLeads] = useState<DownloadLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await withAdminRetry(() => api.listDownloads());
    if (res.ok && res.data) {
      setLeads(res.data);
    } else {
      setError(res.error?.message ?? "Failed to load download leads");
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const uniqueContacts = new Set(
      leads.map((l) => l.email || l.phone || l.id),
    );
    const repeats = leads.filter((l) => l.download_count > 1).length;
    return {
      total: leads.length,
      unique: uniqueContacts.size,
      repeats,
    };
  }, [leads]);

  return (
    <div
      className="fixed inset-0 bg-ghost-bg overflow-y-auto cursor-default"
      dir="ltr"
    >
      {/* ── Top toolbar ── */}
      <div className="sticky top-0 z-30 px-3 sm:px-5 pt-3 sm:pt-4">
        <nav className="mx-auto max-w-6xl">
          <div className="relative flex h-[52px] items-center gap-3 rounded-[14px] border border-ghost-border-subtle/60 bg-ghost-bg/60 pl-2.5 pr-2.5 backdrop-blur-2xl backdrop-saturate-[180%] shadow-[0_0_0_0.5px_rgb(0_0_0/0.07),0_2px_8px_rgb(0_0_0/0.08),0_14px_36px_rgb(0_0_0/0.14),inset_0_1px_0_rgb(255_255_255/0.12)]">
            <button
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-[9px] border border-ghost-border-subtle/60 bg-ghost-surface/40 text-[13px] font-medium text-ghost-text-secondary outline-none transition-[color,background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-ghost-text-primary hover:bg-ghost-surface-hover/80 active:scale-[0.98]"
            >
              <ArrowLeft
                size={14}
                className="transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:-translate-x-0.5"
              />
              <span>Back</span>
            </button>

            <span className="flex items-center gap-2.5 min-w-0">
              <GhostIcon size={32} className="flex-shrink-0" />
              <span className="hidden sm:flex items-baseline gap-2 min-w-0">
                <span className="text-[15px] font-semibold tracking-[-0.01em] text-ghost-text-primary">
                  Ghost
                </span>
                <span className="font-mono text-[9px] tracking-[0.24em] uppercase text-ghost-text-muted">
                  Internal · Download Ledger
                </span>
              </span>
            </span>

            <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-[9px] border border-ghost-border-subtle/60 bg-ghost-surface/40 text-[13px] font-medium text-ghost-text-secondary outline-none transition-[color,background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-ghost-text-primary hover:bg-ghost-surface-hover/80 active:scale-[0.98]"
                title="Refresh"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </nav>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-24">
        <div className="flex items-center gap-3 mb-2">
          <span className="ghost-alert-dot" />
          <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-ghost-text-muted">
            Confidential · Lead Tracking
          </span>
        </div>
        <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.03em] text-ghost-text-primary">
          Document Downloads
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ghost-text-secondary max-w-2xl">
          Everyone who unlocked a Ghost document — their name, company, email
          or phone, the device location detected at download time, IP address,
          and precise timestamp. Repeat downloaders are flagged.
        </p>

        {/* ── Stat cards ── */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/40 p-5">
            <div className="flex items-center gap-2 text-ghost-text-muted">
              <Download size={15} />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
                Total downloads
              </span>
            </div>
            <p className="mt-3 text-[28px] font-semibold text-ghost-text-primary tabular-nums">
              {stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/40 p-5">
            <div className="flex items-center gap-2 text-ghost-text-muted">
              <Users size={15} />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
                Unique emails
              </span>
            </div>
            <p className="mt-3 text-[28px] font-semibold text-ghost-text-primary tabular-nums">
              {stats.unique}
            </p>
          </div>
          <div className="rounded-2xl border border-ghost-border-subtle bg-ghost-surface/40 p-5">
            <div className="flex items-center gap-2 text-ghost-text-muted">
              <AlertTriangle size={15} />
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
                Repeat downloaders
              </span>
            </div>
            <p className="mt-3 text-[28px] font-semibold text-ghost-text-primary tabular-nums">
              {stats.repeats}
            </p>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="mt-8 rounded-2xl border border-ghost-border-subtle bg-ghost-surface/30 overflow-hidden">
          {error ? (
            <div className="px-6 py-14 text-center text-ghost-text-secondary">
              <p className="text-[15px]">{error}</p>
              <button
                onClick={() => void load()}
                className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-ghost-accent text-ghost-bg text-[13px] font-semibold"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          ) : loading && leads.length === 0 ? (
            <div className="px-6 py-16 text-center text-ghost-text-muted">
              <RefreshCw size={20} className="mx-auto animate-spin" />
              <p className="mt-3 font-mono text-[12px] tracking-[0.16em] uppercase">
                Loading ledger…
              </p>
            </div>
          ) : leads.length === 0 ? (
            <div className="px-6 py-16 text-center text-ghost-text-muted">
              <FileText size={22} className="mx-auto" />
              <p className="mt-3 text-[14px]">
                No downloads recorded yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-ghost-border-subtle">
                    {[
                      { icon: Users, label: "Contact" },
                      { icon: Mail, label: "Email / Phone" },
                      { icon: MapPin, label: "Location" },
                      { icon: Globe, label: "IP Address" },
                      { icon: Clock, label: "Downloaded" },
                      { icon: Download, label: "Count" },
                    ].map((h) => {
                      const Icon = h.icon;
                      return (
                        <th
                          key={h.label}
                          className="px-4 py-3 font-mono text-[10px] tracking-[0.18em] uppercase text-ghost-text-muted whitespace-nowrap"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Icon size={12} />
                            {h.label}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const repeat = lead.download_count > 1;
                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-ghost-border-subtle/60 last:border-b-0 hover:bg-ghost-surface-hover/40 transition-colors"
                      >
                        <td className="px-4 py-3.5 align-top">
                          <span className="text-[14px] font-medium text-ghost-text-primary break-words">
                            {lead.name || "—"}
                          </span>
                          {lead.company && (
                            <span className="block mt-0.5 text-[12px] text-ghost-text-secondary break-words">
                              {lead.company}
                            </span>
                          )}
                          <span
                            className="block mt-0.5 font-mono text-[10px] text-ghost-text-muted truncate max-w-[200px]"
                            title={lead.user_agent ?? ""}
                          >
                            {shortUA(lead.user_agent)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          {lead.email && (
                            <span className="block text-[13px] text-ghost-text-primary break-all">
                              {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="block mt-0.5 font-mono text-[12px] text-ghost-text-secondary hover:text-ghost-text-primary transition-colors"
                            >
                              {lead.phone}
                            </a>
                          )}
                          {!lead.email && !lead.phone && (
                            <span className="text-[13px] text-ghost-text-muted">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <span className="text-[13px] text-ghost-text-secondary">
                            {formatLocation(lead)}
                          </span>
                          {lead.latitude != null &&
                            lead.longitude != null && (
                              <a
                                href={`https://www.google.com/maps?q=${lead.latitude},${lead.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block mt-0.5 font-mono text-[10px] text-ghost-text-muted hover:text-ghost-text-primary transition-colors"
                              >
                                {lead.latitude.toFixed(4)},{" "}
                                {lead.longitude.toFixed(4)}
                              </a>
                            )}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <span className="font-mono text-[12px] text-ghost-text-secondary">
                            {lead.ip ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <span className="text-[13px] text-ghost-text-secondary tabular-nums">
                            {formatTimestamp(lead.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <span
                            className={
                              repeat
                                ? "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold tabular-nums bg-ghost-accent/15 text-ghost-text-primary border border-ghost-accent/30"
                                : "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] tabular-nums text-ghost-text-muted border border-ghost-border-subtle"
                            }
                            title={
                              repeat
                                ? "Repeat downloader"
                                : "First download"
                            }
                          >
                            {repeat && <AlertTriangle size={11} />}
                            {lead.download_count}×
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
