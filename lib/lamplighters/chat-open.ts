// Where a Circle's chat opens (pure, so it can be tested).

import type { Message } from "./client";

/**
 * The first message I haven't read (someone else's, after where I'd read up to), and the
 * message to scroll to: the one a notification pointed at if it's loaded, else that first
 * unread one. Null for both means: open at the newest.
 */
export function openingPoint(messages: Message[], readUpTo: string | null, me: string, wanted: string | null) {
  const unread = readUpTo ? messages.find((m) => m.created_at > readUpTo && m.sender_id !== me && !m.deleted_at) : undefined;
  const target = wanted && messages.some((m) => m.id === wanted) ? wanted : (unread?.id ?? null);
  return { firstUnread: unread?.id ?? null, target };
}

/** Enough loaded: the notification's message is there, and so is the first unread one. */
export function loadedEnough(messages: Message[], readUpTo: string | null, wanted: string | null) {
  const hasWanted = !wanted || messages.some((m) => m.id === wanted);
  const reachesUnread = !readUpTo || (messages.length > 0 && messages[0].created_at <= readUpTo);
  return hasWanted && reachesUnread;
}
