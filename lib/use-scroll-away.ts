"use client";

import { useEffect, useState } from "react";

/**
 * True while the reader scrolls down past `after` px, false on any scroll up
 * (DESIGN.md §5.1). `paused` keeps the bars shown, e.g. while a verse is selected.
 */
export function useScrollAway({ after = 120, paused = false } = {}): boolean {
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (paused) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < after) setAway(false);
      else if (y > last + 6) setAway(true);
      else if (y < last - 6) setAway(false);
      if (Math.abs(y - last) > 6) last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [after, paused]);
  return away && !paused;
}
