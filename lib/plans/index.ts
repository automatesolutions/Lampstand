import { chapterRange } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";

export interface ReadingPlan {
  slug: string;
  title: string;
  summary: string;
  days: ChapterRef[][];
}

/** Splits chapters into `days` groups as evenly as possible, earlier days taking the extra. */
export function spread(chapters: ChapterRef[], days: number): ChapterRef[][] {
  const out: ChapterRef[][] = [];
  let i = 0;
  for (let d = 0; d < days; d++) {
    const take = Math.floor(chapters.length / days) + (d < chapters.length % days ? 1 : 0);
    out.push(chapters.slice(i, i + take));
    i += take;
  }
  return out;
}

export const PLANS: readonly ReadingPlan[] = [
  {
    slug: "gospel-of-john",
    title: "The Gospel of John",
    summary: "One chapter a day for 21 days.",
    days: spread(chapterRange({ book: "JHN", chapter: 1 }, { book: "JHN", chapter: 21 }), 21),
  },
  {
    slug: "new-testament-90",
    title: "New Testament in 90 days",
    summary: "About three chapters a day, Matthew to Revelation.",
    days: spread(chapterRange({ book: "MAT", chapter: 1 }, { book: "REV", chapter: 22 }), 90),
  },
];

export function planBySlug(slug: string): ReadingPlan | undefined {
  return PLANS.find((p) => p.slug === slug);
}

/**
 * Index of the first plan day with an unread chapter, counting reads since the
 * plan started. Plans move at the reader's pace, so a missed day never piles up.
 * Returns days.length when the plan is finished.
 */
export function currentPlanDay(
  plan: ReadingPlan,
  startedOn: string,
  reads: { book: string; chapter: number; readOn: string }[],
): number {
  const done = new Set(reads.filter((r) => r.readOn >= startedOn).map((r) => `${r.book}.${r.chapter}`));
  const i = plan.days.findIndex((day) => day.some((c) => !done.has(`${c.book}.${c.chapter}`)));
  return i === -1 ? plan.days.length : i;
}
