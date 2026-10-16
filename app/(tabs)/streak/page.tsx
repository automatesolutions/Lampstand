"use client";

import { useMemo } from "react";
import { PageTitle } from "@/components/ui/NavBar";
import { addDays } from "@/lib/streak";
import { goalOn, readsPerDay, today, useHydrated, useStore } from "@/lib/store";
import { useReadingSummary } from "@/lib/store/hooks";

const WEEKS = 6;
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "narrow" });
const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

function parse(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** Streak detail (screen 16): the last six weeks, met days filled, grace days outlined. */
export default function StreakPage() {
  const hydrated = useHydrated();
  const reads = useStore((s) => s.reads);
  const goals = useStore((s) => s.goals);
  const { streak } = useReadingSummary();

  const days = useMemo(() => {
    if (!hydrated) return [];
    const t = today();
    const perDay = readsPerDay(reads);
    const graced = new Set(streak.days.filter((d) => d.graced).map((d) => d.date));
    const end = addDays(t, 6 - parse(t).getDay()); // end of this week (Saturday)
    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const date = addDays(end, i - WEEKS * 7 + 1);
      const n = perDay[date] ?? 0;
      return { date, future: date > t, met: n >= goalOn(goals, date), graced: graced.has(date), isToday: date === t, n };
    });
  }, [hydrated, reads, goals, streak.days]);

  return (
    <div className="arrive flex flex-col gap-6">
      <PageTitle back={{ href: "/", label: "Today" }}>Streak</PageTitle>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="font-display text-[3.5rem] font-semibold leading-none tabular-nums">{hydrated ? streak.current : "–"}</p>
          <p className="text-subhead text-text-secondary">{streak.current === 1 ? "day in a row" : "days in a row"}</p>
        </div>

        <section aria-label="Last six weeks" className="rounded-lg bg-surface p-4">
          <div aria-hidden="true" className="mb-2 grid grid-cols-7 text-center text-caption text-text-secondary">
            {days.slice(0, 7).map((d) => (
              <span key={d.date}>{weekday.format(parse(d.date))}</span>
            ))}
          </div>
          <ol className="grid grid-cols-7 gap-y-2">
            {days.map((d) => {
              const status = d.future ? "" : d.met ? "goal met" : d.graced ? "rest day" : d.n > 0 ? `${d.n} read` : "no reading";
              return (
                <li key={d.date} className="grid place-items-center">
                  <span
                    aria-label={`${longDate.format(parse(d.date))}${status ? `: ${status}` : ""}`}
                    className={`grid size-9 place-items-center rounded-full text-footnote tabular-nums ${
                      d.met
                        ? "bg-gold-strong text-on-gold"
                        : d.graced
                          ? "border-2 border-dashed border-gold text-text"
                          : "text-text-secondary"
                    } ${d.isToday ? "ring-2 ring-gold ring-offset-2 ring-offset-surface" : ""}`}
                  >
                    {parse(d.date).getDate()}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex flex-col gap-2 text-footnote text-text-secondary">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 rounded-full bg-gold-strong" /> Goal met
          </p>
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block size-3 rounded-full border-2 border-dashed border-gold" /> Rest day
          </p>
          <p className="pt-2">You get one rest day each week. If you miss one day, your streak continues. If you miss two days in a row, a new streak starts.</p>
        </div>
      </div>
    </div>
  );
}
