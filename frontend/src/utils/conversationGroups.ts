import type { Conversation } from "../types/api";

export interface ConversationGroup {
  id: string;
  area_id: string;
  name: string;
  conversation_ids: string[];
  collapsed?: boolean;
  created_at: string;
}

export interface ConversationArea {
  id: string;
  name: string;
  group_ids: string[];
  direct_conversation_ids: string[];
  collapsed?: boolean;
  created_at: string;
}

export interface ConversationGroupsState {
  areas: ConversationArea[];
  groups: ConversationGroup[];
}

const STATE_KEY = (userId: string) => `ghost-conversation-groups-${userId}`;

export function loadGroupsState(userId: string): ConversationGroupsState {
  if (!userId) return { areas: [], groups: [] };
  try {
    const raw = localStorage.getItem(STATE_KEY(userId));
    if (!raw) return { areas: [], groups: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { areas: [], groups: [] };
    const areas = Array.isArray(parsed.areas) ? parsed.areas : [];
    const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
    return {
      areas: areas.filter((a: unknown) => isValidArea(a)),
      groups: groups.filter((g: unknown) => isValidGroup(g)),
    };
  } catch {
    return { areas: [], groups: [] };
  }
}

export function saveGroupsState(
  userId: string,
  state: ConversationGroupsState,
): void {
  if (!userId) return;
  try {
    localStorage.setItem(STATE_KEY(userId), JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

function isValidArea(a: unknown): a is ConversationArea {
  return (
    !!a &&
    typeof a === "object" &&
    typeof (a as ConversationArea).id === "string" &&
    typeof (a as ConversationArea).name === "string" &&
    Array.isArray((a as ConversationArea).group_ids) &&
    Array.isArray((a as ConversationArea).direct_conversation_ids)
  );
}

function isValidGroup(g: unknown): g is ConversationGroup {
  return (
    !!g &&
    typeof g === "object" &&
    typeof (g as ConversationGroup).id === "string" &&
    typeof (g as ConversationGroup).name === "string" &&
    typeof (g as ConversationGroup).area_id === "string" &&
    Array.isArray((g as ConversationGroup).conversation_ids)
  );
}

export interface GroupAssignment {
  areaId: string | null;
  groupId: string | null;
}

export function assignmentFor(
  conversationId: string,
  state: ConversationGroupsState,
): GroupAssignment {
  for (const group of state.groups) {
    if (group.conversation_ids.includes(conversationId)) {
      return { areaId: group.area_id, groupId: group.id };
    }
  }
  for (const area of state.areas) {
    if (area.direct_conversation_ids.includes(conversationId)) {
      return { areaId: area.id, groupId: null };
    }
  }
  return { areaId: null, groupId: null };
}

export function listUnassigned(
  conversations: Conversation[],
  state: ConversationGroupsState,
): Conversation[] {
  const assigned = new Set<string>();
  for (const g of state.groups) g.conversation_ids.forEach((id) => assigned.add(id));
  for (const a of state.areas)
    a.direct_conversation_ids.forEach((id) => assigned.add(id));
  return conversations.filter((c) => !assigned.has(c.id));
}

export function countAreaConversations(
  area: ConversationArea,
  state: ConversationGroupsState,
): number {
  const groupCount = state.groups
    .filter((g) => g.area_id === area.id)
    .reduce((sum, g) => sum + g.conversation_ids.length, 0);
  return area.direct_conversation_ids.length + groupCount;
}

export function countGroupConversations(group: ConversationGroup): number {
  return group.conversation_ids.length;
}

/** Every conversation id that belongs to an area: its direct conversations
 * plus all conversations nested inside the area's groups. */
export function conversationIdsForArea(
  area: ConversationArea,
  state: ConversationGroupsState,
): string[] {
  const ids = [...area.direct_conversation_ids];
  for (const g of state.groups) {
    if (g.area_id === area.id) ids.push(...g.conversation_ids);
  }
  return Array.from(new Set(ids));
}

/** Conversation ids belonging to a single group. */
export function conversationIdsForGroup(group: ConversationGroup): string[] {
  return Array.from(new Set(group.conversation_ids));
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/* ── Drag-and-drop container identity ──────────────────────────────────────
   Each draggable conversation lives in exactly one "container". Containers are
   addressed by a stable string id so a single DndContext can move items between
   the unassigned list, an area's direct list, and any group. */

export const UNASSIGNED_CONTAINER = "unassigned";

export function areaContainerId(areaId: string): string {
  return `area:${areaId}`;
}

export function groupContainerId(groupId: string): string {
  return `group:${groupId}`;
}

/* Group headers are themselves sortable items (to reorder groups inside an
   area). They share the single DndContext with conversations, so they use a
   distinct id namespace to avoid colliding with conversation ids. */

export function areaGroupsContainerId(areaId: string): string {
  return `areagroups:${areaId}`;
}

export function groupSortableId(groupId: string): string {
  return `groupitem:${groupId}`;
}

export function parseGroupSortableId(id: string): string | null {
  return id.startsWith("groupitem:") ? id.slice("groupitem:".length) : null;
}

export type ContainerTarget =
  | { type: "unassigned" }
  | { type: "area"; id: string }
  | { type: "group"; id: string };

export function parseContainerId(containerId: string): ContainerTarget | null {
  if (containerId === UNASSIGNED_CONTAINER) return { type: "unassigned" };
  if (containerId.startsWith("area:")) {
    return { type: "area", id: containerId.slice("area:".length) };
  }
  if (containerId.startsWith("group:")) {
    return { type: "group", id: containerId.slice("group:".length) };
  }
  return null;
}
