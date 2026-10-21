"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StreamPhase = "idle" | "streaming" | "done" | "error";

/** POSTs JSON and reads a plain-text streamed reply as it arrives (used by Pray and Explain). */
export function useTextStream(url: string) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const [error, setError] = useState("");
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const ctrl = useRef<AbortController | null>(null);

  const stop = useCallback(() => ctrl.current?.abort(), []);
  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (body: unknown) => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setText("");
      setError("");
      setHeaders({});
      setPhase("streaming");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: c.signal,
        });
        if (!res.ok || !res.body) {
          const d = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(d?.error ?? "That couldn't be written just now.");
        }
        setHeaders(Object.fromEntries(res.headers.entries()));
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
    },
    [url],
  );

  const reset = useCallback(() => {
    stop();
    setText("");
    setError("");
    setPhase("idle");
  }, [stop]);

  return { text, phase, error, headers, start, stop, reset };
}
