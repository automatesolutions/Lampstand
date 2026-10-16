"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageTitle } from "@/components/ui/NavBar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { bookByCode } from "@/lib/bible/books";
import { readerHref } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { currentPlanDay, planBySlug } from "@/lib/plans";
import { startPlan, useHydrated, useStore } from "@/lib/store";

function dayLabel(day: ChapterRef[]): string {
  const first = day[0];
  const last = day[day.length - 1];
  const a = bookByCode(first.book)?.name ?? first.book;
  if (day.length === 1) return `${a} ${first.chapter}`;
  if (first.book === last.book) return `${a} ${first.chapter}–${last.chapter}`;
  return `${a} ${first.chapter} – ${bookByCode(last.book)?.name ?? last.book} ${last.chapter}`;
}

export function PlanDetail({ slug }: { slug: string }) {
  const plan = planBySlug(slug)!;
  const router = useRouter();
  const hydrated = useHydrated();
  const active = useStore((s) => s.plan);
  const reads = useStore((s) => s.reads);
  const version = useStore((s) => s.prefs.version);
  const isActive = hydrated && active?.slug === slug;

  const dayIndex = useMemo(
    () => (isActive && active ? currentPlanDay(plan, active.startedOn, reads) : -1),
    [isActive, active, plan, reads],
  );

  return (
    <div className="arrive flex flex-col gap-6">
      <PageTitle back={{ href: "/plans", label: "Plans" }}>{plan.title}</PageTitle>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-body text-text-secondary">
            {plan.summary} {plan.days.length} days.
          </p>
        </div>

        {isActive ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gold-wash px-4 py-3">
            <p className="text-subhead">
              {dayIndex >= plan.days.length ? "You finished this plan." : `You're on day ${dayIndex + 1}.`}
            </p>
            <Button variant="plain" onClick={() => startPlan(null)}>
              Stop plan
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="large"
            onClick={() => {
              startPlan(slug);
              router.push(readerHref(version, plan.days[0][0]));
            }}
          >
            {active ? "Switch to this plan" : "Start this plan"}
          </Button>
        )}

        <ol aria-label="Days" className="overflow-hidden rounded-lg bg-surface">
          {plan.days.map((day, i) => {
            const done = isActive && i < dayIndex;
            const current = isActive && i === dayIndex;
            return (
              <li key={i} className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
                <Link
                  href={readerHref(version, day[0])}
                  aria-current={current ? "step" : undefined}
                  className={`flex min-h-[52px] items-center gap-3 px-4 py-2 ${current ? "bg-gold-wash" : ""} active:bg-gold-wash`}
                >
                  <span className="w-14 shrink-0 text-footnote text-text-secondary">Day {i + 1}</span>
                  <span className="flex-1 text-body">{dayLabel(day)}</span>
                  {done && (
                    <>
                      <Icon name="circle-check" className="size-5 text-gold" />
                      <span className="sr-only">Done</span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
