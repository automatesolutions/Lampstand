"use client";

// Shares new highlights to the Circles where I turned on "Share my new highlights here"
// (supabase/migrations/0011, off by default). A few seconds after highlights change, and
// only when signed in: each highlight made after the choice was turned on for a Circle is
// shared there once. It syncs first (the highlight must be in the account), shares at most
// a few at a time (chat allows 20 messages a minute), and remembers on this device what it
// already sent. The server allows one share per highlight per Circle, so other devices
// can't post it twice either.

import { getState, onChange } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { syncNow } from "@/lib/sync";
import { myAutoShare, shareHighlight } from "./client";
import { pickAutoShares, type AutoChoice } from "./autoshare-pick";

const KEY = "lampstand:autoshared";
const PER_ROUND = 5;
const WAIT_MS = 4000;

function done(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function remember(keys: string[]) {
  try {
    const all = [...done(), ...keys].slice(-2000); // enough to cover months of highlights
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private mode: the server still refuses a second share of the same highlight.
  }
}

let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;

async function run() {
  if (running) return;
  const db = supabase();
  const { data } = (await db?.auth.getSession()) ?? { data: null };
  if (!data?.session?.user.email) return; // guests have no Circles
  running = true;
  try {
    let choices: AutoChoice[];
    try {
      choices = await myAutoShare();
    } catch {
      return; // before migration 0011, or offline
    }
    const work = pickAutoShares(getState().highlights, choices, done(), PER_ROUND);
    if (!work.length) return;
    await syncNow(true);
    for (const { highlightId, circleIds } of work) {
      try {
        const res = await shareHighlight(highlightId, circleIds, "", false);
        // Shared, or already there: either way it's done. Failures are tried again later.
        remember([...res.shared, ...res.already].map((c) => `${highlightId}:${c}`));
      } catch {
        // Not saved yet, or offline: next time.
      }
    }
  } finally {
    running = false;
  }
}

let started = false;

/** Starts auto-sharing for this tab (once). */
export function startAutoShare() {
  if (started || typeof window === "undefined") return;
  started = true;
  onChange(() => {
    clearTimeout(timer);
    timer = setTimeout(run, WAIT_MS);
  });
  timer = setTimeout(run, WAIT_MS * 2);
}
