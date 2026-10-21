"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lamp } from "@/components/brand/LampMark";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { readerHref } from "@/lib/bible/refs";
import { chaptersReadInRound, startNewRound, TOTAL_CHAPTERS, useHydrated, useStore } from "@/lib/store";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Progress through the whole Bible in this round. */
export function useBibleProgress() {
  const hydrated = useHydrated();
  const reads = useStore((s) => s.reads);
  const round = useStore((s) => s.round);
  const read = hydrated ? chaptersReadInRound(reads, round) : 0;
  return { read, total: TOTAL_CHAPTERS, done: read >= TOTAL_CHAPTERS, round: round?.number ?? 1 };
}

/** Confirms starting the Bible again from Genesis 1. */
export function StartOverSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const version = useStore((s) => s.prefs.version);
  const { read, total, done, round } = useBibleProgress();

  function start() {
    startNewRound();
    onOpenChange(false);
    router.push(readerHref(version, { book: "GEN", chapter: 1 }));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start over"
      description="Begin reading the Bible again from Genesis 1"
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <Button onClick={() => onOpenChange(false)}>Not now</Button>
          <Button variant="primary" onClick={start}>
            Begin again
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-body">
          {done
            ? `You've read all ${fmt(total)} chapters. Start your ${ordinal(round + 1)} time through, beginning at Genesis 1.`
            : `You've read ${fmt(read)} of ${fmt(total)} chapters this time through. Starting over begins again at Genesis 1.`}
        </p>
        <p className="text-callout text-text-secondary">Read marks on books and chapters clear for the new round. Your streak, notes, highlights and reading history stay.</p>
      </div>
    </Sheet>
  );
}

/** Shown on Today and Read once every chapter has been read in this round. */
export function BibleCompleteCard() {
  const [open, setOpen] = useState(false);
  const { done, total, round } = useBibleProgress();
  if (!done) return null;
  return (
    <section aria-labelledby="bible-done" className="relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-xl bg-surface px-5 py-7 text-center">
      <Lamp progress={1} size={96} />
      <div>
        <h2 id="bible-done" className="text-title">
          You&apos;ve read the whole Bible
        </h2>
        <p className="mt-1.5 text-subhead text-text-secondary">
          All {fmt(total)} chapters{round > 1 ? `, for the ${ordinal(round)} time` : ""}. Ready to begin again?
        </p>
      </div>
      <Button variant="primary" icon="refresh" onClick={() => setOpen(true)} aria-haspopup="dialog" className="w-full max-w-[360px]">
        Start over
      </Button>
      <StartOverSheet open={open} onOpenChange={setOpen} />
    </section>
  );
}

function ordinal(n: number) {
  const words = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
  if (words[n]) return words[n];
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}
