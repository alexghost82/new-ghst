import { useMemo, useState } from "react";
import {
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Video,
  Trash2,
  Radio,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Conversation } from "../../types/api";
import {
  groupContainerId,
  groupSortableId,
  type ConversationGroup,
} from "../../utils/conversationGroups";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useBroadcastStore } from "../../stores/broadcastStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import ConversationItem from "./ConversationItem";

interface GroupNodeProps {
  group: ConversationGroup;
  conversationsById: Map<string, Conversation>;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  draggingOverlay?: boolean;
}

export default function GroupNode({
  group,
  conversationsById,
  activeConversationId,
  onSelect,
  onDelete,
  onRename,
  draggingOverlay = false,
}: GroupNodeProps) {
  const t = useT();
  const toggleCollapsed = useConversationGroupsStore(
    (s) => s.toggleGroupCollapsed,
  );
  const deleteGroup = useConversationGroupsStore((s) => s.deleteGroup);
  const renameGroup = useConversationGroupsStore((s) => s.renameGroup);
  const openBroadcastScope = useBroadcastStore((s) => s.openScope);
  const activeUserId = useUserStore((s) => s.activeUserId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(group.name);

  const containerId = groupContainerId(group.id);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: containerId });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: groupSortableId(group.id),
    data: { type: "group", groupId: group.id, areaId: group.area_id },
    disabled: draggingOverlay || isEditing,
  });

  const sortableStyle = draggingOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const groupConversations = useMemo(
    () =>
      group.conversation_ids
        .map((id) => conversationsById.get(id))
        .filter((c): c is Conversation => !!c),
    [group.conversation_ids, conversationsById],
  );

  const collapsed = !!group.collapsed;
  const count = groupConversations.length;

  const submitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== group.name) renameGroup(group.id, trimmed);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm(t("confirmDeleteGroup"))) deleteGroup(group.id);
  };

  const openBroadcast = () => {
    if (activeUserId) {
      openBroadcastScope({ type: "group", id: group.id, name: group.name }, activeUserId);
    }
  };

  return (
    <div
      ref={draggingOverlay ? undefined : setSortableRef}
      style={sortableStyle}
      className={`ghost-group-node ${
        isDragging && !draggingOverlay ? "ghost-group-node--dragging" : ""
      } ${draggingOverlay ? "ghost-group-node--overlay" : ""}`}
    >
      <div
        className={`ghost-group-header group/g flex items-center gap-2 ps-2.5 pe-2 py-2 select-none ${
          collapsed ? "ghost-group-header--collapsed" : ""
        }`}
      >
        <button
          type="button"
          className="ghost-group-drag-handle flex-shrink-0 -ms-1 flex items-center justify-center w-4 self-center rounded text-ghost-text-muted/35 hover:text-ghost-text-secondary cursor-grab active:cursor-grabbing touch-none opacity-0 group-hover/g:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 ease-out"
          aria-label={t("reorderGroup")}
          title={t("reorderGroup")}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => toggleCollapsed(group.id)}
          className="flex-shrink-0 -m-1 p-1 rounded-md hover:bg-ghost-surface-hover transition-colors"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandGroup") : t("collapseGroup")}
        >
          <ChevronDown
            size={12}
            className={`ghost-group-chevron text-ghost-text-muted/80 transition-transform duration-200 ${
              collapsed ? "-rotate-90 rtl:rotate-90" : ""
            }`}
          />
        </button>
        <span className="ghost-group-marker flex-shrink-0" aria-hidden="true" />
        {isEditing ? (
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitRename}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setDraft(group.name);
                setIsEditing(false);
              }
            }}
            className="flex-1 min-w-0 bg-ghost-surface border border-ghost-border-subtle rounded-md px-2 py-1 text-[13px] font-medium text-ghost-text-primary focus:outline-none focus:border-ghost-text-secondary"
          />
        ) : (
          <>
            <button
              type="button"
              onClick={openBroadcast}
              className="flex-1 min-w-0 text-start truncate text-[12.5px] font-semibold tracking-wide text-ghost-text-secondary group-hover/g:text-ghost-text-primary transition-colors cursor-pointer"
              title={t("broadcastOpenGroup")}
            >
              {group.name}
            </button>
            <div className="relative flex items-center justify-end flex-shrink-0 self-center">
              <span
                className="ghost-group-stat inline-flex items-center gap-1 text-[11px] font-medium tabular-nums leading-none px-1.5 py-0.5 rounded-full text-ghost-text-secondary border border-ghost-border-subtle bg-ghost-surface/40 transition-opacity duration-150 group-hover/g:opacity-0"
                title={t("conversationsCount").replace("{count}", String(count))}
              >
                <Video size={10} aria-hidden="true" />
                <span>{count}</span>
              </span>
              <div className="ghost-group-actions absolute inset-y-0 end-0 flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openBroadcast();
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors"
                aria-label={t("broadcastOpenGroup")}
                title={t("broadcastOpenGroup")}
              >
                <Radio size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(group.name);
                  setIsEditing(true);
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors"
                aria-label={t("renameGroup")}
                title={t("renameGroup")}
              >
                <MoreHorizontal size={12} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-error/10 transition-colors"
                aria-label={t("deleteGroup")}
                title={t("deleteGroup")}
              >
                <Trash2 size={12} />
              </button>
              </div>
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div
          ref={setDropRef}
          className={`ghost-group-body ${isOver ? "ghost-drop-active" : ""}`}
        >
          <SortableContext
            id={containerId}
            items={group.conversation_ids}
            strategy={verticalListSortingStrategy}
          >
            {groupConversations.length === 0 ? (
              <div className="ghost-group-empty mx-2 my-1 px-3 py-2 rounded-md text-[12px] text-ghost-text-muted/75 leading-relaxed text-center">
                {t("emptyGroupHint")}
              </div>
            ) : (
              <div className="space-y-1.5">
                {groupConversations.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === activeConversationId}
                    onSelect={() => onSelect(c.id)}
                    onDelete={() => onDelete(c.id)}
                    onRename={(title) => onRename(c.id, title)}
                    indentLevel={0}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </div>
      )}

    </div>
  );
}
