import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Conversation } from "../../types/api";
import { UNASSIGNED_CONTAINER } from "../../utils/conversationGroups";
import ConversationItem from "./ConversationItem";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  emptyLabel?: string;
}

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onDelete,
  onRename,
  emptyLabel,
}: ConversationListProps) {
  const ids = useMemo(() => conversations.map((c) => c.id), [conversations]);
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_CONTAINER });

  return (
    <SortableContext
      id={UNASSIGNED_CONTAINER}
      items={ids}
      strategy={verticalListSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={`space-y-1 rounded-lg ${isOver ? "ghost-drop-active" : ""}`}
      >
        {conversations.length > 0 ? (
          conversations.map((c) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              isActive={c.id === activeConversationId}
              onSelect={() => onSelect(c.id)}
              onDelete={() => onDelete(c.id)}
              onRename={(title) => onRename(c.id, title)}
            />
          ))
        ) : emptyLabel ? (
          <div className="ghost-unassigned-empty mx-1 my-1 px-3 py-3 rounded-lg border border-dashed border-ghost-border-subtle/70 text-[11.5px] text-ghost-text-muted/60 leading-relaxed text-center">
            {emptyLabel}
          </div>
        ) : null}
      </div>
    </SortableContext>
  );
}
