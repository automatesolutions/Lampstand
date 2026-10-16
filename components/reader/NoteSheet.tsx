"use client";

import { useId, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { deleteNote, saveNote, type Note } from "@/lib/store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { book: string; chapter: number; verse: number | null; label: string; quote?: string };
  existing?: Note;
}

/** Note editor (screen 11). */
export function NoteSheet({ open, onOpenChange, target, existing }: Props) {
  const id = useId();
  const [body, setBody] = useState(existing?.body ?? "");
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = `${open}-${existing?.id ?? target.label}`;
  if (key !== lastKey) {
    setLastKey(key);
    setBody(existing?.body ?? "");
  }

  function save() {
    const text = body.trim();
    if (!text) return;
    saveNote({
      id: existing?.id,
      book: target.book,
      chapter: target.chapter,
      verseStart: target.verse,
      verseEnd: target.verse,
      body: text,
    });
    onOpenChange(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit note" : "Add note"}
      description={`Note on ${target.label}`}
      footer={
        <div className="flex items-center gap-3">
          {existing && (
            <Button
              variant="plain"
              className="text-danger"
              icon="trash"
              onClick={() => {
                deleteNote(existing.id);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="primary" className="ml-auto min-w-28" onClick={save} disabled={!body.trim()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <figure className="flex flex-col gap-1 border-l-2 border-gold pl-3">
          <figcaption className="text-caption text-text-secondary">{target.label}</figcaption>
          {target.quote && <blockquote className="font-scripture text-callout">{target.quote}</blockquote>}
        </figure>
        <label htmlFor={id} className="sr-only">
          Your note
        </label>
        <textarea
          id={id}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="What stood out to you?"
          className="w-full resize-none rounded-md bg-surface p-4 text-[17px] leading-6 placeholder:text-text-secondary focus-visible:outline-2"
        />
      </div>
    </Sheet>
  );
}
