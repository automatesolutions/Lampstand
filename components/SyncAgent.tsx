"use client";

import { useEffect } from "react";
import { startHighlightSummaries } from "@/lib/highlights/summaries";
import { startSync } from "@/lib/sync";

/** Starts account sync and highlight summaries once per tab (mounted in the root layout). Renders nothing. */
export function SyncAgent() {
  useEffect(() => {
    startSync();
    startHighlightSummaries();
  }, []);
  return null;
}
