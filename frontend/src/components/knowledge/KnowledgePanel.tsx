import { useEffect, useState } from "react";
import { X, Plus, BookOpen } from "lucide-react";
import { useKnowledgeStore } from "../../stores/knowledgeStore";
import { useUserStore } from "../../stores/userStore";
import KnowledgeSourceItem from "./KnowledgeSourceItem";
import UploadModal from "./UploadModal";
import EditSourceModal from "./EditSourceModal";
import { useT } from "../../utils/i18n";
import { confirmDialog, toast } from "../../stores/feedbackStore";
import type { KnowledgeSource } from "../../types/api";

interface KnowledgePanelProps {
  onClose: () => void;
}

export default function KnowledgePanel({ onClose }: KnowledgePanelProps) {
  const { sources, isLoading, fetchSources, deleteSource, toggleActive } =
    useKnowledgeStore();
  const { activeUserId } = useUserStore();
  const [showUpload, setShowUpload] = useState(false);
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
  const t = useT();

  const handleDeleteSource = async (sourceId: string) => {
    if (!activeUserId) return;
    const ok = await confirmDialog({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteGeneric"),
      confirmLabel: t("delete"),
      tone: "danger",
    });
    if (!ok) return;
    await deleteSource(sourceId, activeUserId);
    toast.success(t("actionDeleted"));
  };

  useEffect(() => {
    if (activeUserId) {
      fetchSources(activeUserId);
    }
  }, [activeUserId, fetchSources]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showUpload && !editingSource) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, showUpload, editingSource]);

  return (
    <>
      <aside className="w-panel flex-shrink-0 bg-ghost-bg-secondary border-s border-ghost-border-subtle h-screen flex flex-col slide-in-right">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ghost-border-subtle">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-ghost-accent" />
            <h2 className="text-title text-ghost-text-primary">
              {t("knowledgeBase")}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowUpload(true)}
              className="p-1.5 rounded-lg text-ghost-accent hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
              aria-label={t("addSource")}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ghost-text-muted hover:text-ghost-text-secondary hover:bg-ghost-surface-hover transition-colors duration-[100ms]"
              aria-label="Close knowledge panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <p className="text-ghost-text-muted text-small text-center py-8">
              {t("loadingSources")}
            </p>
          ) : sources.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen
                size={32}
                className="text-ghost-text-muted mx-auto mb-3 opacity-50"
              />
              <p className="text-ghost-text-muted text-small">
                {t("noKnowledgeSources")}
              </p>
              <p className="text-ghost-text-muted text-xs mt-1">
                {t("uploadHint")}
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-ghost-accent hover:bg-ghost-accent-hover text-white text-small transition-colors duration-[100ms]"
              >
                {t("addSource")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <KnowledgeSourceItem
                  key={source.id}
                  source={source}
                  onToggle={() => activeUserId && toggleActive(source.id, activeUserId)}
                  onDelete={() => void handleDeleteSource(source.id)}
                  onEdit={() => setEditingSource(source)}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
      {editingSource && (
        <EditSourceModal
          source={editingSource}
          onClose={() => setEditingSource(null)}
        />
      )}
    </>
  );
}
