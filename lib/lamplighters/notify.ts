import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notificationEmail, type EmailRow } from "./notify-email";
import { appUrl, sendEmail } from "./server";

// Emails for Circle notifications (supabase/migrations/0006). The database already
// wrote one notification per person a message or nudge reached, skipping the sender
// and anyone muted or blocked. Here the server claims the ones whose owner turned on
// email, so a retried request sends nothing twice, then sends one email to each.
// Only the server (secret key) can read members' email addresses.

/**
 * Emails what `senderId` just sent in `circleId`: the chat message `messageId`, or,
 * without it, their latest nudge (one person or the whole Circle). Never throws.
 */
export async function emailNotifications(req: Request, senderId: string, circleId: string, messageId: string | null = null) {
  try {
    const admin = supabaseAdmin();
    const { base, trusted } = appUrl(req);
    if (!admin || !trusted || !process.env.RESEND_API_KEY) return;

    const { data, error } = await admin.rpc("claim_notification_emails", { p_sender: senderId, p_circle: circleId, p_message: messageId });
    if (error) throw error;
    const rows = (data ?? []) as EmailRow[];

    await Promise.all(
      rows.map(async (row) => {
        const ok = await sendEmail({ to: row.email, ...notificationEmail(row, base) });
        if (!ok) {
          // Let a later retry send it.
          await admin.from("notifications").update({ emailed_at: null }).eq("id", row.id);
          return;
        }
        if (row.nudge_id) await admin.from("nudges").update({ emailed_at: new Date().toISOString() }).eq("id", row.nudge_id);
      }),
    );
  } catch (e) {
    console.error("Circle emails failed", e);
  }
}
