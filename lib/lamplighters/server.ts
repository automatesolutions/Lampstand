import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Shared by the Lamplighters routes. Each request acts as the signed-in person (their
// access token), so row-level security and the database functions still apply.

export interface Caller {
  db: SupabaseClient;
  user: User;
}

/** The signed-in person from `Authorization: Bearer <token>`, or null. */
export async function caller(req: Request): Promise<Caller | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!url || !key || !token) return null;
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { db, user: data.user };
}

export const fail = (code: string, status = 400) => Response.json({ error: code }, { status });

/** The database's error code (for example "circle_full"), passed to the browser to word. */
export const dbFail = (message: string) => fail(message.match(/^[a-z_]+(:[a-z_]+)?/)?.[0] ?? "unknown", 400);

/**
 * Links in emails use APP_URL, never the request's Host header, so nobody can make the
 * app email a link to another site. Without APP_URL, links are only shown to copy.
 */
export function appUrl(req: Request): { base: string; trusted: boolean } {
  const set = process.env.APP_URL?.replace(/\/+$/, "");
  return set ? { base: set, trusted: true } : { base: new URL(req.url).origin, trusted: false };
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Email {
  to: string;
  subject: string;
  /** Plain paragraphs; escaped here. */
  lines: string[];
  button?: { label: string; href: string };
}

/**
 * Sends through Resend when RESEND_API_KEY and EMAIL_FROM are set. Returns false when
 * email isn't set up or sending failed, so the caller can fall back (copy the link).
 */
export async function sendEmail({ to, subject, lines, button }: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  const p = (s: string) => `<p style="margin:0 0 16px;font:17px/1.5 -apple-system,Segoe UI,sans-serif;color:#241c13">${escape(s)}</p>`;
  const html = `<div style="background:#f5efe3;padding:32px 20px"><div style="max-width:480px;margin:0 auto;background:#fbf8f1;border-radius:20px;padding:28px">${lines.map(p).join("")}${
    button
      ? `<p style="margin:24px 0 8px"><a href="${escape(button.href)}" style="display:inline-block;background:#7a5810;color:#fffaf0;border-radius:14px;padding:14px 22px;font:600 17px -apple-system,Segoe UI,sans-serif;text-decoration:none">${escape(button.label)}</a></p>`
      : ""
  }<p style="margin:24px 0 0;font:13px/1.4 -apple-system,Segoe UI,sans-serif;color:#5d5244">Lampstand · Read the Bible daily, together.</p></div></div>`;
  const text = [...lines, button ? `${button.label}: ${button.href}` : ""].join("\n\n");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error("Email failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("Email failed", e);
    return false;
  }
}
