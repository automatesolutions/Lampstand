import "server-only";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";

// Shared by the Claude API routes (Pray, Explain).

export const MODEL = "claude-sonnet-5-5";

// Small per-address limit. In-memory, so it resets on restart and is per server instance.
const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, bucket: string, limit: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

export const notSetUp = (what: string) => Response.json({ error: `${what} isn't set up on this server yet.` }, { status: 503 });

interface StreamOptions {
  /** Rewrites the very end of the text once it is complete (the last `holdBack` characters are held until then). */
  finish?: (tail: string) => string;
  holdBack?: number;
  /** Called with the whole text and whether the model finished on its own (not cut off by the length limit). */
  onDone?: (text: string, complete: boolean) => void;
}

/** Streams the model's text to the browser as plain text. */
export function textResponse(stream: MessageStream, { finish, holdBack = 0, onDone }: StreamOptions = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let pending = "";
      let all = "";
      const send = (s: string) => {
        if (!s) return;
        all += s;
        controller.enqueue(encoder.encode(s));
      };
      try {
        for await (const event of stream) {
          if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
          pending += event.delta.text;
          if (pending.length > holdBack) {
            send(pending.slice(0, pending.length - holdBack));
            pending = pending.slice(pending.length - holdBack);
          }
        }
        send(finish ? finish(pending) : pending);
        const final = await stream.finalMessage();
        onDone?.(all, final.stop_reason === "end_turn");
        controller.close();
      } catch (err) {
        console.error("Claude stream failed", err);
        controller.error(err);
      }
    },
    cancel() {
      stream.abort();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

/** A response with text that is already known, in the same shape as a stream. */
export function cachedTextResponse(text: string) {
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
