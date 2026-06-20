import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Conversation } from "../../types/api";
import {
  UNASSIGNED_CONTAINER,
  areaContainerId,
  groupContainerId,
  listUnassigned,
  parseContainerId,
  parseGroupSortableId,
} from "../../utils/conversationGroups";
import { useConversationGroupsStore } from "../../stores/conversationGroupsStore";
import { useConversationStore } from "../../stores/conversationStore";
import { useT } from "../../utils/i18n";
import AreaNode from "./AreaNode";
import GroupNode from "./GroupNode";
import ConversationList from "./ConversationList";
import ConversationItem from "./ConversationItem";

interface ConversationGroupsTreeProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  userId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export default function ConversationGroupsTree({
  conversations,
  activeConversationId,
  userId,
  onSelect,
  onDelete,
  onRename,
}: ConversationGroupsTreeProps) {
  const t = useT();
  const areas = useConversationGroupsStore((s) => s.areas);
  const groups = useConversationGroupsStore((s) => s.groups);
  const storeUserId = useConversationGroupsStore((s) => s.userId);
  const loadForUser = useConversationGroupsStore((s) => s.loadForUser);
  const createArea = useConversationGroupsStore((s) => s.createArea);
  const assignConversation = useConversationGroupsStore(
    (s) => s.assignConversation,
  );
  const unassignConversation = useConversationGroupsStore(
    (s) => s.unassignConversation,
  );
  const reorderGroupConversations = useConversationGroupsStore(
    (s) => s.reorderGroupConversations,
  );
  const reorderAreaConversations = useConversationGroupsStore(
    (s) => s.reorderAreaConversations,
  );
  const reorderAreaGroups = useConversationGroupsStore(
    (s) => s.reorderAreaGroups,
  );
  const moveGroupToArea = useConversationGroupsStore((s) => s.moveGroupToArea);
  const reorderConversations = useConversationStore(
    (s) => s.reorderConversations,
  );

  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [areaDraft, setAreaDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (storeUserId !== userId) loadForUser(userId);
  }, [userId, storeUserId, loadForUser]);

  const conversationsById = useMemo(
    () => new Map(conversations.map((c) => [c.id, c])),
    [conversations],
  );

  const groupsByArea = useMemo(() => {
    const map = new Map<string, typeof groups>();
    for (const area of areas) map.set(area.id, []);
    for (const g of groups) {
      const list = map.get(g.area_id);
      if (list) list.push(g);
    }
    for (const area of areas) {
      const list = map.get(area.id);
      if (!list) continue;
      list.sort(
        (a, b) => area.group_ids.indexOf(a.id) - area.group_ids.indexOf(b.id),
      );
    }
    return map;
  }, [areas, groups]);

  const unassigned = useMemo(
    () => listUnassigned(conversations, { areas, groups }),
    [conversations, areas, groups],
  );

  // Ordered conversation ids per drag container.
  const containerItems = useMemo(() => {
    const map = new Map<string, string[]>();
    map.set(
      UNASSIGNED_CONTAINER,
      unassigned.map((c) => c.id),
    );
    for (const a of areas) {
      map.set(areaContainerId(a.id), a.direct_conversation_ids);
    }
    for (const g of groups) {
      map.set(groupContainerId(g.id), g.conversation_ids);
    }
    return map;
  }, [unassigned, areas, groups]);

  const hasOrganization = areas.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const submitNewArea = () => {
    const trimmed = areaDraft.trim();
    if (trimmed) createArea(trimmed);
    setAreaDraft("");
    setIsCreatingArea(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragCancel = () => setActiveId(null);

  // Reorder the unassigned subset while keeping every assigned conversation in
  // its current global slot — avoids dropping assigned items from the store.
  const reorderUnassigned = (nextUnassignedIds: string[]) => {
    const globalIds = conversations.map((c) => c.id);
    const unassignedSet = new Set(unassigned.map((c) => c.id));
    let cursor = 0;
    const nextGlobal = globalIds.map((id) =>
      unassignedSet.has(id) ? nextUnassignedIds[cursor++] ?? id : id,
    );
    reorderConversations(nextGlobal);
  };

  const reorderWithinContainer = (
    containerId: string,
    activeConvId: string,
    overConvId: string,
  ) => {
    const items = containerItems.get(containerId) ?? [];
    const oldIndex = items.indexOf(activeConvId);
    const newIndex = items.indexOf(overConvId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    const target = parseContainerId(containerId);
    if (!target) return;
    if (target.type === "group") reorderGroupConversations(target.id, next);
    else if (target.type === "area") reorderAreaConversations(target.id, next);
    else reorderUnassigned(next);
  };

  const moveToContainer = (
    convId: string,
    containerId: string,
    index: number,
  ) => {
    const target = parseContainerId(containerId);
    if (!target) return;
    if (target.type === "group") {
      assignConversation(convId, { areaId: null, groupId: target.id, index });
    } else if (target.type === "area") {
      assignConversation(convId, { areaId: target.id, groupId: null, index });
    } else {
      unassignConversation(convId);
    }
  };

  // Reorder groups within an area, or move a group to a different area, based
  // on which group the dragged group was dropped over.
  const handleGroupDragEnd = (
    activeGroupId: string,
    overData: DragEndEvent["over"],
  ) => {
    if (!overData) return;
    const overGroupId =
      (overData.data.current?.type === "group"
        ? (overData.data.current.groupId as string)
        : null) ?? parseGroupSortableId(String(overData.id));
    if (!overGroupId || overGroupId === activeGroupId) return;

    const sourceArea = areas.find((a) => a.group_ids.includes(activeGroupId));
    const targetArea = areas.find((a) => a.group_ids.includes(overGroupId));
    if (!sourceArea || !targetArea) return;

    if (sourceArea.id === targetArea.id) {
      const oldIndex = sourceArea.group_ids.indexOf(activeGroupId);
      const newIndex = sourceArea.group_ids.indexOf(overGroupId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      reorderAreaGroups(
        sourceArea.id,
        arrayMove(sourceArea.group_ids, oldIndex, newIndex),
      );
    } else {
      const index = targetArea.group_ids.indexOf(overGroupId);
      moveGroupToArea(activeGroupId, targetArea.id, index);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    if (active.data.current?.type === "group") {
      const activeGroupId =
        (active.data.current.groupId as string) ??
        parseGroupSortableId(String(active.id));
      if (activeGroupId) handleGroupDragEnd(activeGroupId, over);
      return;
    }

    const activeConvId = String(active.id);
    const activeContainer = active.data.current?.sortable?.containerId;
    const overContainer =
      over.data.current?.sortable?.containerId ?? String(over.id);

    if (typeof activeContainer !== "string" || typeof overContainer !== "string") {
      return;
    }

    if (activeContainer === overContainer) {
      if (activeConvId === String(over.id)) return;
      reorderWithinContainer(activeContainer, activeConvId, String(over.id));
      return;
    }

    const targetItems = containerItems.get(overContainer) ?? [];
    let index = targetItems.length;
    if (over.data.current?.sortable) {
      const overIndex = targetItems.indexOf(String(over.id));
      if (overIndex >= 0) index = overIndex;
    }
    moveToContainer(activeConvId, overContainer, index);
  };

  const draggingGroupId = activeId ? parseGroupSortableId(activeId) : null;
  const draggingGroup = draggingGroupId
    ? groups.find((g) => g.id === draggingGroupId) ?? null
    : null;
  const draggingConversation =
    activeId && !draggingGroupId
      ? conversationsById.get(activeId) ?? null
      : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="ghost-groups-tree">
        <div className="ghost-groups-toolbar flex items-center gap-3 px-2 pt-3 pb-2">
          <span className="font-he text-[11px] font-semibold tracking-[0.02em] text-ghost-text-muted whitespace-nowrap">
            {t("organizeConversations")}
          </span>
          <span className="flex-1 h-px bg-ghost-border-subtle" />
          <button
            type="button"
            onClick={() => setIsCreatingArea(true)}
            className="ghost-groups-add-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium text-ghost-text-secondary hover:text-ghost-text-primary hover:bg-ghost-surface-hover transition-colors flex-shrink-0"
            aria-label={t("addArea")}
            title={t("addArea")}
          >
            <Plus size={12} />
            <span>{t("addArea")}</span>
          </button>
        </div>

        {isCreatingArea && (
          <div className="px-1 mb-3">
            <input
              value={areaDraft}
              autoFocus
              placeholder={t("newAreaPlaceholder")}
              onChange={(e) => setAreaDraft(e.target.value)}
              onBlur={() => {
                if (areaDraft.trim()) submitNewArea();
                else {
                  setAreaDraft("");
                  setIsCreatingArea(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewArea();
                if (e.key === "Escape") {
                  setAreaDraft("");
                  setIsCreatingArea(false);
                }
              }}
              className="w-full bg-ghost-surface border border-ghost-border-subtle focus:border-ghost-text-secondary rounded-lg px-3 py-2 text-[13px] font-medium text-ghost-text-primary focus:outline-none"
            />
          </div>
        )}

        {areas.length > 0 && (
          <div className="ghost-areas-list space-y-2.5">
            {areas.map((area) => (
              <AreaNode
                key={area.id}
                area={area}
                groupsForArea={groupsByArea.get(area.id) ?? []}
                conversationsById={conversationsById}
                activeConversationId={activeConversationId}
                onSelect={onSelect}
                onDelete={onDelete}
                onRename={onRename}
                dragActive={!!activeId}
              />
            ))}
          </div>
        )}

        {hasOrganization && (
          <div className="ghost-groups-section-divider mt-5 mb-2 px-2 flex items-center gap-3">
            <span className="font-he text-[11px] font-semibold tracking-[0.02em] text-ghost-text-muted whitespace-nowrap">
              {t("unassignedConversations")}
            </span>
            {unassigned.length > 0 && (
              <span className="tabular-nums font-mono text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-ghost-surface text-ghost-text-secondary">
                {unassigned.length}
              </span>
            )}
            <span className="flex-1 h-px bg-ghost-border-subtle" />
          </div>
        )}

        {unassigned.length > 0 || hasOrganization ? (
          <ConversationList
            conversations={unassigned}
            activeConversationId={activeConversationId}
            onSelect={onSelect}
            onDelete={onDelete}
            onRename={onRename}
            emptyLabel={
              hasOrganization && unassigned.length === 0
                ? t("dropHereToUnassign")
                : undefined
            }
          />
        ) : null}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 180,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {draggingConversation ? (
          <ConversationItem
            conversation={draggingConversation}
            isActive={draggingConversation.id === activeConversationId}
            onSelect={() => {}}
            onDelete={() => {}}
            onRename={() => {}}
            draggingOverlay
          />
        ) : draggingGroup ? (
          <GroupNode
            group={draggingGroup}
            conversationsById={conversationsById}
            activeConversationId={activeConversationId}
            onSelect={() => {}}
            onDelete={() => {}}
            onRename={() => {}}
            draggingOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
