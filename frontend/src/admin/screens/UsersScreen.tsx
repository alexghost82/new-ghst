import { useCallback, useEffect, useState } from "react";

import {
  originToTier,
  TIER_LABEL_HE,
  usersApi,
  type AdminUserRow,
  type UsersListResponse,
} from "../api";
import { useAdminStore } from "../store";
import { PERM } from "../roles";
import { Banner, Button, Card, Modal, MonoLabel, Spinner, StatusBadge } from "../ui";
import UserDrawer from "./UserDrawer";

const STATUS_FILTERS: { id: string; he: string }[] = [
  { id: "", he: "הכל" },
  { id: "active", he: "פעילים" },
  { id: "suspended", he: "מושעים" },
  { id: "blocked", he: "חסומים" },
];

const PAGE = 50;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("he-IL", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function UsersScreen() {
  const can = useAdminStore((s) => s.can);
  const [data, setData] = useState<UsersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await usersApi.list({ search, status, limit: PAGE, offset });
    if (res.ok && res.data) {
      setData(res.data);
    } else {
      setError(res.error?.message ?? "טעינת המשתמשים נכשלה");
    }
    setLoading(false);
  }, [search, status, offset]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  const total = data?.total ?? 0;
  const breakdown = data?.status_breakdown ?? {};

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id || "all"}
              onClick={() => {
                setStatus(f.id);
                setOffset(0);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                status === f.id
                  ? "border-ghost-text-secondary bg-ghost-surface/60 text-ghost-text-primary"
                  : "border-ghost-border-subtle text-ghost-text-secondary hover:text-ghost-text-primary"
              }`}
            >
              {f.he}
              {f.id && breakdown[f.id] != null ? ` · ${breakdown[f.id]}` : ""}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="חיפוש לפי שם, אימייל או מזהה…"
            className="w-64 rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary px-3 py-2 text-sm text-ghost-text-primary outline-none placeholder:text-ghost-text-muted focus:border-ghost-text-secondary"
          />
          {can(PERM.USERS_CREATE) && (
            <Button onClick={() => setShowCreate(true)}>+ הוסף משתמש</Button>
          )}
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Card className="overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-ghost-border-subtle px-4 py-2.5">
          {["משתמש", "סוג", "סטטוס", "שיחות", "נוצר"].map((h) => (
            <MonoLabel key={h}>{h}</MonoLabel>
          ))}
        </div>

        {loading && (
          <div className="p-8">
            <Spinner label="טוען משתמשים…" />
          </div>
        )}

        {!loading && data?.items.length === 0 && (
          <div className="p-8 text-center text-sm text-ghost-text-muted">
            לא נמצאו משתמשים התואמים את החיפוש.
          </div>
        )}

        {!loading &&
          data?.items.map((u: AdminUserRow) => (
            <button
              key={u.id}
              onClick={() => setSelectedId(u.id)}
              className="grid w-full grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-2 border-b border-ghost-border-subtle/50 px-4 py-3 text-right text-sm transition-colors last:border-0 hover:bg-ghost-surface/30"
            >
              <span className="flex flex-col">
                <span className="truncate text-ghost-text-primary">{u.nickname}</span>
                {u.lead_email && (
                  <span className="truncate text-xs text-ghost-text-muted" dir="ltr">
                    {u.lead_email}
                  </span>
                )}
              </span>
              <span className="text-xs text-ghost-text-secondary">
                {TIER_LABEL_HE[originToTier(u.origin)]}
              </span>
              <span>
                <StatusBadge status={u.status} />
              </span>
              <span className="text-ghost-text-secondary">{u.conversation_count}</span>
              <span className="text-ghost-text-muted">{fmtDate(u.created_at)}</span>
            </button>
          ))}
      </Card>

      {/* Pagination */}
      {total > PAGE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-ghost-text-muted">
            {offset + 1}–{Math.min(offset + PAGE, total)} מתוך {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              הקודם
            </Button>
            <Button
              variant="ghost"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              הבא
            </Button>
          </div>
        </div>
      )}

      {selectedId && (
        <UserDrawer
          userId={selectedId}
          canWrite={can(PERM.USERS_WRITE)}
          canDelete={can(PERM.USERS_DELETE)}
          canReset={can(PERM.USERS_RESET)}
          canImpersonate={can(PERM.USERS_IMPERSONATE)}
          canTier={can(PERM.USERS_TIER)}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setOffset(0);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [tier, setTier] = useState<"trial" | "production">("trial");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsKey = tier === "production";
  const canSubmit = nickname.trim().length > 0 && (!needsKey || apiKey.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const res = await usersApi.create({
      nickname: nickname.trim(),
      tier,
      api_key: apiKey.trim() || undefined,
    });
    if (res.ok) onCreated();
    else {
      setErr(res.error?.message ?? "יצירת המשתמש נכשלה");
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-ghost-border-subtle bg-ghost-bg-secondary px-3 py-2.5 text-sm text-ghost-text-primary outline-none placeholder:text-ghost-text-muted focus:border-ghost-text-secondary";

  return (
    <Modal title="הוספת משתמש חדש" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block">
            <MonoLabel>Nickname</MonoLabel>
          </span>
          <input
            className={field}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="שם המשתמש"
            autoFocus
          />
        </label>

        <div>
          <span className="mb-1.5 block">
            <MonoLabel>Tier</MonoLabel>
          </span>
          <div className="flex gap-2">
            {(["trial", "production"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  tier === t
                    ? "border-ghost-text-secondary bg-ghost-surface/60 text-ghost-text-primary"
                    : "border-ghost-border-subtle text-ghost-text-secondary hover:text-ghost-text-primary"
                }`}
              >
                {TIER_LABEL_HE[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block">
            <MonoLabel>API Key {needsKey ? "(חובה)" : "(אופציונלי — ברירת מחדל: מפתח דמו)"}</MonoLabel>
          </span>
          <input
            className={field}
            dir="ltr"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={needsKey ? "sk-…" : "ריק = מפתח הדמו של השרת"}
            type="password"
          />
        </label>

        {err && <Banner tone="error">{err}</Banner>}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "יוצר…" : "צור משתמש"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
