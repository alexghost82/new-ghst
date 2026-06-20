import { memo, useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Trash2,
  Pencil,
  Video,
  ShieldAlert,
  GripVertical,
  FolderPlus,
  Clock3,
  Camera,
  CameraOff,
  MessageSquare,
  FileText,
  Sparkles,
} from "lucide-react";
import type { Conversation } from "../../types/api";
import { useAlertStore } from "../../stores/alertStore";
import { useLanguageStore } from "../../stores/languageStore";
import { useUserStore } from "../../stores/userStore";
import { useAutoNamingStore } from "../../stores/autoNamingStore";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useConversationActivityStore } from "../../stores/conversationActivityStore";
import { assignmentFor } from "../../utils/conversationGroups";
import { useT } from "../../utils/i18n";
import { useConversationCameraThumbnail } from "../../hooks/useConversationCameraThumbnail";
import AssignToGroupMenu from "./AssignToGroupMenu";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  draggingOverlay?: boolean;
  showAssignButton?: boolean;
  indentLevel?: 0 | 1 | 2;
}

function formatRelativeTime(
  dateStr: string,
  locale: "he" | "en",
  t: ReturnType<typeof useT>,
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) {
    return locale === "he"
      ? `לפני ${diffMin} דק׳`
      : `${diffMin} ${t("mAgo")}`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return locale === "he"
      ? `לפני ${diffHr} שע׳`
      : `${diffHr} ${t("hAgo")}`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) {
    return locale === "he" ? "אתמול" : t("yesterday");
  }
  if (diffDay < 7) {
    return locale === "he"
      ? `לפני ${diffDay} ימים`
      : `${diffDay} ${t("dAgo")}`;
  }
  return new Date(dateStr).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
  });
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
  draggingOverlay = false,
  showAssignButton = true,
  indentLevel = 0,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title || "");
  const [assignOpen, setAssignOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const assignAnchorRef = useRef<HTMLButtonElement>(null);
  const locale = useLanguageStore((s) => s.locale);
  const t = useT();
  const activeUserId = useUserStore((s) => s.activeUserId);
  const alertModeOn = useAlertStore(
    (s) =>
      !!s.alertModeEnabled[conversation.id] || !!conversation.alert_mode_enabled,
  );

  // Unread / latest-activity kind for the unread badge + preview line. The
  // conversation being viewed is always treated as read.
  const activity = useConversationActivityStore(
    (s) => s.activity[conversation.id],
  );
  const unread = !!activity?.unread && !isActive;
  const unreadKind = activity?.lastEventKind;

  const { thumbnailUrl, isLive, hasCamera, start, stop } =
    useConversationCameraThumbnail(
      conversation,
      activeUserId,
      !draggingOverlay,
    );

  // Auto-naming override. Conversations assigned to an area/group are manual-
  // only by product rule, so the per-conversation toggle is hidden for them.
  const autoAreas = useConversationGroupsStore((s) => s.areas);
  const autoGroups = useConversationGroupsStore((s) => s.groups);
  const isAssigned = (() => {
    const a = assignmentFor(conversation.id, {
      areas: autoAreas,
      groups: autoGroups,
    });
    return !!(a.areaId || a.groupId);
  })();
  const autoNameEnabled = useAutoNamingStore((s) =>
    s.isEffectiveEnabled(conversation.id),
  );
  const setAutoNameOverride = useAutoNamingStore((s) => s.setOverride);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: conversation.id,
    disabled: draggingOverlay || isEditing,
  });

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSubmitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmitRename();
    } else if (e.key === "Escape") {
      setEditValue(conversation.title || "");
      setIsEditing(false);
    }
  };

  const style = draggingOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const cameraCount = conversation.camera_count ?? 0;

  const renderStatus = () => {
    if (unread) {
      if (unreadKind === "report") {
        return (
          <span className="inline-flex items-center gap-1 text-ghost-text-primary font-medium">
            <FileText size={11} strokeWidth={2.2} className="flex-shrink-0" />
            <span className="truncate">{t("convUnreadReport")}</span>
          </span>
        );
      }
      if (unreadKind === "alert") {
        return (
          <span className="inline-flex items-center gap-1 text-ghost-error font-medium">
            <ShieldAlert size={11} strokeWidth={2.2} className="flex-shrink-0" />
            <span className="truncate">{t("convUnreadAlert")}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-ghost-text-primary font-medium">
          <MessageSquare size={11} strokeWidth={2.2} className="flex-shrink-0" />
          <span className="truncate">{t("convUnreadMessage")}</span>
        </span>
      );
    }
    if (alertModeOn) {
      return (
        <span className="inline-flex items-center gap-1 text-ghost-error">
          <ShieldAlert size={11} strokeWidth={2.2} className="flex-shrink-0" />
          <span className="truncate">{t("alertModeLabel")}</span>
        </span>
      );
    }
    if (isLive) {
      return (
        <span className="inline-flex items-center gap-1.5 text-ghost-text-secondary">
          <span className="ghost-conv-status-dot" aria-hidden="true" />
          <span className="truncate">{t("liveLabel")}</span>
        </span>
      );
    }
    if (hasCamera) {
      const label =
        cameraCount === 1
          ? `1 ${t("cameraLabelSingular")}`
          : `${cameraCount || 1} ${t("camerasLabel")}`;
      return (
        <span className="inline-flex items-center gap-1 text-ghost-text-muted">
          <Video size={11} className="flex-shrink-0 opacity-80" />
          <span className="truncate">{label}</span>
        </span>
      );
    }
    const msgCount = conversation.message_count ?? 0;
    const msgLabel =
      msgCount === 1
        ? `1 ${t("messagesLabelSingular")}`
        : `${msgCount} ${t("messagesLabel")}`;
    return (
      <span className="inline-flex items-center gap-1 text-ghost-text-muted">
        <MessageSquare size={11} className="flex-shrink-0 opacity-70" />
        <span className="truncate">{msgLabel}</span>
      </span>
    );
  };

  return (
    <div
      ref={draggingOverlay ? undefined : setNodeRef}
      style={style}
      role="button"
      tabIndex={draggingOverlay ? -1 : 0}
      onClick={() => {
        if (!isEditing && !isDragging) onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !isEditing && !isDragging) onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditValue(conversation.title || "");
        setIsEditing(true);
      }}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) stop();
      }}
      className={[
        "ghost-conv-item group w-full text-start ps-1.5 pe-2 py-2 cursor-pointer relative",
        indentLevel === 1 ? "ghost-conv-item--indent-1" : "",
        indentLevel === 2 ? "ghost-conv-item--indent-2" : "",
        isActive ? "ghost-conv-item--active" : "",
        isDragging && !draggingOverlay ? "ghost-conv-item--dragging" : "",
        draggingOverlay ? "ghost-conv-item--overlay shadow-lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="ghost-conv-drag-handle flex-shrink-0 flex items-center justify-center w-3.5 self-center rounded text-ghost-text-muted/35 hover:text-ghost-text-secondary cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 ease-out"
          aria-label={t("reorderConversation")}
          title={t("reorderConversation")}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>

        <div
          className={[
            "ghost-conv-avatar flex-shrink-0 self-center relative",
            isLive ? "ghost-conv-avatar--live" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="ghost-conv-avatar__icon">
              {hasCamera ? (
                <Camera size={17} strokeWidth={1.75} />
              ) : (
                <CameraOff size={16} strokeWidth={1.75} />
              )}
            </span>
          )}
          {isLive && (
            <span className="ghost-conv-live-dot" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSubmitRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-[14px] bg-ghost-surface border border-ghost-border-subtle rounded-md px-2 py-1 text-ghost-text-primary focus:outline-none focus:border-ghost-text-secondary"
            />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  {alertModeOn && (
                    <ShieldAlert
                      size={13}
                      className="flex-shrink-0 text-ghost-error animate-pulse"
                      aria-label="Alert mode active"
                    />
                  )}
                  {unread && (
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        unreadKind === "alert"
                          ? "bg-ghost-error"
                          : unreadKind === "report"
                            ? "bg-ghost-success"
                            : "bg-ghost-accent"
                      }`}
                      aria-label="Unread"
                    />
                  )}
                  <p
                    className={`text-[14px] truncate leading-snug transition-colors duration-200 ease-out ${
                      isActive
                        ? "text-ghost-text-primary font-semibold"
                        : unread
                          ? "text-ghost-text-primary font-semibold group-hover:text-ghost-text-primary"
                          : "text-ghost-text-primary font-medium group-hover:text-ghost-text-primary"
                    }`}
                  >
                    {conversation.title || t("newConversation")}
                  </p>
                </div>

                <div className="ghost-conv-endcap relative flex-shrink-0 self-start h-[18px]">
                  <span className="ghost-conv-meta inline-flex items-center gap-1 text-[11px] leading-none text-ghost-text-muted/90 tabular-nums whitespace-nowrap">
                    <Clock3
                      size={10}
                      strokeWidth={2}
                      className="flex-shrink-0 opacity-70"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {formatRelativeTime(conversation.updated_at, locale, t)}
                    </span>
                  </span>

                  {!draggingOverlay && (
                    <div className="ghost-conv-actions absolute top-0 end-0 flex items-center gap-0.5">
                      {showAssignButton && (
                        <button
                          ref={assignAnchorRef}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssignOpen((prev) => !prev);
                          }}
                          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors duration-200 ease-out ${
                            assignOpen
                              ? "text-ghost-text-primary bg-ghost-surface-hover"
                              : "text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
                          }`}
                          aria-label={t("assignToArea")}
                          title={t("assignToArea")}
                          aria-expanded={assignOpen}
                        >
                          <FolderPlus size={14} />
                        </button>
                      )}
                      {!isAssigned && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAutoNameOverride(
                              conversation.id,
                              !autoNameEnabled,
                            );
                          }}
                          className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors duration-200 ease-out ${
                            autoNameEnabled
                              ? "text-ghost-text-primary bg-ghost-surface-hover"
                              : "text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover"
                          }`}
                          aria-label={t(
                            autoNameEnabled
                              ? "autoNameDisableForConversation"
                              : "autoNameEnableForConversation",
                          )}
                          title={t(
                            autoNameEnabled
                              ? "autoNameDisableForConversation"
                              : "autoNameEnableForConversation",
                          )}
                          aria-pressed={autoNameEnabled}
                        >
                          <Sparkles size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditValue(conversation.title || "");
                          setIsEditing(true);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors duration-200 ease-out"
                        aria-label={t("renameConversation")}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-error/10 transition-colors duration-200 ease-out"
                        aria-label={t("deleteConversation")}
                      >
                        <Trash2 size={14} />
                      </button>
                      {assignOpen && (
                        <AssignToGroupMenu
                          conversationId={conversation.id}
                          anchorRef={assignAnchorRef}
                          onClose={() => setAssignOpen(false)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="ghost-conv-subtitle mt-1 text-[11.5px] leading-none truncate">
                {renderStatus()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ConversationItem);
