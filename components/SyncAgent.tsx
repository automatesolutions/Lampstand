"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/sync";

/** Starts account sync once per tab (mounted in the root layout). Renders nothing. */
export function SyncAgent() {
  useEffect(() => startSync(), []);
  return null;
}
