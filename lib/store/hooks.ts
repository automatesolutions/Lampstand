"use client";

import { useMemo } from "react";
import { nextChapter } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { currentPlanDay, planBySlug, type ReadingPlan } from "@/lib/plans";
import { computeStreak, type StreakSummary } from "@/lib/streak";
import { goalOn, readsPerDay, today, useHydrated, useStore } from ".";

export interface PlanProgress {
  plan: ReadingPlan;
  dayIndex: number; // 0-based; equals days.length when finished
  finished: boolean;
}

export interface ReadingSummary {
  goal: number;
  readToday: number;
  streak: StreakSummary;
  next: ChapterRef;
  plan: PlanProgress | null;
}

export function useReadingSummary(): ReadingSummary {
  const goals = useStore((s) => s.goals);
  const reads = useStore((s) => s.reads);
  const position = useStore((s) => s.position);
  const planState = useStore((s) => s.plan);
  const hydrated = useHydrated();

  return useMemo(() => {
    // Dates are only known on the client; prerendered HTML uses an empty summary.
    if (!hydrated) {
      return { goal: 1, readToday: 0, streak: { current: 0, metToday: false, days: [] }, next: { book: "JHN", chapter: 1 }, plan: null };
    }
    const date = today();
    const perDay = readsPerDay(reads);
    const goal = goalOn(goals, date);
    const streak = computeStreak(perDay, (d) => goalOn(goals, d), date);

    let plan: PlanProgress | null = null;
    let next: ChapterRef | null = null;
    const p = planState && planBySlug(planState.slug);
    if (p && planState) {
      const dayIndex = currentPlanDay(p, planState.startedOn, reads);
      const finished = dayIndex >= p.days.length;
      plan = { plan: p, dayIndex, finished };
      if (!finished) {
        const done = new Set(reads.filter((r) => r.readOn >= planState.startedOn).map((r) => `${r.book}.${r.chapter}`));
        next = p.days[dayIndex].find((c) => !done.has(`${c.book}.${c.chapter}`)) ?? null;
      }
    }

    if (!next) {
      const last = [...reads].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
      if (position && !(last && last.book === position.book && last.chapter === position.chapter)) {
        next = { book: position.book, chapter: position.chapter };
      } else if (last) {
        next = nextChapter(last) ?? { book: "GEN", chapter: 1 };
      } else {
        next = { book: "JHN", chapter: 1 };
      }
    }

    return { goal, readToday: perDay[date] ?? 0, streak, next, plan };
  }, [hydrated, goals, reads, position, planState]);
}
