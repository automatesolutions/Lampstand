"use client";

// Marking a chapter read, with the mascot's moments: a short "Nice work!" in the chapter
// done card, a celebration for milestones (shown by CelebrationHost), and sharing to
// Circles as each person's sharing choice allows (the database checks it again).

import { useSyncExternalStore } from "react";
import { bookByCode } from "@/lib/bible/books";
import type { ChapterRef, VersionId } from "@/lib/bible/types";
import { getState, markRead, today } from "@/lib/store";
import { mascotMessage, type MascotMessage } from "./assets";
import { shareProgress } from "./client";
import { detectMilestones, type Milestone } from "./milestones";

export interface Celebration extends MascotMessage {
  id: string;
  milestone: Milestone;
}

let queue: Celebration[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useCelebration(): Celebration | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue[0] ?? null,
    () => null,
  );
}

export function dismissCelebration() {
  queue = queue.slice(1);
  emit();
}

export function celebrationFor(m: Milestone, seed: string): MascotMessage {
  if (m.type === "book") return mascotMessage("book", seed, { book: bookByCode(m.book)?.name ?? m.book });
  if (m.type === "streak") return mascotMessage("streak", seed, { days: m.value });
  return mascotMessage("chapters", seed, { count: m.value.toLocaleString("en-US") });
}

/**
 * Marks the chapter read and returns the short cheer for the chapter done card
 * (null when the mascot is off). Milestones queue a celebration.
 */
export function finishChapter(ref: ChapterRef, version: VersionId): MascotMessage | null {
  const before = getState();
  markRead(ref, version);
  const after = getState();
  if (after.reads.length === before.reads.length) return null; // already read today

  const date = today();
  const milestones = detectMilestones(before, after, ref, date);
  shareProgress("chapter", { book: ref.book, chapter: ref.chapter });
  for (const m of milestones) shareProgress("milestone", m.type === "book" ? { type: "book", book: m.book } : { type: m.type, value: m.value });

  if (!after.prefs.mascot) return null;
  const seed = `${date}.${after.reads.length}`;
  if (milestones.length) {
    queue = [...queue, ...milestones.map((m, i) => ({ id: `${seed}.${i}`, milestone: m, ...celebrationFor(m, seed) }))];
    emit();
  }
  return mascotMessage("chapterDone", seed);
}
