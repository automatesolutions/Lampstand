import { bookByCode } from "@/lib/bible/books";
import { kjvWords } from "@/lib/bible/kjv-words";
import { formatRef } from "@/lib/bible/refs";
import { emailNotifications } from "@/lib/lamplighters/notify";
import { caller, fail } from "@/lib/lamplighters/server";

// Shares one of my highlights to one or more of my Circles (supabase/migrations/0011).
// Each share is a chat message that carries the highlight, posted as the signed-in person
// (row-level security and the message trigger apply), so the usual notifications and
// emails follow. The verse words are KJV, taken here on the server, never from the
// browser; the verses and color come from the highlight row in the account. My note and
// the summary go along only if I chose them.
//
// Body: { highlightId, circleIds: [...], note?: string, withSummary?: boolean }
// Answer: { shared: [circleId], already: [circleId], failed: { [circleId]: code } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_CIRCLES = 12;

export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return fail("sign_in_required", 401);
  const body = (await req.json().catch(() => null)) as { highlightId?: unknown; circleIds?: unknown; note?: unknown; withSummary?: unknown } | null;
  const highlightId = typeof body?.highlightId === "string" && UUID.test(body.highlightId) ? body.highlightId : null;
  const circleIds = Array.isArray(body?.circleIds) ? [...new Set(body.circleIds)] : [];
  if (!highlightId || circleIds.length === 0 || circleIds.length > MAX_CIRCLES || !circleIds.every((c) => typeof c === "string" && UUID.test(c))) return fail("bad_request");
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

  // My highlight, as the account has it (row-level security: only my own rows).
  const { data: h, error } = await who.db
    .from("highlights")
    .select("id, book, chapter, verse_start, verse_end, color, summary")
    .eq("id", highlightId)
    .maybeSingle();
  if (error || !h) return fail("highlight_not_saved", 404);

  const book = String(h.book);
  const [chapter, start, end] = [Number(h.chapter), Number(h.verse_start), Number(h.verse_end)];
  if (!bookByCode(book)) return fail("bad_request");
  const text = await kjvWords(book, chapter, start, end);
  if (!text) return fail("bad_request");
  const card: Record<string, string> = { ref: formatRef({ book, chapter, verse: start, verseEnd: end }), text };
  if (body?.withSummary === true && typeof h.summary === "string" && h.summary) card.summary = h.summary;

  const shared: string[] = [];
  const already: string[] = [];
  const failed: Record<string, string> = {};
  for (const circleId of circleIds as string[]) {
    const id = crypto.randomUUID();
    const res = await who.db.from("messages").insert({ id, circle_id: circleId, sender_id: who.user.id, body: note || null, highlight_id: highlightId, highlight: card });
    if (!res.error) {
      shared.push(circleId);
      await emailNotifications(req, who.user.id, circleId, id);
    } else if (res.error.code === "23505") already.push(circleId);
    // Not a member: row-level security refuses the insert (42501). Otherwise the trigger's code, like "bad_highlight".
    else failed[circleId] = res.error.code === "42501" ? "not_a_member" : (res.error.message.match(/^[a-z_]+(:[a-z_]+)?/)?.[0] ?? "unknown");
  }
  return Response.json({ shared, already, failed });
}
