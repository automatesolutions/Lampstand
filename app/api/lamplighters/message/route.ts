import { caller, dbFail, fail } from "@/lib/lamplighters/server";
import { emailNotifications } from "@/lib/lamplighters/notify";

// Posts a chat message as the signed-in person (row-level security and the message
// trigger in supabase/migrations/0005 still apply). The database writes a notification
// for every other member who hasn't muted or blocked the sender (0006); this route then
// emails the ones who turned on message emails. The app picks the message id, so a
// retried send returns the first copy and never posts or emails twice.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COLUMNS = "id, circle_id, sender_id, body, verse, created_at, deleted_at";

export async function POST(req: Request) {
  const who = await caller(req);
  if (!who) return fail("sign_in_required", 401);
  const body = (await req.json().catch(() => null)) as { id?: unknown; circleId?: unknown; body?: unknown; verse?: unknown } | null;
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  const circleId = typeof body?.circleId === "string" && UUID.test(body.circleId) ? body.circleId : null;
  const text = typeof body?.body === "string" ? body.body : "";
  const v = body?.verse as { ref?: unknown; text?: unknown } | null | undefined;
  const verse = v && typeof v.ref === "string" && typeof v.text === "string" ? { ref: v.ref, text: v.text } : null;
  if (!id || !circleId || (v != null && !verse)) return fail("bad_request");

  let { data: message, error } = await who.db
    .from("messages")
    .insert({ id, circle_id: circleId, sender_id: who.user.id, body: text || null, verse })
    .select(COLUMNS)
    .single();
  if (error?.code === "23505") {
    // Sent already (a retry): return that copy.
    ({ data: message, error } = await who.db.from("messages").select(COLUMNS).eq("id", id).eq("sender_id", who.user.id).single());
  }
  if (error || !message) return dbFail(error?.message ?? "unknown");

  await emailNotifications(req, who.user.id, circleId, id);
  return Response.json(message);
}
