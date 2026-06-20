import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { KnowledgeSource, KnowledgeChunk } from "../../types/api";
import { api } from "../../api/client";
import { useKnowledgeStore } from "../../stores/knowledgeStore";
import { useUserStore } from "../../stores/userStore";

interface EditSourceModalProps {
  source: KnowledgeSource;
  onClose: () => void;
}

export default function EditSourceModal({ source, onClose }: EditSourceModalProps) {
  const [name, setName] = useState(source.filename || "");
  const [content, setContent] = useState("");
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateSource } = useKnowledgeStore();
  const { activeUserId } = useUserStore();

  const isTextSource = source.source_type === "text";

  useEffect(() => {
    if (isTextSource && activeUserId) {
      setIsLoadingChunks(true);
      api.getKnowledgeChunks(source.id, activeUserId).then((res) => {
        if (res.ok && res.data) {
          const combined = (res.data as KnowledgeChunk[])
            .sort((a, b) => a.chunk_index - b.chunk_index)
            .map((c) => c.content)
            .join("\n");
          setContent(combined);
        }
        setIsLoadingChunks(false);
      });
    }
  }, [source.id, activeUserId, isTextSource]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSave = async () => {
    if (!activeUserId) return;
    setIsSaving(true);
    setError(null);

    const data: Partial<{ filename: string; content: string }> = {};
    const trimmedName = name.trim();
    if (trimmedName !== (source.filename || "")) {
      data.filename = trimmedName || undefined!;
    }
    if (isTextSource && content !== "") {
      data.content = content;
    }

    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }

    const ok = await updateSource(source.id, activeUserId, data);
    setIsSaving(false);
    if (ok) {
      onClose();
    } else {
      setError("שמירה נכשלה, נסה שוב");
    }
  };

  const canSave = !isSaving && !isLoadingChunks;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-xl shadow-lg w-full max-w-md mx-4 fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ghost-border-subtle">
          <h2 className="text-title text-ghost-text-primary">עריכת מקור</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-ghost-text-muted hover:text-ghost-text-secondary transition-colors duration-[100ms]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-small text-ghost-text-secondary mb-1.5">
              שם המקור
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם לתצוגה..."
              className="w-full bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[160ms]"
            />
          </div>

          {isTextSource && (
            <div>
              <label className="block text-small text-ghost-text-secondary mb-1.5">
                תוכן הטקסט
              </label>
              {isLoadingChunks ? (
                <div className="w-full bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-6 text-center text-ghost-text-muted text-small">
                  טוען תוכן...
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2.5 text-body text-ghost-text-primary placeholder:text-ghost-text-muted resize-none focus:outline-none focus:border-ghost-accent transition-colors duration-[160ms]"
                />
              )}
            </div>
          )}

          {error && (
            <p className="text-small text-ghost-error">{error}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-ghost-border-subtle flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-small text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`
              px-4 py-2 rounded-lg text-small font-medium
              transition-all duration-[100ms]
              ${
                canSave
                  ? "bg-ghost-accent hover:bg-ghost-accent-hover text-white"
                  : "bg-ghost-surface text-ghost-text-muted cursor-not-allowed"
              }
            `}
          >
            {isSaving ? "שומר..." : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
