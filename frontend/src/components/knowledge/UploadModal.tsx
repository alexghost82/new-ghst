import { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, FileText } from "lucide-react";
import { useKnowledgeStore } from "../../stores/knowledgeStore";
import { useUserStore } from "../../stores/userStore";

interface UploadModalProps {
  onClose: () => void;
}

type Tab = "file" | "text";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/json",
];

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt,.json";

export default function UploadModal({ onClose }: UploadModalProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState("");
  const [tags, setTags] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, createText, uploadProgress, error } = useKnowledgeStore();
  const { activeUserId } = useUserStore();

  const isLoading = uploadProgress === "uploading" || uploadProgress === "processing";

  useEffect(() => {
    useKnowledgeStore.setState({ uploadProgress: "idle", error: null });
  }, []);

  const parseTags = (): string[] =>
    tags
      .split(",")
      .map((tg) => tg.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    if (!activeUserId) return;

    if (tab === "file" && file) {
      await uploadFile(activeUserId, file, parseTags());
    } else if (tab === "text" && textContent.trim()) {
      await createText(activeUserId, textContent.trim(), parseTags());
    }
  };

  useEffect(() => {
    if (uploadProgress === "done") {
      onClose();
    }
  }, [uploadProgress, onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && ACCEPTED_TYPES.includes(dropped.type)) {
      setFile(dropped);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const canSubmit =
    !isLoading &&
    ((tab === "file" && file !== null) ||
      (tab === "text" && textContent.trim().length > 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-ghost-bg-secondary border border-ghost-border-subtle rounded-xl shadow-lg w-full max-w-md mx-4 fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ghost-border-subtle">
          <h2 className="text-title text-ghost-text-primary">הוספת ידע</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-ghost-text-muted hover:text-ghost-text-secondary transition-colors duration-[100ms]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-ghost-border-subtle">
          <button
            onClick={() => setTab("file")}
            className={`flex-1 py-2.5 text-small font-medium transition-colors duration-[100ms] ${
              tab === "file"
                ? "text-ghost-accent border-b-2 border-ghost-accent"
                : "text-ghost-text-muted hover:text-ghost-text-secondary"
            }`}
          >
            העלאת קובץ
          </button>
          <button
            onClick={() => setTab("text")}
            className={`flex-1 py-2.5 text-small font-medium transition-colors duration-[100ms] ${
              tab === "text"
                ? "text-ghost-accent border-b-2 border-ghost-accent"
                : "text-ghost-text-muted hover:text-ghost-text-secondary"
            }`}
          >
            הדבקת טקסט
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {tab === "file" ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                transition-colors duration-[160ms]
                ${
                  isDragging
                    ? "border-ghost-accent bg-ghost-accent/5"
                    : file
                      ? "border-ghost-success/30 bg-ghost-success/5"
                      : "border-ghost-border-subtle hover:border-ghost-text-muted"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} className="text-ghost-success" />
                  <span className="text-small text-ghost-text-primary">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="mx-auto text-ghost-text-muted mb-2" />
                  <p className="text-small text-ghost-text-secondary">
                    גרור קובץ לכאן או לחץ לבחירה
                  </p>
                  <p className="text-xs text-ghost-text-muted mt-1">
                    PDF, DOCX, TXT, JSON
                  </p>
                </>
              )}
            </div>
          ) : (
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="הדבק כאן את תוכן הטקסט..."
              rows={6}
              className="w-full bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2.5 text-body text-ghost-text-primary placeholder:text-ghost-text-muted resize-none focus:outline-none focus:border-ghost-accent transition-colors duration-[160ms]"
            />
          )}

          <div>
            <label className="block text-small text-ghost-text-secondary mb-1.5">
              תגיות (מופרדות בפסיקים)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="לדוגמה: מדריך, נהלים, בטיחות"
              className="w-full bg-ghost-surface border border-ghost-border-subtle rounded-lg px-3 py-2 text-small text-ghost-text-primary placeholder:text-ghost-text-muted focus:outline-none focus:border-ghost-accent transition-colors duration-[160ms]"
            />
          </div>

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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              px-4 py-2 rounded-lg text-small font-medium
              transition-all duration-[100ms]
              ${
                canSubmit
                  ? "bg-ghost-accent hover:bg-ghost-accent-hover text-white"
                  : "bg-ghost-surface text-ghost-text-muted cursor-not-allowed"
              }
            `}
          >
            {isLoading
              ? "מעבד..."
              : tab === "file"
                ? "העלאה"
                : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
