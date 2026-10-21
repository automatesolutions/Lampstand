"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase/client";

export interface FeedbackTarget {
  kind: "explanation" | "prayer";
  book?: string;
  chapter?: number;
  refs?: string;
  /** Sent only with a report, so a wrong prayer can be checked. */
  content?: string;
}

type State = "ask" | "explain" | "sending" | "thanks" | "failed";

/** "Was this helpful?" under an explanation or prayer. Saved to Supabase (feedback table). */
export function Feedback({ target }: { target: FeedbackTarget }) {
  const [state, setState] = useState<State>("ask");
  const [comment, setComment] = useState("");

  async function send(helpful: boolean) {
    const db = supabase();
    if (!db) {
      setState("failed");
      return;
    }
    setState("sending");
    const { error } = await db.from("feedback").insert({
      kind: target.kind,
      book: target.book ?? null,
      chapter: target.chapter ?? null,
      refs: target.refs ?? null,
      helpful,
      comment: comment.trim().slice(0, 1000) || null,
      content: helpful ? null : (target.content?.slice(0, 4000) ?? null),
    });
    setState(error ? "failed" : "thanks");
  }

  if (state === "thanks") return <p role="status" className="text-footnote text-text-secondary">Thank you. Your feedback helps us improve these.</p>;
  if (state === "failed")
    return (
      <p role="alert" className="text-footnote text-text-secondary">
        Your feedback couldn&apos;t be sent just now.
      </p>
    );

  if (state === "explain" || (state === "sending" && comment))
    return (
      <form
        className="flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(false);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-footnote text-text-secondary">What&apos;s wrong? (optional)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="For example: a verse is wrong, or the tone isn't right"
            className="rounded-md bg-surface px-3.5 py-3 text-callout outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
          />
        </label>
        {target.kind === "prayer" && <p className="text-footnote text-text-secondary">Sending includes this prayer so it can be checked.</p>}
        <div className="flex gap-2.5">
          <Button type="submit" variant="primary" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Send"}
          </Button>
          <Button variant="plain" onClick={() => setState("ask")}>
            Cancel
          </Button>
        </div>
      </form>
    );

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" role="group" aria-label="Feedback">
      <span className="text-footnote text-text-secondary">Was this helpful?</span>
      <button type="button" onClick={() => send(true)} disabled={state === "sending"} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-footnote font-medium text-gold-text">
        <Icon name="check" className="size-4" />
        Helpful
      </button>
      <button type="button" onClick={() => setState("explain")} disabled={state === "sending"} className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-footnote font-medium text-gold-text">
        <Icon name="info" className="size-4" />
        Something&apos;s wrong
      </button>
    </div>
  );
}
