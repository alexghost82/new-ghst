import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { api, withAdminRetry } from "../../api/client";
import { useT } from "../../utils/i18n";

interface QuickLoginLinkSectionProps {
  userId: string;
}

interface IssuedLink {
  url: string;
  expiresAt: number;
  initialTtlSeconds: number;
}

const COPY_FEEDBACK_MS = 1600;

function buildAbsoluteUrl(loginPath: string): string {
  if (typeof window === "undefined") return loginPath;
  // ``loginPath`` always comes back as a host-relative ``/?magic=…``;
  // we promote it to an absolute URL based on whatever origin the
  // operator is currently using so the link stays valid when copied
  // into a different browser on the same machine / LAN tunnel.
  try {
    return new URL(loginPath, window.location.origin).toString();
  } catch {
    return loginPath;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function QuickLoginLinkSection({ userId }: QuickLoginLinkSectionProps) {
  const t = useT();
  const [link, setLink] = useState<IssuedLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reset link state any time the active user changes — a link issued
  // for user A must never be presented as belonging to user B.
  useEffect(() => {
    setLink(null);
    setError(null);
    setJustCopied(false);
  }, [userId]);

  // Tick once a second so the countdown stays current while the panel
  // is open. Cheap; we only run while a link exists.
  useEffect(() => {
    if (!link) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [link]);

  useEffect(() => {
    if (!justCopied) return;
    const id = window.setTimeout(() => setJustCopied(false), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [justCopied]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setJustCopied(false);
    const res = await withAdminRetry(() => api.createMagicLink(userId));
    setIsLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error?.message ?? t("quickLoginLinkFailed"));
      return;
    }
    const url = buildAbsoluteUrl(res.data.login_path);
    const expiresAt = Date.parse(res.data.expires_at);
    setLink({
      url,
      expiresAt: Number.isFinite(expiresAt)
        ? expiresAt
        : Date.now() + res.data.expires_in_seconds * 1000,
      initialTtlSeconds: res.data.expires_in_seconds,
    });
    setNow(Date.now());

    // Eagerly copy the freshly issued link so the operator never has
    // to chase the button — generating a link almost always means they
    // intend to share or store it immediately.
    const ok = await copyToClipboard(url);
    if (ok) setJustCopied(true);
  };

  const remainingMs = link ? Math.max(0, link.expiresAt - now) : 0;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const isExpired = !!link && remainingMs <= 0;
  const expiryLabel = link
    ? isExpired
      ? t("quickLoginLinkExpired")
      : t("quickLoginLinkExpiresIn").replace("{minutes}", String(remainingMinutes))
    : null;

  return (
    <div>
      {!link && (
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className="w-full h-10 rounded-xl text-small font-medium bg-ghost-surface hover:bg-ghost-surface-hover text-ghost-text-primary border border-ghost-border-subtle transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <KeyRound size={14} />
          {isLoading ? t("generatingQuickLoginLink") : t("generateQuickLoginLink")}
        </button>
      )}

      {link && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ghost-text-muted">
            <span>{t("quickLoginLinkReady")}</span>
            <span className={isExpired ? "text-ghost-error" : ""}>
              {expiryLabel}
            </span>
          </div>

          <div className="flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={link.url}
              dir="ltr"
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-ghost-surface border border-ghost-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-ghost-text-primary focus:outline-none focus:border-ghost-text-secondary transition-colors duration-[120ms] text-left truncate"
            />
            <button
              onClick={async () => {
                const ok = await copyToClipboard(link.url);
                if (ok) setJustCopied(true);
              }}
              className="px-3 rounded-xl bg-ghost-surface hover:bg-ghost-surface-hover text-ghost-text-primary border border-ghost-border-subtle transition-colors duration-[120ms] flex items-center gap-1.5 text-xs"
              title={t("copyLink")}
              aria-label={t("copyLink")}
            >
              {justCopied ? <Check size={14} /> : <Copy size={14} />}
              <span className="hidden sm:inline">
                {justCopied ? t("linkCopied") : t("copyLink")}
              </span>
            </button>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 rounded-xl bg-ghost-surface hover:bg-ghost-surface-hover text-ghost-text-primary border border-ghost-border-subtle transition-colors duration-[120ms] flex items-center text-xs"
              title={t("openLink")}
              aria-label={t("openLink")}
            >
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ghost-text-muted leading-snug">
              {t("quickLoginLinkSecurityNote")}
            </p>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs text-ghost-text-secondary hover:text-ghost-text-primary border border-ghost-border-subtle hover:bg-ghost-surface-hover transition-colors duration-[120ms] flex items-center gap-1 disabled:opacity-50"
              title={t("regenerateLink")}
            >
              <RefreshCw size={12} />
              {t("regenerateLink")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-ghost-error mt-2">{error}</p>
      )}
    </div>
  );
}
