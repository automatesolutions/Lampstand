"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";
import { myCircles, myNudges, useLampVersion } from "./client";

/** New nudges plus unread messages, for the dot on the Circles tab. 0 when signed out. */
export function useCirclesBadge(): number {
  const { userId } = useSyncStatus();
  const v = useLampVersion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId || !supabase()) return;
    let live = true;
    const check = () =>
      Promise.all([myNudges(), myCircles()]).then(
        ([n, c]) => live && setCount(n.filter((x) => !x.read_at).length + c.reduce((s, x) => s + x.unread_count, 0)),
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
