// "Make a song": original lyrics from the chapters just read (Claude), sung by
// ElevenLabs Music. Shared by the sheet and the server routes; pure, so it can be tested.

import type { ChapterRef } from "@/lib/bible/types";

export type SongStyle = "praise" | "worship";

export const SONG_STYLES: { value: SongStyle; label: string }[] = [
  { value: "praise", label: "Praise" },
  { value: "worship", label: "Worship" },
];

export const SONG_CHAPTERS = 3;

export interface Lyrics {
  title: string;
  verse1: string[];
  chorus: string[];
  verse2: string[];
}

/** How each choice sounds. No artist or band is ever named. */
export const SOUND: Record<SongStyle, { positive: string[]; negative: string[]; lyrics: string }> = {
  praise: {
    positive: ["congregational worship", "upbeat", "acoustic guitar", "claps", "bright", "major key", "mixed vocals"],
    negative: ["dark", "metal", "trap", "spoken word"],
    lyrics:
      "Praise: joyful, bright and grateful, an upbeat song in a major key. The chorus thanks God for what these chapters show and is easy for a group to sing together.",
  },
  worship: {
    positive: ["intimate worship", "slow", "piano", "soft pad", "warm", "reverent", "lead vocal"],
    negative: ["fast", "EDM", "shouting", "comedic"],
    lyrics: "Worship: slow, quiet and reverent, for one voice and piano. The chorus is addressed to God directly (\"you\"), with long, simple lines.",
  },
};

// Section lengths in ms: about 68 seconds in all.
const INTRO_MS = 8_000;
const VERSE_MS = 16_000;
const CHORUS_MS = 14_000;

const lines = (heading: string, l: string[]) => [heading, ...l].join("\n");

/** The ElevenLabs composition plan: intro, verse, chorus, verse, the same chorus. */
export function compositionPlan(lyrics: Lyrics, style: SongStyle) {
  const { positive, negative } = SOUND[style];
  const chunk = (text: string, durationMs: number, positiveStyles: string[]) => ({
    text,
    durationMs,
    positiveStyles,
    negativeStyles: negative,
    contextAdherence: "high" as const,
  });
  return {
    chunks: [
      chunk("[Intro]", INTRO_MS, [...positive, "instrumental intro", "great production quality"]),
      chunk(lines("[Verse]", lyrics.verse1), VERSE_MS, [positive[0], positive[2], "verse"]),
      chunk(lines("[Chorus]", lyrics.chorus), CHORUS_MS, [positive[0], positive[1], "chorus", "fuller"]),
      chunk(lines("[Verse]", lyrics.verse2), VERSE_MS, [positive[0], positive[2], "verse"]),
      chunk(lines("[Chorus]", lyrics.chorus), CHORUS_MS, [positive[0], positive[1], "final chorus", "fuller"]),
    ],
  };
}

export const SONG_MS = INTRO_MS + 2 * VERSE_MS + 2 * CHORUS_MS;

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f[\]{}<>]/g, " ").replace(/\s+/g, " ").trim() : "");
const words = (l: Lyrics) => [...l.verse1, ...l.chorus, ...l.verse2].join(" ").split(/\s+/).filter(Boolean).length;

/**
 * Checks lyrics from the model or the browser and returns a clean copy, or null.
 * Brackets and braces are removed so a line can't become an ElevenLabs section or direction.
 */
export function checkLyrics(raw: unknown): Lyrics | null {
  const r = raw as Partial<Record<keyof Lyrics, unknown>> | null;
  if (!r || typeof r !== "object") return null;
  const block = (v: unknown) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);
  const l: Lyrics = { title: clean(r.title).slice(0, 80), verse1: block(r.verse1), chorus: block(r.chorus), verse2: block(r.verse2) };
  const ok = (b: string[]) => b.length >= 2 && b.length <= 8 && b.every((x) => x.length <= 120);
  if (!l.title || !ok(l.verse1) || !ok(l.chorus) || !ok(l.verse2)) return null;
  const n = words(l);
  return n >= 50 && n <= 180 ? l : null;
}

/** Plain text for copying. */
export function lyricsText(l: Lyrics) {
  return [l.title, "", "Verse", ...l.verse1, "", "Chorus", ...l.chorus, "", "Verse", ...l.verse2, "", "Chorus", ...l.chorus].join("\n");
}

// ---- Opening the sheet (mounted once in the root layout, like Pray) ----

const OPEN_EVENT = "lampstand:song";

export function openSong(current: ChapterRef) {
  window.dispatchEvent(new CustomEvent<ChapterRef>(OPEN_EVENT, { detail: current }));
}

export function onOpenSong(fn: (current: ChapterRef) => void) {
  const h = (e: Event) => fn((e as CustomEvent<ChapterRef>).detail);
  window.addEventListener(OPEN_EVENT, h);
  return () => window.removeEventListener(OPEN_EVENT, h);
}
