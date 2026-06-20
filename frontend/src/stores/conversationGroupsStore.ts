import { create } from "zustand";
import {
  loadGroupsState,
  saveGroupsState,
  newId,
  type ConversationArea,
  type ConversationGroup,
  type ConversationGroupsState,
} from "../utils/conversationGroups";

interface GroupsStoreState extends ConversationGroupsState {
  userId: string | null;
  loadForUser: (userId: string) => void;
  reset: () => void;

  createArea: (name: string) => ConversationArea | null;
  renameArea: (areaId: string, name: string) => void;
  deleteArea: (areaId: string) => void;
  toggleAreaCollapsed: (areaId: string) => void;

  createGroup: (areaId: string, name: string) => ConversationGroup | null;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  reorderAreaGroups: (areaId: string, orderedGroupIds: string[]) => void;
  moveGroupToArea: (
    groupId: string,
    targetAreaId: string,
    index?: number,
  ) => void;

  assignConversation: (
    conversationId: string,
    target: {
      areaId: string | null;
      groupId: string | null;
      index?: number;
    },
  ) => void;
  unassignConversation: (conversationId: string) => void;

  reorderAreaConversations: (areaId: string, orderedIds: string[]) => void;
  reorderGroupConversations: (groupId: string, orderedIds: string[]) => void;

  /** If the conversation is assigned to a group or area, move it to the front
   *  of that container (preserving the order of the rest). No-op for
   *  unassigned conversations — their ordering lives in the flat list. */
  bumpConversationWithinContainer: (conversationId: string) => void;
}

const EMPTY: ConversationGroupsState = { areas: [], groups: [] };

function persist(userId: string | null, state: ConversationGroupsState) {
  if (!userId) return;
  saveGroupsState(userId, state);
}

function removeFromAllAssignments(
  conversationId: string,
  state: ConversationGroupsState,
): ConversationGroupsState {
  return {
    areas: state.areas.map((a) => ({
      ...a,
      direct_conversation_ids: a.direct_conversation_ids.filter(
        (id) => id !== conversationId,
      ),
    })),
    groups: state.groups.map((g) => ({
      ...g,
      conversation_ids: g.conversation_ids.filter((id) => id !== conversationId),
    })),
  };
}

export const useConversationGroupsStore = create<GroupsStoreState>(
  (set, get) => ({
    ...EMPTY,
    userId: null,

    loadForUser: (userId) => {
      const loaded = loadGroupsState(userId);
      set({ userId, areas: loaded.areas, groups: loaded.groups });
    },

    reset: () => {
      set({ userId: null, areas: [], groups: [] });
    },

    createArea: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const area: ConversationArea = {
        id: newId("area"),
        name: trimmed,
        group_ids: [],
        direct_conversation_ids: [],
        collapsed: false,
        created_at: new Date().toISOString(),
      };
      const next: ConversationGroupsState = {
        areas: [...get().areas, area],
        groups: get().groups,
      };
      set({ areas: next.areas });
      persist(get().userId, next);
      return area;
    },

    renameArea: (areaId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const areas = get().areas.map((a) =>
        a.id === areaId ? { ...a, name: trimmed } : a,
      );
      set({ areas });
      persist(get().userId, { areas, groups: get().groups });
    },

    deleteArea: (areaId) => {
      const groups = get().groups.filter((g) => g.area_id !== areaId);
      const areas = get().areas.filter((a) => a.id !== areaId);
      set({ areas, groups });
      persist(get().userId, { areas, groups });
    },

    toggleAreaCollapsed: (areaId) => {
      const areas = get().areas.map((a) =>
        a.id === areaId ? { ...a, collapsed: !a.collapsed } : a,
      );
      set({ areas });
      persist(get().userId, { areas, groups: get().groups });
    },

    createGroup: (areaId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const area = get().areas.find((a) => a.id === areaId);
      if (!area) return null;
      const group: ConversationGroup = {
        id: newId("grp"),
        area_id: areaId,
        name: trimmed,
        conversation_ids: [],
        collapsed: false,
        created_at: new Date().toISOString(),
      };
      const groups = [...get().groups, group];
      const areas = get().areas.map((a) =>
        a.id === areaId ? { ...a, group_ids: [...a.group_ids, group.id] } : a,
      );
      set({ areas, groups });
      persist(get().userId, { areas, groups });
      return group;
    },

    renameGroup: (groupId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const groups = get().groups.map((g) =>
        g.id === groupId ? { ...g, name: trimmed } : g,
      );
      set({ groups });
      persist(get().userId, { areas: get().areas, groups });
    },

    deleteGroup: (groupId) => {
      const group = get().groups.find((g) => g.id === groupId);
      if (!group) return;
      const groups = get().groups.filter((g) => g.id !== groupId);
      const areas = get().areas.map((a) =>
        a.id === group.area_id
          ? { ...a, group_ids: a.group_ids.filter((id) => id !== groupId) }
          : a,
      );
      set({ areas, groups });
      persist(get().userId, { areas, groups });
    },

    toggleGroupCollapsed: (groupId) => {
      const groups = get().groups.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
      );
      set({ groups });
      persist(get().userId, { areas: get().areas, groups });
    },

    reorderAreaGroups: (areaId, orderedGroupIds) => {
      const area = get().areas.find((a) => a.id === areaId);
      if (!area) return;
      // Keep only ids that still belong to this area, then append any
      // missing ones so nothing is silently dropped.
      const existing = new Set(area.group_ids);
      const ordered = orderedGroupIds.filter((id) => existing.has(id));
      for (const id of area.group_ids) {
        if (!ordered.includes(id)) ordered.push(id);
      }
      const areas = get().areas.map((a) =>
        a.id === areaId ? { ...a, group_ids: ordered } : a,
      );
      set({ areas });
      persist(get().userId, { areas, groups: get().groups });
    },

    moveGroupToArea: (groupId, targetAreaId, index) => {
      const group = get().groups.find((g) => g.id === groupId);
      const targetArea = get().areas.find((a) => a.id === targetAreaId);
      if (!group || !targetArea) return;
      if (group.area_id === targetAreaId) return;

      const groups = get().groups.map((g) =>
        g.id === groupId ? { ...g, area_id: targetAreaId } : g,
      );
      const areas = get().areas.map((a) => {
        if (a.id === group.area_id) {
          return {
            ...a,
            group_ids: a.group_ids.filter((id) => id !== groupId),
          };
        }
        if (a.id === targetAreaId) {
          const next = a.group_ids.filter((id) => id !== groupId);
          const at =
            index == null
              ? next.length
              : Math.max(0, Math.min(index, next.length));
          next.splice(at, 0, groupId);
          return { ...a, group_ids: next };
        }
        return a;
      });
      set({ areas, groups });
      persist(get().userId, { areas, groups });
    },

    assignConversation: (conversationId, target) => {
      const cleaned = removeFromAllAssignments(conversationId, {
        areas: get().areas,
        groups: get().groups,
      });
      let { areas, groups } = cleaned;

      const insertAt = (ids: string[]): string[] => {
        const next = [...ids];
        const at =
          target.index == null
            ? next.length
            : Math.max(0, Math.min(target.index, next.length));
        next.splice(at, 0, conversationId);
        return next;
      };

      if (target.groupId) {
        const group = groups.find((g) => g.id === target.groupId);
        if (!group) {
          set({ areas, groups });
          persist(get().userId, { areas, groups });
          return;
        }
        groups = groups.map((g) =>
          g.id === target.groupId
            ? { ...g, conversation_ids: insertAt(g.conversation_ids) }
            : g,
        );
      } else if (target.areaId) {
        const area = areas.find((a) => a.id === target.areaId);
        if (!area) {
          set({ areas, groups });
          persist(get().userId, { areas, groups });
          return;
        }
        areas = areas.map((a) =>
          a.id === target.areaId
            ? { ...a, direct_conversation_ids: insertAt(a.direct_conversation_ids) }
            : a,
        );
      }

      set({ areas, groups });
      persist(get().userId, { areas, groups });
    },

    unassignConversation: (conversationId) => {
      const cleaned = removeFromAllAssignments(conversationId, {
        areas: get().areas,
        groups: get().groups,
      });
      set({ areas: cleaned.areas, groups: cleaned.groups });
      persist(get().userId, cleaned);
    },

    reorderAreaConversations: (areaId, orderedIds) => {
      const areas = get().areas.map((a) =>
        a.id === areaId
          ? { ...a, direct_conversation_ids: orderedIds }
          : a,
      );
      set({ areas });
      persist(get().userId, { areas, groups: get().groups });
    },

    reorderGroupConversations: (groupId, orderedIds) => {
      const groups = get().groups.map((g) =>
        g.id === groupId ? { ...g, conversation_ids: orderedIds } : g,
      );
      set({ groups });
      persist(get().userId, { areas: get().areas, groups });
    },

    bumpConversationWithinContainer: (conversationId) => {
      const groups = get().groups;
      const areas = get().areas;
      const inGroup = groups.find((g) =>
        g.conversation_ids.includes(conversationId),
      );
      if (inGroup) {
        if (inGroup.conversation_ids[0] === conversationId) return;
        const nextGroups = groups.map((g) =>
          g.id === inGroup.id
            ? {
                ...g,
                conversation_ids: [
                  conversationId,
                  ...g.conversation_ids.filter((id) => id !== conversationId),
                ],
              }
            : g,
        );
        set({ groups: nextGroups });
        persist(get().userId, { areas, groups: nextGroups });
        return;
      }
      const inArea = areas.find((a) =>
        a.direct_conversation_ids.includes(conversationId),
      );
      if (inArea) {
        if (inArea.direct_conversation_ids[0] === conversationId) return;
        const nextAreas = areas.map((a) =>
          a.id === inArea.id
            ? {
                ...a,
                direct_conversation_ids: [
                  conversationId,
                  ...a.direct_conversation_ids.filter(
                    (id) => id !== conversationId,
                  ),
                ],
              }
            : a,
        );
        set({ areas: nextAreas });
        persist(get().userId, { areas: nextAreas, groups });
      }
    },
  }),
);
