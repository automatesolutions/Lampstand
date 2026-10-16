"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Fleuron } from "@/components/brand/LampMark";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatRef } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { onOpenPrayer, recentChapters } from "@/lib/prayer";
import { useStore } from "@/lib/store";

type Phase = "idle" | "praying" | "done" | "error";

function listRefs(refs: ChapterRef[]) {
  const names = refs.map((r) => formatRef(r));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Pray (mounted once in the root layout): writes a short prayer from the
 * chapters read most recently. Opens with openPrayer().
 */
export function PrayerSheet() {
  const reads = useStore((s) => s.reads);
  const [open, setOpen] = useState(false);
  const [refs, setRefs] = useState<ChapterRef[]>([]);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const readsRef = useRef(reads);
  useEffect(() => {
    readsRef.current = reads;
  }, [reads]);

  const pray = useCallback(async (chapters: ChapterRef[]) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setText("");
    setError("");
    setCopied(false);
    setPhase("praying");
    try {
      const res = await fetch("/api/prayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refs: chapters }),
        signal: c.signal,
      });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d?.error ?? "The prayer couldn't be written just now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        setText((t) => t + decoder.decode(value, { stream: true }));
      }
      setPhase("done");
    } catch (e) {
      if (c.signal.aborted) return;
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "You seem to be offline. Try again when you're connected.");
      setPhase("error");
    }
  }, []);

  useEffect(
    () =>
      onOpenPrayer((current) => {
        const chapters = recentChapters(readsRef.current, current);
        setRefs(chapters);
        setOpen(true);
        if (chapters.length) pray(chapters);
        else setPhase("idle");
      }),
    [pray],
  );

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) ctrl.current?.abort();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text.trim()}\n\n(After reading ${listRefs(refs)})`);
      setCopied(true);
    } catch {
      setError("Copy isn't available in this browser.");
    }
  }

  const busy = phase === "praying";

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
          {phase === "error" && (
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
