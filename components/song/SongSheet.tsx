"use client";

import { useEffect, useRef, useState } from "react";
import { Fleuron } from "@/components/brand/LampMark";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { formatRef } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { recentChapters } from "@/lib/prayer";
import { lyricsText, onOpenSong, SONG_CHAPTERS, SONG_STYLES, type Lyrics, type SongStyle } from "@/lib/song";
import { useStore } from "@/lib/store";

type Phase = "idle" | "writing" | "recording" | "done" | "error";

function listRefs(refs: ChapterRef[]) {
  const names = refs.map((r) => formatRef(r));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

async function post(url: string, body: unknown, signal: AbortSignal): Promise<Response> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const d = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(d?.error ?? "That couldn't be made just now. Try again in a moment.");
  }
  return res;
}

/**
 * Make a song (mounted once in the root layout): after a chapter is marked read, writes
 * original lyrics from it and the chapters before it, then records them sung. Opens
 * with openSong(chapter), only from the reader's chapter-done card.
 */
export function SongSheet() {
  const reads = useStore((s) => s.reads);
  const readsRef = useRef(reads);
  useEffect(() => {
    readsRef.current = reads;
  }, [reads]);

  const [open, setOpen] = useState(false);
  const [refs, setRefs] = useState<ChapterRef[]>([]);
  const [style, setStyle] = useState<SongStyle>("praise");
  const [phase, setPhase] = useState<Phase>("idle");
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

  const replaceAudio = (url: string | null) =>
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });

  function stop() {
    ctrl.current?.abort();
    audio.current?.pause();
  }

  useEffect(
    () =>
      onOpenSong((current) => {
        stop();
        setRefs(recentChapters(readsRef.current, current, SONG_CHAPTERS));
        setOpen(true);
        setPhase("idle");
        setLyrics(null);
        replaceAudio(null);
        setError("");
        setCopied(false);
      }),
    [],
  );

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) stop(); // closing stops playback and any song still being made
  }

  async function make() {
    stop();
    const c = new AbortController();
    ctrl.current = c;
    setError("");
    setCopied(false);
    setLyrics(null);
    replaceAudio(null);
    setPhase("writing");
    try {
      const words = (await (await post("/api/song/lyrics", { refs, style }, c.signal)).json()) as { lyrics: Lyrics; style: SongStyle; token: string };
      setLyrics(words.lyrics);
      setPhase("recording");
      const res = await post("/api/song/audio", words, c.signal);
      replaceAudio(URL.createObjectURL(await res.blob()));
      setPhase("done");
    } catch (e) {
      if (c.signal.aborted) return;
      setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "You seem to be offline. Try again when you're connected.");
      setPhase("error");
    }
  }

  async function copy() {
    if (!lyrics) return;
    try {
      await navigator.clipboard.writeText(`${lyricsText(lyrics)}\n\n(From ${listRefs(refs)})`);
      setCopied(true);
    } catch {
      setError("Copy isn't available in this browser.");
    }
  }

  const busy = phase === "writing" || phase === "recording";
  const made = phase === "done" || (phase === "error" && !!lyrics);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Make a song"
      description="Original words from the chapters you read, sung"
      footer={
        <div className={lyrics ? "grid grid-cols-2 gap-2.5" : "grid"}>
          {lyrics && (
            <Button icon="copy" onClick={copy} disabled={busy}>
              {copied ? "Copied" : "Copy words"}
            </Button>
          )}
          <Button variant="primary" icon="music" onClick={make} disabled={busy || refs.length === 0}>
            {busy ? "Making…" : made ? "Make another" : "Make a song"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-subhead text-text-secondary">From {listRefs(refs)}</p>
        <Segmented label="Kind of song" value={style} options={SONG_STYLES} onChange={setStyle} />
        <p className="text-footnote text-text-secondary">
          {style === "praise" ? "Joyful and bright: acoustic guitar, light drums, voices together." : "Slow and quiet: piano, a soft pad, one voice."}
        </p>

        <p role="status" aria-live="polite" className={busy ? "text-subhead font-medium text-gold-text" : "sr-only"}>
          {phase === "writing" ? "Writing the words…" : phase === "recording" ? "Recording the song…" : phase === "done" ? "Your song is ready" : ""}
        </p>

        {lyrics && (
          <article aria-label={`Song: ${lyrics.title}`} className="flex flex-col gap-4 font-scripture text-[1.1875rem] leading-[1.75]">
            <h3 className="font-scripture text-title text-gold-text">{lyrics.title}</h3>
            <Stanza label="Verse" lines={lyrics.verse1} />
            <Stanza label="Chorus" lines={lyrics.chorus} />
            <Stanza label="Verse" lines={lyrics.verse2} />
            <Stanza label="Chorus" lines={lyrics.chorus} />
          </article>
        )}

        {audioUrl && (
          <audio ref={audio} controls src={audioUrl} className="w-full" aria-label={lyrics ? `${lyrics.title}, sung` : "Your song"} />
        )}

        {error && (
          <p role="alert" className="rounded-md bg-surface px-4 py-3 text-callout">
            {error}
          </p>
        )}

        {lyrics && (
          <>
            <Fleuron className="mx-auto w-[140px]" />
            <p className="text-footnote text-text-secondary">This song was written by AI from the chapters you read. It is a starting point, not a substitute for worship.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Stanza({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      <p className="font-sans text-eyebrow text-text-secondary">{label}</p>
      {lines.map((l, i) => (
        <p key={i}>{l}</p>
      ))}
    </div>
  );
}
