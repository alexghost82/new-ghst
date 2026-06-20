import { useState } from "react";
import { Send } from "lucide-react";
import type { IncidentNote } from "../../types/api";
import { useIncidentStore } from "../../stores/incidentStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import { sanitizeBrand } from "../../utils/sanitize";
import { formatLocalTime } from "./incidentTime";

interface IncidentNotesProps {
  incidentId: string;
  notes: IncidentNote[];
}

export default function IncidentNotes({
  incidentId,
  notes,
}: IncidentNotesProps) {
  const t = useT();
  const activeUserId = useUserStore((s) => s.activeUserId);
  const users = useUserStore((s) => s.users);
  const addNote = useIncidentStore((s) => s.addNote);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!activeUserId) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const note = await addNote(incidentId, activeUserId, trimmed);
    setSubmitting(false);
    if (note) setText("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={t("notePlaceholder")}
          className="flex-1 bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-text-primary/45"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="px-3 rounded-lg bg-ghost-text-primary text-ghost-bg text-small font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          aria-label={t("addNote")}
        >
          <Send size={14} />
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-small text-ghost-text-muted text-center py-6 opacity-70">
          {t("noNotesYet")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes
            .slice()
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
            )
            .map((note) => {
              const author = note.author
                ? users.find((u) => u.id === note.author)?.nickname ||
                  note.author
                : "—";
              return (
                <li
                  key={note.id}
                  className="bg-ghost-surface rounded-lg border border-ghost-border-subtle px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-ghost-text-muted">
                    <span className="font-medium">{author}</span>
                    <span className="tabular-nums">
                      {formatLocalTime(note.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-small text-ghost-text-primary leading-relaxed whitespace-pre-wrap break-words">
                    {sanitizeBrand(note.content)}
                  </p>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
