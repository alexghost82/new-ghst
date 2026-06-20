import { useMemo, useState } from "react";
import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  Video,
  Layers,
  Trash2,
  Radio,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Conversation } from "../../types/api";
import {
  areaContainerId,
  areaGroupsContainerId,
  countAreaConversations,
  groupSortableId,
  type ConversationArea,
  type ConversationGroup,
} from "../../utils/conversationGroups";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useBroadcastStore } from "../../stores/broadcastStore";
import { useUserStore } from "../../stores/userStore";
import { useT } from "../../utils/i18n";
import ConversationItem from "./ConversationItem";
import GroupNode from "./GroupNode";

interface AreaNodeProps {
  area: ConversationArea;
  groupsForArea: ConversationGroup[];
  conversationsById: Map<string, Conversation>;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  dragActive?: boolean;
}

export default function AreaNode({
  area,
  groupsForArea,
  conversationsById,
  activeConversationId,
  onSelect,
  onDelete,
  onRename,
  dragActive = false,
}: AreaNodeProps) {
  const t = useT();
  const toggleCollapsed = useConversationGroupsStore(
    (s) => s.toggleAreaCollapsed,
  );
  const deleteArea = useConversationGroupsStore((s) => s.deleteArea);
  const renameArea = useConversationGroupsStore((s) => s.renameArea);
  const createGroup = useConversationGroupsStore((s) => s.createGroup);
  const allGroups = useConversationGroupsStore((s) => s.groups);
  const allAreas = useConversationGroupsStore((s) => s.areas);
  const openBroadcastScope = useBroadcastStore((s) => s.openScope);
  const activeUserId = useUserStore((s) => s.activeUserId);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(area.name);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState("");

  const directContainerId = areaContainerId(area.id);
  const { setNodeRef: setDirectRef, isOver: directOver } = useDroppable({
    id: directContainerId,
  });

  const directConvs = useMemo(
    () =>
      area.direct_conversation_ids
        .map((id) => conversationsById.get(id))
        .filter((c): c is Conversation => !!c),
    [area.direct_conversation_ids, conversationsById],
  );

  const totalCount = countAreaConversations(area, {
    areas: allAreas,
    groups: allGroups,
  });
  const groupCount = groupsForArea.length;
  const collapsed = !!area.collapsed;

  const submitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== area.name) renameArea(area.id, trimmed);
    setIsEditing(false);
  };

  const submitNewGroup = () => {
    const trimmed = groupDraft.trim();
    if (trimmed) createGroup(area.id, trimmed);
    setGroupDraft("");
    setIsAddingGroup(false);
  };

  const handleDelete = () => {
    if (confirm(t("confirmDeleteArea"))) deleteArea(area.id);
  };

  const openBroadcast = () => {
    if (activeUserId) {
      openBroadcastScope({ type: "area", id: area.id, name: area.name }, activeUserId);
    }
  };

  return (
    <div className="ghost-area-node">
      <div
        className={`ghost-area-header group/a flex items-center gap-2.5 ps-3 pe-2 py-2.5 select-none ${
          collapsed ? "ghost-area-header--collapsed" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => toggleCollapsed(area.id)}
          className="flex-shrink-0 -m-1 p-1 rounded-md hover:bg-ghost-surface-hover transition-colors"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expandArea") : t("collapseArea")}
        >
          <ChevronDown
            size={14}
            className={`ghost-area-chevron text-ghost-text-muted transition-transform duration-200 ${
              collapsed ? "-rotate-90 rtl:rotate-90" : ""
            }`}
          />
        </button>
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
                setDraft(area.name);
                setIsEditing(false);
              }
            }}
            className="flex-1 min-w-0 bg-ghost-surface border border-ghost-border-subtle rounded-md px-2.5 py-1.5 text-[14px] font-semibold text-ghost-text-primary focus:outline-none focus:border-ghost-text-secondary"
          />
        ) : (
          <>
            <button
              type="button"
              onClick={openBroadcast}
              className="flex-1 min-w-0 text-start truncate text-[14px] font-semibold text-ghost-text-primary hover:text-ghost-text-primary transition-colors cursor-pointer"
              title={t("broadcastOpenArea")}
            >
              {area.name}
            </button>

            <div className="relative flex items-center justify-end flex-shrink-0 self-center">
              <span
                className="ghost-area-stat inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums leading-none px-2 py-0.5 rounded-full text-ghost-text-secondary border border-ghost-border-subtle bg-ghost-surface/60 transition-opacity duration-150 group-hover/a:opacity-0"
                title={`${groupCount > 0 ? t("groupsCount").replace("{count}", String(groupCount)) + " · " : ""}${t("conversationsCount").replace("{count}", String(totalCount))}`}
              >
                <Video size={11} aria-hidden="true" />
                <span>{totalCount}</span>
                {groupCount > 0 && (
                  <>
                    <span
                      className="w-px h-3 bg-ghost-border-subtle/80 mx-0.5"
                      aria-hidden="true"
                    />
                    <span className="inline-flex items-center gap-0.5 text-ghost-text-muted/85">
                      <Layers size={10} aria-hidden="true" />
                      {groupCount}
                    </span>
                  </>
                )}
              </span>

              <div className="ghost-area-actions absolute inset-y-0 end-0 flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openBroadcast();
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors"
                aria-label={t("broadcastOpenArea")}
                title={t("broadcastOpenArea")}
              >
                <Radio size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingGroup(true);
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors"
                aria-label={t("addGroup")}
                title={t("addGroup")}
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft(area.name);
                  setIsEditing(true);
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors"
                aria-label={t("renameArea")}
                title={t("renameArea")}
              >
                <MoreHorizontal size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="p-1.5 rounded-md text-ghost-text-muted hover:text-ghost-error hover:bg-ghost-error/10 transition-colors"
                aria-label={t("deleteArea")}
                title={t("deleteArea")}
              >
                <Trash2 size={13} />
              </button>
              </div>
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="ghost-area-body">
          {isAddingGroup && (
            <div
              className="ghost-area-new-group mx-2 mb-2 px-2.5 py-2 rounded-lg border border-ghost-border-subtle bg-ghost-surface/40 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Layers size={12} className="text-ghost-text-muted flex-shrink-0" />
              <input
                value={groupDraft}
                autoFocus
                placeholder={t("newGroupPlaceholder")}
                onChange={(e) => setGroupDraft(e.target.value)}
                onBlur={() => {
                  if (groupDraft.trim()) submitNewGroup();
                  else {
                    setGroupDraft("");
                    setIsAddingGroup(false);
                  }
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") submitNewGroup();
                  if (e.key === "Escape") {
                    setGroupDraft("");
                    setIsAddingGroup(false);
                  }
                }}
                className="flex-1 min-w-0 bg-transparent border-0 px-0 py-0.5 text-[13px] text-ghost-text-primary placeholder:text-ghost-text-muted/60 focus:outline-none"
              />
            </div>
          )}

          {groupsForArea.length > 0 && (
            <SortableContext
              id={areaGroupsContainerId(area.id)}
              items={groupsForArea.map((g) => groupSortableId(g.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="ghost-area-groups space-y-2">
                {groupsForArea.map((group) => (
                  <GroupNode
                    key={group.id}
                    group={group}
                    conversationsById={conversationsById}
                    activeConversationId={activeConversationId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onRename={onRename}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          <div
            ref={setDirectRef}
            className={`ghost-area-direct ${directOver ? "ghost-drop-active" : ""}`}
          >
            {groupsForArea.length > 0 && directConvs.length > 0 && (
              <div className="ghost-area-direct-label ps-3 pe-2 pt-2.5 pb-1.5 font-mono text-[9px] tracking-[0.22em] uppercase text-ghost-text-muted">
                {t("directInArea")}
              </div>
            )}
            <SortableContext
              id={directContainerId}
              items={area.direct_conversation_ids}
              strategy={verticalListSortingStrategy}
            >
              {directConvs.length > 0 ? (
                <div className="space-y-1.5 px-1">
                  {directConvs.map((c) => (
                    <ConversationItem
                      key={c.id}
                      conversation={c}
                      isActive={c.id === activeConversationId}
                      onSelect={() => onSelect(c.id)}
                      onDelete={() => onDelete(c.id)}
                      onRename={(title) => onRename(c.id, title)}
                      indentLevel={1}
                    />
                  ))}
                </div>
              ) : groupsForArea.length === 0 && !isAddingGroup ? (
                <div className="ghost-area-empty mx-2 my-1.5 px-3 py-3 rounded-lg border border-dashed border-ghost-border-subtle/80 text-[12px] text-ghost-text-muted/75 leading-relaxed text-center">
                  {t("emptyAreaHint")}
                </div>
              ) : dragActive ? (
                <div className="ghost-area-drop-spacer mx-2 my-1" aria-hidden="true" />
              ) : null}
            </SortableContext>
          </div>
        </div>
      )}
    </div>
  );
}
