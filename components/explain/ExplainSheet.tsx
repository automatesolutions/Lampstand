"use client";

import { useEffect, useState } from "react";
import { Fleuron } from "@/components/brand/LampMark";
import { Feedback } from "@/components/Feedback";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { formatRef } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { explainBlocks, onOpenExplain } from "@/lib/explain";
import { openPrayer } from "@/lib/prayer";
import { useTextStream } from "@/lib/use-text-stream";

/**
 * Explain in depth (mounted once in the root layout): a longer explanation of one
 * chapter in sections: background, what happens, key words, connections, reflection.
 * Opens with openExplain(ref).
 */
export function ExplainSheet() {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState<ChapterRef | null>(null);
  const { text, phase, error, headers, start, stop } = useTextStream("/api/explain");
  const status = headers["x-explain-status"];
  const reviewer = headers["x-explain-reviewer"] ? decodeURIComponent(headers["x-explain-reviewer"]) : null;

  useEffect(
    () =>
      onOpenExplain((r) => {
        setRef(r);
        setOpen(true);
        start(r);
      }),
    [start],
  );

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) stop();
  }

  const busy = phase === "streaming";
  const blocks = explainBlocks(text);
  const title = ref ? formatRef(ref) : "";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title ? `${title} in depth` : "In depth"}
      description="A longer explanation of this chapter"
      footer={
        phase === "error" && ref ? (
          <Button variant="primary" icon="refresh" onClick={() => start(ref)} className="w-full">
            Try again
          </Button>
        ) : phase === "done" && ref ? (
          <Button
            variant="plain"
            icon="hand-heart"
            onClick={() => {
              setOpen(false);
              openPrayer(ref);
            }}
            className="w-full"
          >
            Pray over what you read
          </Button>
        ) : undefined
      }
    >
      <div aria-busy={busy} className="flex flex-col gap-3 pb-2">
        {busy && !text && <p className="text-body text-text-secondary">Reading {title} closely…</p>}
        {blocks.map((b, i) =>
          b.kind === "heading" ? (
            <h3 key={i} className={`text-eyebrow text-gold-text ${i === 0 ? "" : "mt-4"}`}>
              {b.text}
            </h3>
          ) : b.kind === "list" ? (
            <ul key={i} className="flex flex-col gap-2 pl-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-body">
                  <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rotate-45 rounded-[1px] bg-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p key={i} className="text-body">
              {b.text}
            </p>
          ),
        )}
        {busy && text && <span aria-hidden="true" className="inline-block h-[1.1em] w-[2px] animate-pulse bg-gold" />}
        {phase === "error" && (
          <p role="alert" className="rounded-md bg-surface px-4 py-3 text-callout">
            {error}
          </p>
        )}
        <p role="status" className="sr-only">
          {phase === "done" ? "Explanation ready" : ""}
        </p>
        {phase === "done" && (
          <>
            <Fleuron className="mx-auto mt-3 w-[140px]" />
            <p className="text-footnote text-text-secondary">
              {status === "reviewed"
                ? `Written with AI from the text of ${title} (KJV) and reviewed${reviewer ? ` by ${reviewer}` : ""}.`
                : `Written by AI from the text of ${title} (KJV); not yet reviewed.`}{" "}
              Read it alongside the chapter itself; scholars and church traditions see some passages differently. Cross-references from{" "}
              <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                OpenBible.info
              </a>
              .
            </p>
            {ref && <Feedback key={`${ref.book}.${ref.chapter}`} target={{ kind: "explanation", book: ref.book, chapter: ref.chapter }} />}
          </>
        )}
      </div>
    </Sheet>
  );
}
