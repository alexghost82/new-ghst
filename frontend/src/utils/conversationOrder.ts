import type { Conversation } from "../types/api";

const storageKey = (userId: string) => `ghost-conversation-order-${userId}`;

export function loadConversationOrder(userId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveConversationOrder(userId: string, ids: string[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(ids));
}

export function applyConversationOrder(
  conversations: Conversation[],
  userId: string,
): Conversation[] {
  const saved = loadConversationOrder(userId);
  if (saved.length === 0) return conversations;

  const byId = new Map(conversations.map((c) => [c.id, c]));
  const ordered: Conversation[] = [];

  for (const id of saved) {
    const conv = byId.get(id);
    if (conv) {
      ordered.push(conv);
      byId.delete(id);
    }
  }

  for (const conv of conversations) {
    if (byId.has(conv.id)) ordered.push(conv);
  }

  return ordered;
}

/** Move ``id`` to the front of an id list, preserving the relative order of
 *  the rest. Adds it if missing. Pure — used to bump a conversation to the top
 *  on new activity without disturbing the operator's manual ordering of the
 *  other conversations. */
export function bumpToFront(ids: string[], id: string): string[] {
  if (ids[0] === id) return ids;
  return [id, ...ids.filter((x) => x !== id)];
}

export function syncConversationOrder(
  userId: string,
  conversations: Conversation[],
): string[] {
  const saved = loadConversationOrder(userId);
  const ids = conversations.map((c) => c.id);
  const idSet = new Set(ids);

  const next = [
    ...saved.filter((id) => idSet.has(id)),
    ...ids.filter((id) => !saved.includes(id)),
  ];

  saveConversationOrder(userId, next);
  return next;
}
