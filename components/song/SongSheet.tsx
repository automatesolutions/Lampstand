"use client";

import { useEffect, useRef, useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { Fleuron } from "@/components/brand/LampMark";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { formatRef } from "@/lib/bible/refs";
import type { ChapterRef } from "@/lib/bible/types";
import { recentChapters } from "@/lib/prayer";
import { lyricsText, onOpenSong, SONG_CHAPTERS, SONG_STYLES, type Lyrics, type SongStyle } from "@/lib/song";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";

type Phase = "idle" | "writing" | "recording" | "done" | "error";

/** Words from /api/song/lyrics, signed for this person, ready to record (within the hour). */
type SignedWords = { lyrics: Lyrics; style: SongStyle; token: string };
const stillValid = (w: SignedWords | null) => !!w && Number(w.token.split(".")[0]) > Date.now() + 30_000;

function listRefs(refs: ChapterRef[]) {
  const names = refs.map((r) => formatRef(r));
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Songs need an account: each request carries the signed-in person's access token. */
async function post(url: string, body: unknown, signal: AbortSignal): Promise<Response> {
  const token = (await supabase()?.auth.getSession())?.data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
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

  const { ready, email } = useSyncStatus();
  const signedIn = ready && !!email;
  const [signInOpen, setSignInOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [refs, setRefs] = useState<ChapterRef[]>([]);
  const [style, setStyle] = useState<SongStyle>("praise");
  const [phase, setPhase] = useState<Phase>("idle");
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  // Kept after the words are written, so a failed recording can be tried again without
  // writing (and paying for) new words.
  const [words, setWords] = useState<SignedWords | null>(null);
  const [recordFailed, setRecordFailed] = useState(false);
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
        setWords(null);
        setRecordFailed(false);
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

  const problem = (e: unknown) => (e instanceof Error && e.message !== "Failed to fetch" ? e.message : "You seem to be offline. Try again when you're connected.");

  /** Records signed words. Used after new words are written, and by Record again. */
  async function record(w: SignedWords, c: AbortController) {
    setPhase("recording");
    setRecordFailed(false);
    setError("");
    try {
      const res = await post("/api/song/audio", w, c.signal);
      replaceAudio(URL.createObjectURL(await res.blob()));
      setPhase("done");
    } catch (e) {
      if (c.signal.aborted) return;
      setError(problem(e));
      setRecordFailed(true);
      setPhase("error");
    }
  }

  function begin() {
    stop();
    const c = new AbortController();
    ctrl.current = c;
    setCopied(false);
    return c;
  }

  async function make() {
    const c = begin();
    setError("");
    setLyrics(null);
    setWords(null);
    setRecordFailed(false);
    replaceAudio(null);
    setPhase("writing");
    let w: SignedWords;
    try {
      w = (await (await post("/api/song/lyrics", { refs, style }, c.signal)).json()) as SignedWords;
    } catch (e) {
      if (c.signal.aborted) return;
      setError(problem(e));
      setPhase("error");
      return;
    }
    setLyrics(w.lyrics);
    setWords(w);
    await record(w, c);
  }

  function recordAgain() {
    if (words) record(words, begin());
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
  const canRecordAgain = phase === "error" && recordFailed && stillValid(words);

  return (
    <>
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
          {signedIn && canRecordAgain ? (
            <Button variant="primary" icon="refresh" onClick={recordAgain}>
              Record again
            </Button>
          ) : signedIn ? (
            <Button variant="primary" icon="music" onClick={make} disabled={busy || refs.length === 0}>
              {busy ? "Making…" : made ? "Make another" : "Make a song"}
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="log-in"
              onClick={() => {
                onOpenChange(false);
                setSignInOpen(true);
              }}
            >
              Sign in to make a song
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-subhead text-text-secondary">From {listRefs(refs)}</p>
        {ready && !signedIn && <p className="text-callout">Songs need an account, so the daily limit stays fair for everyone. Three songs a day.</p>}
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
        {canRecordAgain && (
          <Button variant="plain" icon="music" className="self-start" onClick={make}>
            Make new words instead
          </Button>
        )}

        {lyrics && (
          <>
            <Fleuron className="mx-auto w-[140px]" />
            <p className="text-footnote text-text-secondary">This song was written by AI from the chapters you read. It is a starting point, not a substitute for worship.</p>
          </>
        )}
      </div>
    </Sheet>
    <AccountSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </>
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
