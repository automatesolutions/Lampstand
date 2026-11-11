"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";
import { myCircles, myNotifications, myNudges, useLampVersion } from "./client";

/** Unread notifications (chat messages and nudges), for the dot on the Circles tab. 0 when signed out. */
export function useCirclesBadge(): number {
  const { userId } = useSyncStatus();
  const v = useLampVersion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || !supabase()) return;
    let live = true;
    const check = () =>
      myNotifications()
        .then((n) => n.filter((x) => !x.read_at).length)
        // Before migration 0006: new nudges plus unread messages, as before.
        .catch(() => Promise.all([myNudges(), myCircles()]).then(([n, c]) => n.filter((x) => !x.read_at).length + c.reduce((s, x) => s + x.unread_count, 0)))
        .then(
          (total) => live && setCount(total),
          () => {}, // before migration 0005, or offline: no dot
        );
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    const t = setInterval(() => document.visibilityState === "visible" && check(), 60_000);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, v]);

  return userId ? count : 0;
}
