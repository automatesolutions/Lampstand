"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Fleuron } from "@/components/brand/LampMark";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatRef } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { onOpenPrayer, recentChapters } from "@/lib/prayer";
import { useStore } from "@/lib/store";
import { useTextStream } from "@/lib/use-text-stream";

function listRefs(refs: ChapterRef[]) {
  const names = refs.map((r) => formatRef(r));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Pray (mounted once in the root layout): writes a short prayer from the
 * chapters read most recently, always closing "In Jesus' Name, Amen." Opens with openPrayer().
 */
export function PrayerSheet() {
  const reads = useStore((s) => s.reads);
  const [open, setOpen] = useState(false);
  const [refs, setRefs] = useState<ChapterRef[]>([]);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const prayer = useTextStream("/api/prayer");
  const { text, phase, start, stop, reset } = prayer;
  const error = copyError || prayer.error;
  const readsRef = useRef(reads);
  useEffect(() => {
    readsRef.current = reads;
  }, [reads]);

  function pray(chapters: ChapterRef[]) {
    setCopied(false);
    setCopyError("");
    start({ refs: chapters });
  }

  useEffect(
    () =>
      onOpenPrayer((current) => {
        const chapters = recentChapters(readsRef.current, current);
        setRefs(chapters);
        setOpen(true);
        setCopied(false);
        setCopyError("");
        if (chapters.length) start({ refs: chapters });
        else reset();
      }),
    [start, reset],
  );

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) stop();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text.trim()}\n\n(After reading ${listRefs(refs)})`);
      setCopied(true);
    } catch {
      setCopyError("Copy isn't available in this browser.");
    }
  }

  const busy = phase === "streaming";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pray"
      description="A short prayer from the chapters you read recently"
      footer={
        refs.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            <Button icon="copy" onClick={copy} disabled={phase !== "done"}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="primary" icon="refresh" onClick={() => pray(refs)} disabled={busy}>
              Pray again
            </Button>
          </div>
        )
      }
    >
      {refs.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-body">Prayers here are drawn from the chapters you read. Read a chapter, then come back to pray over it.</p>
          <Link href="/read" onClick={() => setOpen(false)} className="min-h-11 content-center font-medium text-gold-text">
            Choose a chapter
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-subhead text-text-secondary">Praying over {listRefs(refs)}</p>
          <div aria-busy={busy} className="min-h-[9em] font-scripture text-[1.1875rem] leading-[1.75] whitespace-pre-line">
            {text}
            {busy && (
              <span aria-hidden="true" className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.2em] animate-pulse bg-gold" />
            )}
            {busy && !text && <span className="text-text-secondary">Writing a prayer…</span>}
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-surface px-4 py-3 text-callout">
              {error}
            </p>
          )}
          <p role="status" className="sr-only">
            {phase === "done" ? "Prayer ready" : ""}
          </p>
          {phase === "done" && (
            <>
              <Fleuron className="mx-auto w-[140px]" />
              <p className="text-footnote text-text-secondary">
                Written by AI from what these chapters say. Let it start your own words to God, not replace them.
              </p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
