"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { formatRef } from "@/lib/bible/refs";
import type { Chapter } from "@/lib/bible/types";
import { SPEEDS, verseAtTime } from "@/lib/narration/timing";
import { setPrefs, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync";

export type ListenVoice = "device" | "natural";

/**
 * Listen to the chapter (DESIGN.md §8 Listen). The device voice reads one verse at a time,
 * free, in any version. The natural voice (KJV) plays a recording made once per chapter
 * and shared by everyone; making one needs sign-in and stays inside the day's limits. Either
 * way the verse being read is highlighted and kept in view.
 */
export function ListenPlayer({ chapter, onVerse, onClose }: { chapter: Chapter; onVerse: (verse: number | null) => void; onClose: () => void }) {
  const prefs = useStore((s) => s.prefs);
  const speed = SPEEDS.includes(prefs.listenSpeed as (typeof SPEEDS)[number]) ? prefs.listenSpeed! : 1;
  const { userId } = useSyncStatus();
  const naturalAllowed = chapter.version === "KJV";
  const [voice, setVoice] = useState<ListenVoice>(naturalAllowed && prefs.listenVoice === "natural" ? "natural" : "device");
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0); // 0-based verse being read
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState<{ url: string; starts: number[] } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const verses = chapter.verses.filter((v) => v.text);
  const title = formatRef(chapter);

  useEffect(() => onVerse(playing || index > 0 ? (verses[index]?.number ?? null) : null), [index, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Device voice ---------------------------------------------------------------
  const token = useRef(0); // bumps on every stop, so an old verse's "end" can't start the next one
  // A plain function (not useCallback) so a verse's end can start the next one.
  function speak(i: number) {
    {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth) {
        setStatus("This browser can't read aloud. Try another browser, or the natural voice.");
        return;
      }
      synth.cancel();
      const mine = ++token.current;
      if (i >= verses.length) {
        setPlaying(false);
        setIndex(0);
        return;
      }
      setIndex(i);
      setPlaying(true);
      const u = new SpeechSynthesisUtterance(verses[i].text);
      u.rate = speed;
      u.lang = "en-US";
      const en = synth.getVoices().find((x) => x.lang.startsWith("en") && x.localService) ?? synth.getVoices().find((x) => x.lang.startsWith("en"));
      if (en) u.voice = en;
      u.onend = () => token.current === mine && speak(i + 1);
      synth.speak(u);
    }
  }
  const stopDevice = () => {
    token.current++;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  };

  // ---- Natural voice ----------------------------------------------------------------
  async function prepareNatural(): Promise<{ url: string; starts: number[] } | null> {
    if (recording) return recording;
    setPreparing(true);
    setStatus("");
    try {
      const ask = async (method: "GET" | "POST") => {
        const headers: Record<string, string> = { "content-type": "application/json" };
        const t = (await supabase()?.auth.getSession())?.data.session?.access_token;
        if (t) headers.authorization = `Bearer ${t}`;
        const url = method === "GET" ? `/api/narration?book=${chapter.book}&chapter=${chapter.chapter}` : "/api/narration";
        const res = await fetch(url, { method, headers, body: method === "POST" ? JSON.stringify({ book: chapter.book, chapter: chapter.chapter }) : undefined });
        return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as { ready?: boolean; url?: string; verseStarts?: number[]; error?: string; code?: string } };
      };
      let r = await ask("GET");
      if (r.ok && !r.data.ready) {
        if (!userId) throw new Error("Sign in for the natural voice. The device voice is reading for now.");
        setStatus(`Recording ${title} in the natural voice. The first time takes a few seconds.`);
        r = await ask("POST");
        // Someone else is recording it right now: wait a moment and look again.
        for (let tries = 0; r.data.code === "preparing" && tries < 10; tries++) {
          await new Promise((ok) => setTimeout(ok, 3000));
          r = await ask("GET");
          if (r.data.ready) break;
        }
      }
      if (!r.ok || !r.data.ready || !r.data.url) throw new Error(r.data.error ?? "The natural voice isn't ready. The device voice is reading for now.");
      const rec = { url: r.data.url, starts: r.data.verseStarts ?? [] };
      setRecording(rec);
      setStatus("");
      return rec;
    } catch (e) {
      setStatus(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "You seem to be offline. The device voice is reading for now.");
      setVoice("device");
      return null;
    } finally {
      setPreparing(false);
    }
  }

  async function playNatural(i: number) {
    const rec = await prepareNatural();
    if (!rec) return speak(i); // fall back to the device voice
    let a = audio.current;
    if (!a) {
      a = new Audio(rec.url);
      audio.current = a;
      a.ontimeupdate = () => setIndex(verseAtTime(rec.starts, a!.currentTime));
      a.onended = () => {
        setPlaying(false);
        setIndex(0);
      };
    }
    a.playbackRate = speed;
    if (rec.starts[i] != null) a.currentTime = rec.starts[i];
    setIndex(i);
    try {
      await a.play();
      setPlaying(true);
    } catch {
      setStatus("Press Play to start.");
    }
  }

  // ---- Controls ------------------------------------------------------------------------
  const play = (i = index) => (voice === "natural" ? playNatural(i) : speak(i));
  const pause = () => {
    if (voice === "natural") audio.current?.pause();
    else stopDevice(); // the device voice restarts the verse on Play (pausing mid-word isn't reliable everywhere)
    setPlaying(false);
  };
  const go = (step: number) => {
    const i = Math.max(0, Math.min(verses.length - 1, index + step));
    if (playing) play(i);
    else setIndex(i);
  };
  const changeVoice = (v: ListenVoice) => {
    pause();
    setVoice(v);
    setPrefs({ listenVoice: v });
  };
  const changeSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    setPrefs({ listenSpeed: next });
    if (audio.current) audio.current.playbackRate = next;
    if (playing && voice === "device") setTimeout(() => speak(index), 0); // new rate from this verse
  };

  // Leaving the chapter or closing stops everything.
  useEffect(
    () => () => {
      token.current++;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      audio.current?.pause();
    },
    [],
  );

  const btn = "grid size-11 place-items-center rounded-full text-gold-text disabled:text-text-tertiary";
  return (
    <div role="region" aria-label={`Listen to ${title}`} className="flex flex-col gap-2 rounded-[22px] bg-surface-raised p-3 shadow-float">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Previous verse" className={btn}>
          <Icon name="chevron-left" className="size-6" />
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          disabled={preparing}
          aria-label={playing ? "Pause" : `Play from verse ${verses[index]?.number ?? 1}`}
          className="grid size-12 place-items-center rounded-full bg-gold-strong text-on-gold disabled:opacity-50"
        >
          <span aria-hidden="true" className={playing ? "icon-[lucide--pause] size-6" : "icon-[lucide--play] size-6"} />
        </button>
        <button type="button" onClick={() => go(1)} disabled={index >= verses.length - 1} aria-label="Next verse" className={btn}>
          <Icon name="chevron-right" className="size-6" />
        </button>
        <span className="min-w-0 flex-1 px-1">
          <span className="block truncate text-headline">{title}</span>
          <span className="block truncate text-footnote text-text-secondary" aria-live="polite">
            {preparing ? "Getting the natural voice ready" : `Verse ${verses[index]?.number ?? 1} · ${voice === "natural" ? "Natural voice" : "Device voice"}`}
          </span>
        </span>
        <button type="button" onClick={changeSpeed} aria-label={`Speed ${speed} times. Change speed`} className="min-h-11 min-w-11 rounded-full px-2 text-subhead font-semibold tabular-nums text-gold-text">
          {speed}×
        </button>
        <button
          type="button"
          onClick={() => {
            pause();
            onVerse(null);
            onClose();
          }}
          aria-label="Stop and close"
          className={btn}
        >
          <Icon name="x" className="size-[22px]" />
        </button>
      </div>
      <div role="radiogroup" aria-label="Voice" className="flex gap-2">
        {(["device", "natural"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={voice === v}
            disabled={v === "natural" && !naturalAllowed}
            onClick={() => changeVoice(v)}
            className={`min-h-11 flex-1 rounded-[12px] px-3 text-subhead font-medium disabled:opacity-50 ${voice === v ? "bg-gold-wash text-text ring-1 ring-gold" : "bg-surface text-text-secondary"}`}
          >
            {v === "device" ? "Device voice" : "Natural voice"}
          </button>
        ))}
      </div>
      {(status || !naturalAllowed) && (
        <p role="status" className="px-1 text-footnote text-text-secondary">
          {status || "The natural voice reads the KJV. Switch to KJV to hear it; the device voice reads this version."}
        </p>
      )}
    </div>
  );
}
