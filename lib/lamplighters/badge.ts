"use client";

// One list of my Circle notifications (chat messages and nudges that reached me), shared
// by every screen that shows them: the dot on the Circles tab, the bell and its sheet, and
// the Circles page. Before, the tab dot and the page loaded separately and could disagree.
//
// It loads when the first screen needs it, and again when the tab comes back into view,
// every minute while it's visible, and after any change made on this device (changed()).

import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";
import { myCircles, myNotifications, myNudges, onLampChange, type LampNotification } from "./client";

export interface NotificationsState {
  /** Newest first; null until loaded, or when the server is older than migration 0006. */
  items: LampNotification[] | null;
  /** How many are unread: the tab dot and the bell's count. */
  unread: number;
  /** True when the list couldn't be loaded (offline, or before migration 0006). */
  failed: boolean;
}

const EMPTY: NotificationsState = { items: null, unread: 0, failed: false };
let state = EMPTY;
let forUser: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const set = (next: NotificationsState) => {
  state = next;
  listeners.forEach((l) => l());
};

/** Unread count without migration 0006: new nudges plus unread messages, as before. */
const fallbackCount = () => Promise.all([myNudges(), myCircles()]).then(([n, c]) => n.filter((x) => !x.read_at).length + c.reduce((s, x) => s + x.unread_count, 0));

/** Loads the list again (one request at a time). */
export function refreshNotifications(): Promise<void> {
  const user = forUser;
  if (!user || !supabase()) return Promise.resolve();
  if (loading) return loading;
  const mine = () => forUser === user; // still the same person when the answer arrives
  loading = myNotifications()
    .then(
      (items) => {
        if (mine()) set({ items, unread: items.filter((x) => !x.read_at).length, failed: false });
      },
      () =>
        fallbackCount().then(
          (unread) => {
            if (mine()) set({ items: null, unread, failed: true });
          },
          () => {
            if (mine()) set({ ...state, failed: true }); // offline, or before 0005: keep what was shown
          },
        ),
    )
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Whose list this is; a new person starts empty. Returns the current state (for tests too). */
export function notificationsFor(userId: string | null): NotificationsState {
  if (forUser !== userId) {
    forUser = userId;
    set(EMPTY);
  }
  return state;
}

export const getNotifications = () => state;

let users = 0;
let stop: (() => void) | null = null;

function start() {
  const onVisible = () => document.visibilityState === "visible" && refreshNotifications();
  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(onVisible, 60_000);
  const offChange = onLampChange(() => refreshNotifications());
  stop = () => {
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
    offChange();
  };
}

/** The shared notifications list for the signed-in person (empty when signed out). */
export function useNotifications(): NotificationsState {
  const { userId } = useSyncStatus();

  useEffect(() => {
    if (!userId) return;
    notificationsFor(userId);
    if (users++ === 0) start();
    refreshNotifications();
    return () => {
      if (--users === 0) {
        stop?.();
        stop = null;
      }
    };
  }, [userId]);

  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => EMPTY,
  );
  return userId && forUser === userId ? s : EMPTY;
}

/** Unread notifications, for the dot on the Circles tab. 0 when signed out. */
export function useCirclesBadge(): number {
  return useNotifications().unread;
}
