// Mascot moments (pure, unit-tested): milestones reached by marking a chapter read,
// and the gentle welcome back after days away.

import { bookByCode } from "@/lib/bible/books";
import type { ChapterRef } from "@/lib/bible/types";
import { addDays, computeStreak, type ISODate } from "@/lib/streak";
import type { ChapterRead, Goal, Round } from "@/lib/store";
import mascot from "@/content/mascot.json";

export type Milestone = { type: "chapters"; value: number } | { type: "streak"; value: number } | { type: "book"; book: string };

export interface ReadingSnapshot {
  reads: ChapterRead[];
  goals: Goal[];
  round: Round | null;
}

const goalOn = (goals: Goal[], date: ISODate) => {
  let goal = 1;
  for (const g of [...goals].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))) if (g.effectiveFrom <= date) goal = g.chaptersPerDay;
  return goal;
};

function streakOf(s: ReadingSnapshot, today: ISODate) {
  const perDay: Record<ISODate, number> = {};
  for (const r of s.reads) perDay[r.readOn] = (perDay[r.readOn] ?? 0) + 1;
  return computeStreak(perDay, (d) => goalOn(s.goals, d), today).current;
}

function bookDone(s: ReadingSnapshot, code: string) {
  const book = bookByCode(code);
  if (!book) return false;
  const done = new Set(s.reads.filter((r) => r.book === code && (!s.round || r.completedAt >= s.round.startedAt)).map((r) => r.chapter));
  return done.size >= book.chapters;
}

/** Thresholds crossed between before and after: (before, after]. */
const crossed = (list: readonly number[], before: number, after: number) => list.filter((n) => before < n && n <= after);

/**
 * What marking `ref` read just reached. Chapters count every chapter read (a chapter
 * read again on another day counts again); the streak follows lib/streak; a book is
 * finished when every chapter of it is read in the current round.
 */
export function detectMilestones(
  before: ReadingSnapshot,
  after: ReadingSnapshot,
  ref: ChapterRef,
  today: ISODate,
  thresholds: { chapters: readonly number[]; streak: readonly number[] } = mascot.milestones,
): Milestone[] {
  const out: Milestone[] = [];
  if (!bookDone(before, ref.book) && bookDone(after, ref.book)) out.push({ type: "book", book: ref.book });
  const chapters = crossed(thresholds.chapters, before.reads.length, after.reads.length).at(-1);
  if (chapters) out.push({ type: "chapters", value: chapters });
  const streak = crossed(thresholds.streak, streakOf(before, today), streakOf(after, today)).at(-1);
  if (streak) out.push({ type: "streak", value: streak });
  return out;
}

/**
 * Days since the last reading, when the reader missed at least one whole day and
 * hasn't read yet today; otherwise null. Never counts as a failure, only a hello.
 */
export function daysAway(reads: Pick<ChapterRead, "readOn">[], today: ISODate): number | null {
  if (reads.some((r) => r.readOn === today)) return null;
  const last = reads.reduce<ISODate | null>((m, r) => (r.readOn < today && (!m || r.readOn > m) ? r.readOn : m), null);
  if (!last || last >= addDays(today, -1)) return null;
  let days = 0;
  for (let d = last; d < today; d = addDays(d, 1)) days++;
  return days;
}
