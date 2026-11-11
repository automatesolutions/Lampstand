// The words of a Circle notification email (pure, so it can be tested). Only what the
// sender wrote in the Circle goes in: never anyone's notes or highlights.

/** A row from public.claim_notification_emails. */
export interface EmailRow {
  id: string;
  kind: "message" | "nudge";
  email: string;
  circle_id: string;
  circle_name: string;
  sender_name: string;
  body: string | null;
  verse_ref: string | null;
  verse_text: string | null;
  note: string | null;
  nudge_id: string | null;
}

const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export function notificationEmail(row: EmailRow, base: string) {
  const from = row.sender_name;
  const circle = row.circle_name;
  if (row.kind === "nudge") {
    const message = row.body ?? "";
    return {
      subject: `${from} nudged you in ${circle}: ${message}`,
      lines: [`${from} from ${circle} sent you a nudge:`, `"${message}"`, ...(row.note ? [`"${row.note}"`] : []), "Turn off nudge emails any time on Me in Lampstand."],
      button: { label: "Open Lampstand", href: `${base}/circles` },
    };
  }
  const text = row.body ?? "";
  const verse = row.verse_ref ? [`${row.verse_ref}${row.verse_text ? `: "${row.verse_text}"` : ""}`] : [];
  const preview = text || (row.verse_ref ? `shared ${row.verse_ref}` : "sent a message");
  return {
    subject: `${from} in ${circle}: ${short(preview, 60)}`,
    lines: [`${from} wrote in ${circle}:`, ...(text ? [`"${text}"`] : []), ...verse, "Turn off message emails any time on Me in Lampstand."],
    button: { label: "Open the chat", href: `${base}/chat/${row.circle_id}` },
  };
}
