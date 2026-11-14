import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";

// Shared by the Claude API routes (Pray, Explain, highlight summaries, songs).

export const MODEL = "claude-sonnet-5-5";

/**
 * The address the request came from. A browser can send any X-Forwarded-For it likes;
 * the proxies in front of the app append the address they saw, so only the values on the
 * right are trustworthy. Cloud Run adds one (TRUSTED_PROXY_HOPS=1, the default); with a
 * Google load balancer in front as well, set TRUSTED_PROXY_HOPS=2.
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)) || 1);
  const parts = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length) return parts[Math.max(0, parts.length - hops)];
  return req.headers.get("x-real-ip")?.trim() || "local"; // local development
}

/**
 * The address as one limit counts it. IPv6 is cut to its /64 network: one home or phone
 * usually holds a whole /64 and can pick new addresses inside it at will.
 */
export function ipKey(ip: string): string {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.toLowerCase().split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

// Short burst limit per address. In-memory, so it resets on restart and is per server
// instance; the daily limits that matter for cost are durable (lib/ai/usage.ts).
const WINDOW_MS = 10 * 60_000;
const MAX_KEYS = 5000;
const hits = new Map<string, { times: number[]; windowMs: number }>();

/** Makes room without forgetting anyone still inside their window, unless there is no other way. */
function makeRoom(now: number) {
  for (const [k, v] of hits) if (now - v.times[v.times.length - 1] >= v.windowMs) hits.delete(k);
  // Still full: drop the least recently used (a Map keeps insertion order; see below).
  for (const k of hits.keys()) {
    if (hits.size <= MAX_KEYS * 0.9) break;
    hits.delete(k);
  }
}

/** True when this address made `limit` requests in the window (10 minutes unless given). */
export function rateLimited(req: Request, bucket: string, limit: number, windowMs = WINDOW_MS) {
  const key = `${bucket}:${ipKey(clientIp(req))}`;
  const now = Date.now();
  const recent = (hits.get(key)?.times ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.delete(key); // re-insert, so the Map stays ordered from least to most recently used
  hits.set(key, { times: recent, windowMs });
  if (hits.size > MAX_KEYS) makeRoom(now);
  return false;
}

/** For tests: forget every burst limit. */
export function resetRateLimits() {
  hits.clear();
}

export const notSetUp = (what: string) => Response.json({ error: `${what} isn't set up on this server yet.` }, { status: 503 });

interface StreamOptions {
  /** Rewrites the very end of the text once it is complete (the last `holdBack` characters are held until then). */
  finish?: (tail: string) => string;
  holdBack?: number;
  /** Called with the whole text, whether the model finished on its own (not cut off), and the final message (for usage). */
  onDone?: (text: string, complete: boolean, final: Anthropic.Message) => void;
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
        onDone?.(all, final.stop_reason === "end_turn", final);
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
