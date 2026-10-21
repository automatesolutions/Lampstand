"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DayLamp, Lamp } from "@/components/brand/LampMark";
import { BibleCompleteCard } from "@/components/StartOver";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { kindOf } from "@/lib/bible/kinds";
import { formatRef, readerHref } from "@/lib/bible/refs";
import { VERSIONS, versionSlug } from "@/lib/bible/provider";
import { contextCard } from "@/lib/context-cards";
import { plateSrc } from "@/lib/plates";
import { openPrayer, recentChapters } from "@/lib/prayer";
import { addDays } from "@/lib/streak";
import { goalOn, readsPerDay, today, useHydrated, useStore } from "@/lib/store";
import { useReadingSummary } from "@/lib/store/hooks";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dateLabel() {
  const d = new Date();
  return `${new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(d)} · ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(d)}`;
}

export default function TodayPage() {
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.onboarded);
  const version = useStore((s) => s.prefs.version);
  const reads = useStore((s) => s.reads);
  const goals = useStore((s) => s.goals);
  const router = useRouter();
  const { goal, readToday, streak, next, plan } = useReadingSummary();
  const [excerpt, setExcerpt] = useState<{ key: string; verses: string[]; note: { title: string; summary: string } | null } | null>(null);
  const nextKey = `${next.book}.${next.chapter}`;

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/welcome");
  }, [hydrated, onboarded, router]);

  useEffect(() => {
    if (!hydrated) return;
    const ctrl = new AbortController();
    fetch(`/api/excerpt/${versionSlug(version)}/${next.book}/${next.chapter}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { verses: string[]; note: { title: string; summary: string } | null } | null) => d && setExcerpt({ key: nextKey, verses: d.verses, note: d.note }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [hydrated, version, next.book, next.chapter, nextKey]);

  // Monday-first week of lamps (DESIGN.md §8).
  const week = useMemo(() => {
    if (!hydrated) return [];
    const t = today();
    const [y, m, d] = t.split("-").map(Number);
    const monday = addDays(t, -((new Date(y, m - 1, d).getDay() + 6) % 7));
    const perDay = readsPerDay(reads);
    const graced = new Set(streak.days.filter((x) => x.graced).map((x) => x.date));
    return DAY_NAMES.map((name, i) => {
      const date = addDays(monday, i);
      const future = date > t;
      const met = (perDay[date] ?? 0) >= goalOn(goals, date);
      const state: "lit" | "rest" | "unlit" = !future && met ? "lit" : graced.has(date) ? "rest" : "unlit";
      const said = future ? "not yet" : state === "lit" ? "goal met" : state === "rest" ? "rest day" : date === t ? "not yet" : "missed";
      return { date, name, state, said, isToday: date === t };
    });
  }, [hydrated, reads, goals, streak.days]);

  if (!hydrated || !onboarded) return <h1 className="text-display">Today</h1>;

  const shown = Math.min(readToday, goal);
  const left = goal - shown;
  const progress = goal > 0 ? shown / goal : 0;
  const lampLabel = `${shown} of ${goal} ${goal === 1 ? "chapter" : "chapters"} read today`;
  const kind = kindOf(next.book);
  const card = contextCard(next.book);
  const verses = excerpt?.key === nextKey ? excerpt.verses : null;
  const note = excerpt?.key === nextKey ? excerpt.note : null;
  const prayFor = recentChapters(reads);
  const licensed = version !== "KJV" ? VERSIONS.find((v) => v.id === version) : undefined;
  const rests = week.filter((d) => d.state === "rest").length;

  return (
    <div data-wide className="arrive flex flex-col gap-5 min-[960px]:gap-7">
      <header className="flex flex-col gap-1.5">
        <p className="text-eyebrow text-text-secondary">{dateLabel()}</p>
        <h1 className="text-display">Today</h1>
      </header>

      <div className="grid gap-5 min-[960px]:grid-cols-[340px_1fr] min-[960px]:items-start">
        <section
          aria-label="Today's reading"
          className="relative isolate flex flex-wrap items-center gap-x-4 gap-y-1.5 overflow-hidden rounded-xl bg-surface px-[18px] py-4 min-[960px]:flex-col min-[960px]:gap-[18px] min-[960px]:px-5 min-[960px]:pb-[22px] min-[960px]:pt-7 min-[960px]:text-center"
        >
          <Lamp progress={progress} size={84} label={lampLabel} className="min-[960px]:hidden" />
          <Lamp progress={progress} size={132} label={lampLabel} className="hidden min-[960px]:grid" />
          <div className="flex min-w-0 flex-1 flex-col gap-1" aria-hidden="true">
            <strong className="font-display text-[1.875rem] font-semibold leading-none tabular-nums min-[960px]:text-[2.25rem]">
              {shown} of {goal}
            </strong>
            <span className="text-subhead text-text-secondary">
              {left <= 0 ? "Today's reading is done. The lamp is full." : `${goal === 1 ? "chapter" : "chapters"} today · ${WORDS[left] ?? left} to go`}
            </span>
          </div>
          <Link
            href="/streak"
            aria-label={`This week. ${streak.current}-day streak. See your streak`}
            className="mt-1.5 flex w-full basis-full flex-col items-center gap-2 border-t border-divider pt-3 min-[960px]:max-w-[300px]"
          >
            <ul className="grid w-full grid-cols-7 gap-1">
              {week.map((d) => (
                <li key={d.date} className={`flex flex-col items-center gap-1 text-[0.6875rem] font-semibold ${d.isToday ? "text-gold-text" : "text-text-secondary"}`}>
                  <DayLamp state={d.state} />
                  <span aria-hidden="true">{d.name[0]}</span>
                  <span className="sr-only">
                    {d.name}: {d.said}
                  </span>
                </li>
              ))}
            </ul>
            <span className="text-footnote text-text-secondary">
              {streak.current === 0 ? "Your streak starts with today's reading" : `${streak.current}-day streak`}
              {rests > 0 && ` · ${WORDS[rests]} rest ${rests === 1 ? "day" : "days"} used this week`}
            </span>
          </Link>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <BibleCompleteCard />
          <section aria-labelledby="next-heading" className="flex flex-col gap-4 rounded-xl bg-surface-raised px-[22px] pb-6 shadow-soft ring-1 ring-divider/60">
            <Image
              src={plateSrc(next.book)}
              alt=""
              width={1200}
              height={800}
              sizes="(min-width: 960px) 560px, 100vw"
              loading="eager"
              className="-mx-[22px] aspect-[16/6] w-[calc(100%+44px)] max-w-none rounded-t-xl bg-surface object-cover"
            />
            <div className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-eyebrow text-text-secondary">
                <span aria-hidden="true" className="size-2.5 rotate-45 rounded-[3px]" style={{ background: kind.pigment }} />
                {plan && !plan.finished ? `${plan.plan.title} · Day ${plan.dayIndex + 1} of ${plan.plan.days.length}` : `${left <= 0 ? "Keep going" : "Up next"} · ${kind.name}`}
              </p>
              <h2 id="next-heading" className="text-title">
                {formatRef(next)}
              </h2>
            </div>

            <p className="line-clamp-3 min-h-[5.1em] font-scripture text-[1.1875rem] leading-[1.7] min-[960px]:line-clamp-4 min-[960px]:min-h-[6.8em]">
              {verses ? (
                <>
                  <span aria-hidden="true" className="dropcap leaf-text">
                    {verses[0][0]}
                  </span>
                  <span className="sr-only">{verses[0][0]}</span>
                  {verses[0].slice(1)} {verses[1]}
                </>
              ) : (
                <span className="text-text-secondary">Opening {formatRef(next)}…</span>
              )}
            </p>

            {licensed && verses && (
              <p className="-mt-2 text-footnote leading-snug text-text-secondary">
                {licensed.id}. {licensed.copyright}
                {licensed.link && (
                  <>
                    {" "}
                    <a href={licensed.link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-gold-text underline underline-offset-2">
                      {licensed.link.label}
                    </a>
                  </>
                )}
              </p>
            )}

            {note ? (
              <div className="flex gap-3 rounded-md bg-bg px-4 py-3.5">
                <Icon name="scroll-text" className="mt-0.5 size-5 text-gold" />
                <p className="text-subhead text-text-secondary">
                  <strong className="font-semibold text-text">In this chapter: {note.title}.</strong> {note.summary}
                </p>
              </div>
            ) : (
              card && (
                <div className="flex gap-3 rounded-md bg-bg px-4 py-3.5">
                  <Icon name="scroll-text" className="mt-0.5 size-5 text-gold" />
                  <p className="text-subhead text-text-secondary">
                    <strong className="font-semibold text-text">Before you read.</strong> {card.author} {card.date}
                  </p>
                </div>
              )
            )}

            <ButtonLink
              href={readerHref(version, next)}
              variant={left <= 0 ? "secondary" : "primary"}
              size="large"
              className="sticky bottom-[calc(56px+12px+env(safe-area-inset-bottom))] z-[2] min-[960px]:static"
            >
              {readToday > 0 ? "Continue reading" : "Start reading"}
            </ButtonLink>
          </section>

          <Link href={plan ? `/plans/${plan.plan.slug}` : "/plans"} className="flex min-h-16 items-center gap-3.5 rounded-lg bg-surface px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-headline">{plan ? plan.plan.title : "Choose a plan"}</span>
              <span className="block text-footnote text-text-secondary">
                {plan ? (plan.finished ? "Finished" : `Day ${plan.dayIndex + 1} of ${plan.plan.days.length}`) : "Read with a set path"}
              </span>
              {plan && (
                <span aria-hidden="true" className="mt-2 block h-1 overflow-hidden rounded-full bg-divider">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.round((Math.min(plan.dayIndex, plan.plan.days.length) / plan.plan.days.length) * 100)}%` }} />
                </span>
              )}
            </span>
            <Icon name="chevron-right" className="size-[18px] text-text-secondary" />
          </Link>

          {prayFor.length > 0 && (
            <button type="button" onClick={() => openPrayer()} aria-haspopup="dialog" className="flex min-h-16 items-center gap-3.5 rounded-lg bg-surface px-4 py-3 text-left">
              <Icon name="hand-heart" className="size-6 text-gold" />
              <span className="min-w-0 flex-1">
                <span className="block text-headline">Pray over what you read</span>
                <span className="block truncate text-footnote text-text-secondary">{prayFor.map((r) => formatRef(r)).join(" · ")}</span>
              </span>
              <Icon name="chevron-right" className="size-[18px] text-text-secondary" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
