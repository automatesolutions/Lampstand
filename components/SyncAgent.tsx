"use client";

import { useEffect } from "react";
import { startHighlightSummaries } from "@/lib/highlights/summaries";
import { startAutoShare } from "@/lib/lamplighters/autoshare";
import { startSync } from "@/lib/sync";

/** Starts account sync, highlight summaries and auto-sharing once per tab (mounted in the root layout). Renders nothing. */
export function SyncAgent() {
  useEffect(() => {
    startSync();
    startHighlightSummaries();
    startAutoShare();
  }, []);
  return null;
}
