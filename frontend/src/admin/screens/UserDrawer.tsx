import { useEffect, useState } from "react";

import { originToTier, TIER_LABEL_HE, usersApi, type AdminUserProfile } from "../api";
import { Banner, Button, Modal, MonoLabel, Spinner, StatusBadge } from "../ui";

interface Props {
  userId: string;
  canWrite: boolean;
  canDelete: boolean;
  canReset: boolean;
  canImpersonate: boolean;
  canTier: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type Pending =
  | { kind: "delete" }
  | { kind: "block" }
  | { kind: "impersonate" }
  | { kind: "tier" }
  | null;

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-ghost-border-subtle bg-ghost-surface/20 px-3 py-2 text-center">
      <div className="text-lg font-medium text-ghost-text-primary">{value}</div>
      <MonoLabel>{label}</MonoLabel>
    </div>
  );
}

export default function UserDrawer({
  userId,
  canWrite,
  canDelete,
  canReset,
  canImpersonate,
  canTier,
  onClose,
  onChanged,
}: Props) {
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await usersApi.get(userId);
    if (res.ok && res.data) setProfile(res.data);
    else setError(res.error?.message ?? "טעינת הפרופיל נכשלה");
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const setStatus = async (status: string, why?: string) => {
    setBusy(true);
    setError(null);
    const res = await usersApi.setStatus(userId, status, why);
    if (res.ok) await refresh();
    else setError(res.error?.message ?? "הפעולה נכשלה");
    setBusy(false);
  };

  const doDelete = async () => {
    setBusy(true);
    const res = await usersApi.softDelete(userId, reason);
    if (res.ok) {
      setPending(null);
      setReason("");
      await refresh();
    } else setError(res.error?.message ?? "המחיקה נכשלה");
    setBusy(false);
  };

  const doImpersonate = async () => {
    setBusy(true);
    const res = await usersApi.impersonate(userId, reason, code);
    if (res.ok && res.data) {
      setPending(null);
      setReason("");
      setCode("");
      setNotice("נוצר קישור התחזות חד-פעמי (תקף 5 דקות). נפתח בכרטיסייה חדשה.");
      window.open(res.data.login_path, "_blank", "noopener");
    } else setError(res.error?.message ?? "ההתחזות נכשלה");
    setBusy(false);
  };

  const doTierFlip = async () => {
    if (!profile) return;
    const next = originToTier(profile.origin) === "trial" ? "production" : "trial";
    setBusy(true);
    const res = await usersApi.setTier(userId, next, reason);
    if (res.ok) {
      setPending(null);
      setReason("");
      await refresh();
    } else setError(res.error?.message ?? "שינוי הסוג נכשל");
    setBusy(false);
  };

  const copyMagicLink = async () => {
    setBusy(true);
    const res = await usersApi.magicLink(userId);
    if (res.ok && res.data) {
      const url = `${window.location.origin}${res.data.login_path}`;
      try {
        await navigator.clipboard.writeText(url);
        setNotice("קישור כניסה חד-פעמי הועתק ללוח.");
      } catch {
        setNotice(url);
      }
    } else setError(res.error?.message ?? "יצירת הקישור נכשלה");
    setBusy(false);
  };

  const status = profile?.status ?? "active";

  return (
    <div className="fixed inset-0 z-40 flex justify-start bg-black/50" onClick={onClose}>
      <aside
        dir="rtl"
        className="h-full w-full max-w-md overflow-y-auto border-l border-ghost-border-subtle bg-ghost-bg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <MonoLabel>Ghost // User</MonoLabel>
          <button onClick={onClose} className="text-ghost-text-muted hover:text-ghost-text-primary">
            ✕
          </button>
        </div>

        {loading && <Spinner label="טוען פרופיל…" />}
        {error && <Banner tone="error">{error}</Banner>}

        {profile && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-medium text-ghost-text-primary">{profile.nickname}</h2>
                <StatusBadge status={status} />
              </div>
              <div className="mt-1 font-mono text-[11px] text-ghost-text-muted" dir="ltr">
                {profile.id}
              </div>
              {profile.lead_email && (
                <div className="mt-1 text-sm text-ghost-text-secondary" dir="ltr">
                  {profile.lead_email}
                  {profile.lead_phone ? ` · ${profile.lead_phone}` : ""}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Conversations" value={profile.stats.conversations} />
              <Stat label="Knowledge" value={profile.stats.knowledge_sources} />
              <Stat label="Incidents" value={profile.stats.incidents} />
            </div>

            <div className="flex flex-col gap-1 text-sm text-ghost-text-secondary">
              <Row label="סוג" value={TIER_LABEL_HE[originToTier(profile.origin)]} />
              <Row label="כניסה אחרונה" value={profile.last_login_at ?? "—"} />
              <Row label="פעילות אחרונה" value={profile.last_conversation_at ?? "—"} />
            </div>

            {notice && <Banner tone="success">{notice}</Banner>}

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-ghost-border-subtle pt-4">
              <MonoLabel>Actions</MonoLabel>

              {canWrite && status !== "deleted" && (
                <div className="flex flex-wrap gap-2">
                  {status !== "active" && (
                    <Button variant="ghost" disabled={busy} onClick={() => setStatus("active")}>
                      הפעל מחדש
                    </Button>
                  )}
                  {status !== "suspended" && (
                    <Button variant="ghost" disabled={busy} onClick={() => setStatus("suspended", "")}>
                      השעה
                    </Button>
                  )}
                  {status !== "blocked" && (
                    <Button variant="danger" disabled={busy} onClick={() => setPending({ kind: "block" })}>
                      חסום
                    </Button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canReset && status !== "deleted" && (
                  <Button variant="ghost" disabled={busy} onClick={copyMagicLink}>
                    קישור כניסה
                  </Button>
                )}
                {canImpersonate && status === "active" && (
                  <Button variant="ghost" disabled={busy} onClick={() => setPending({ kind: "impersonate" })}>
                    התחזות
                  </Button>
                )}
                {canTier && status !== "deleted" && (
                  <Button variant="ghost" disabled={busy} onClick={() => setPending({ kind: "tier" })}>
                    {originToTier(profile.origin) === "trial" ? "שדרג לתשלום" : "החזר לניסיון"}
                  </Button>
                )}
              </div>

              {canDelete &&
                (status === "deleted" ? (
                  <Button variant="ghost" disabled={busy} onClick={() => usersApi.restore(userId).then(refresh)}>
                    שחזר חשבון
                  </Button>
                ) : (
                  <Button variant="danger" disabled={busy} onClick={() => setPending({ kind: "delete" })}>
                    מחק חשבון (ניתן לשחזור)
                  </Button>
                ))}
            </div>
          </div>
        )}
      </aside>

      {/* Confirmation modals */}
      {pending?.kind === "block" && (
        <Modal title="חסימת משתמש" onClose={() => setPending(null)}>
          <p className="mb-3 text-sm text-ghost-text-secondary">
            חסימה מונעת מהמשתמש להשתמש במערכת. ניתן לבטל בכל עת. סיבה (תתועד ביומן):
          </p>
          <ReasonField reason={reason} setReason={setReason} />
          <ModalActions
            busy={busy}
            confirmLabel="חסום"
            danger
            onCancel={() => setPending(null)}
            onConfirm={() => {
              setPending(null);
              setStatus("blocked", reason);
              setReason("");
            }}
          />
        </Modal>
      )}

      {pending?.kind === "delete" && (
        <Modal title="מחיקת חשבון (Soft delete)" onClose={() => setPending(null)}>
          <p className="mb-3 text-sm text-ghost-text-secondary">
            החשבון יוסתר אך הנתונים יישמרו וניתן לשחזר. חובה לציין סיבה (תתועד ביומן):
          </p>
          <ReasonField reason={reason} setReason={setReason} required />
          <ModalActions
            busy={busy || reason.trim().length < 3}
            confirmLabel="מחק"
            danger
            onCancel={() => setPending(null)}
            onConfirm={doDelete}
          />
        </Modal>
      )}

      {pending?.kind === "tier" && profile && (
        <Modal title="שינוי סוג משתמש" onClose={() => setPending(null)}>
          <p className="mb-3 text-sm text-ghost-text-secondary">
            {originToTier(profile.origin) === "trial"
              ? "המשתמש יוגדר כמשתמש בתשלום (Production)."
              : "המשתמש יוחזר למצב ניסיון (Trial)."}{" "}
            ניתן לציין סיבה (תתועד ביומן):
          </p>
          <ReasonField reason={reason} setReason={setReason} />
          <ModalActions
            busy={busy}
            confirmLabel="אשר"
            onCancel={() => setPending(null)}
            onConfirm={doTierFlip}
          />
        </Modal>
      )}

      {pending?.kind === "impersonate" && (
        <Modal title="התחזות למשתמש" onClose={() => setPending(null)}>
          <p className="mb-3 text-sm text-ghost-text-secondary">
            פעולה רגישה ומתועדת. ייפתח חלון של מערכת Ghost בזהות המשתמש. נדרשת סיבה וקוד 2FA שלך:
          </p>
          <ReasonField reason={reason} setReason={setReason} required />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="קוד 2FA (6 ספרות)"
            dir="ltr"
            maxLength={6}
            className="mt-2 w-full rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary px-3 py-2 text-sm text-ghost-text-primary outline-none placeholder:text-ghost-text-muted focus:border-ghost-text-secondary"
          />
          <ModalActions
            busy={busy || reason.trim().length < 3 || code.length < 6}
            confirmLabel="התחזה"
            danger
            onCancel={() => setPending(null)}
            onConfirm={doImpersonate}
          />
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <MonoLabel>{label}</MonoLabel>
      <span className="text-ghost-text-secondary" dir="ltr">
        {value}
      </span>
    </div>
  );
}

function ReasonField({
  reason,
  setReason,
  required,
}: {
  reason: string;
  setReason: (v: string) => void;
  required?: boolean;
}) {
  return (
    <textarea
      value={reason}
      onChange={(e) => setReason(e.target.value)}
      rows={2}
      placeholder={required ? "סיבה (חובה)…" : "סיבה (אופציונלי)…"}
      className="w-full rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary px-3 py-2 text-sm text-ghost-text-primary outline-none placeholder:text-ghost-text-muted focus:border-ghost-text-secondary"
    />
  );
}

function ModalActions({
  busy,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <Button variant="ghost" onClick={onCancel}>
        ביטול
      </Button>
      <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </div>
  );
}
