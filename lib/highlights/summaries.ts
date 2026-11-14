"use client";

// Fills in highlight summaries in the background. Highlighting never waits for this:
// a highlight is saved at once, and its summary is asked for afterwards, one at a time,
// whenever the app opens, comes back online or the highlights change. A failure (offline,
// budget reached, server not set up) waits a while before that highlight is tried again.
// Only the verse reference is sent (app/api/highlight-summary), never notes.

import { getState, onChange, setHighlightSummary, type Highlight } from "@/lib/store";
import { MAX_SUMMARY_VERSES } from "./ranges";

const RETRY_MS = 10 * 60_000;
const failedAt = new Map<string, number>(); // highlight id -> when it last failed
let running = false;
let pausedUntil = 0; // the server said "limit reached" or "paused": wait before asking again
let timer: ReturnType<typeof setTimeout> | undefined;

const due = (h: Highlight) =>
  !h.summary && h.verseEnd - h.verseStart < MAX_SUMMARY_VERSES && Date.now() - (failedAt.get(h.id) ?? 0) > RETRY_MS; // longer ranges have no summary

/** The summary, null when this one failed, or "pause" when every request would fail for now. */
async function summarize(h: Highlight): Promise<string | null | "pause"> {
  const res = await fetch("/api/highlight-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ book: h.book, chapter: h.chapter, verseStart: h.verseStart, verseEnd: h.verseEnd }),
  });
  if (res.status === 429 || res.status === 503) return "pause";
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { summary?: unknown } | null;
  return typeof data?.summary === "string" ? data.summary : null;
}

async function run() {
  if (running || !navigator.onLine || Date.now() < pausedUntil) return;
  running = true;
  try {
    // Newest first, so the one just highlighted is written first.
    for (;;) {
      const next = [...getState().highlights].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find(due);
      if (!next || !navigator.onLine) break;
      const summary = await summarize(next).catch(() => null);
      if (summary === "pause") {
        pausedUntil = Date.now() + RETRY_MS;
        soon(RETRY_MS + 1000);
        break;
      }
      if (summary) setHighlightSummary(next.id, summary);
      else failedAt.set(next.id, Date.now());
    }
  } finally {
    running = false;
  }
}

const soon = (ms = 600) => {
  clearTimeout(timer);
  timer = setTimeout(run, ms);
};

let started = false;

/** Starts the background summaries for this tab (once). */
export function startHighlightSummaries() {
  if (started || typeof window === "undefined") return;
  started = true;
  onChange(() => soon());
  window.addEventListener("online", () => {
    failedAt.clear();
    pausedUntil = 0;
    soon(0);
  });
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && soon());
  soon(1500);
}
