"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { friendly, sendNudge } from "@/lib/lamplighters/client";
import { LAMPLIGHTERS } from "@/lib/lamplighters/config";
import { Avatar } from "./Avatar";

interface Props {
  circleId: string;
  /** null = the whole Circle. */
  to: { id: string; name: string; avatar: string | null } | null;
  circleName: string;
  myAvatar: string | null;
  onClose: () => void;
  onSent: (message: string) => void;
}

/** A friendly reminder to read today: a preset line plus an optional note. */
export function NudgeSheet({ circleId, to, circleName, myAvatar, onClose, onSent }: Props) {
  const [message, setMessage] = useState<string>(LAMPLIGHTERS.nudgePresets[0]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const name = to?.name ?? circleName;

  async function send() {
    setSending(true);
    setError("");
    try {
      await sendNudge(circleId, to?.id ?? null, message, note.trim());
      onSent(to ? `Nudge sent to ${to.name}.` : `Nudge sent to ${circleName}.`);
      onClose();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Nudge ${name}`}
      description={to ? `A friendly reminder for ${to.name} to read today` : "A friendly reminder for everyone who hasn't read today"}
      footer={
        <Button variant="primary" size="large" icon="send" onClick={send} disabled={sending}>
          {sending ? "Sending…" : "Send nudge"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div role="radiogroup" aria-label="Message" className="flex flex-col gap-2">
          {LAMPLIGHTERS.nudgePresets.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={message === p}
              onClick={() => setMessage(p)}
              className={`flex min-h-12 items-center justify-between gap-3 rounded-md px-4 text-left text-body ${message === p ? "bg-gold-wash ring-2 ring-gold" : "bg-surface"}`}
            >
              {p}
              {message === p && <span aria-hidden="true" className="icon-[lucide--check] size-5 text-gold-text" />}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">Add a note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={LAMPLIGHTERS.nudgeNoteMax}
            placeholder="Psalm 23 is a good one today"
            className="min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
          />
        </label>

        <div aria-hidden="true" className="flex items-start gap-3 rounded-lg bg-surface px-4 py-3.5">
          <Avatar id={myAvatar} size={36} />
          <div className="min-w-0">
            <p className="text-footnote text-text-secondary">Preview</p>
            <p className="text-body">{message}</p>
            {note.trim() && <p className="font-scripture text-subhead italic text-text-secondary">&ldquo;{note.trim()}&rdquo;</p>}
          </div>
          {to && <Avatar id={to.avatar} size={28} className="ml-auto" />}
        </div>

        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
        <p className="text-footnote text-text-secondary">
          Up to {LAMPLIGHTERS.nudgesPerDay} nudges a day, one per person. People who already read today won&apos;t get one.
        </p>
      </div>
    </Sheet>
  );
}
