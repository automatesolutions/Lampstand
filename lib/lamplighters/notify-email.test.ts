import { describe, expect, it } from "vitest";
import { notificationEmail, type EmailRow } from "./notify-email";

const row = (r: Partial<EmailRow>): EmailRow => ({
  id: "n1",
  kind: "message",
  email: "bob@example.com",
  circle_id: "c1",
  circle_name: "Morning Lamps",
  sender_name: "Ana",
  body: null,
  verse_ref: null,
  verse_text: null,
  note: null,
  nudge_id: null,
  ...r,
});

describe("notification emails", () => {
  it("names the sender and Circle, includes the message, and links to the chat", () => {
    const e = notificationEmail(row({ body: "Psalm 23 tonight?" }), "https://lampstand.dev");
    expect(e.subject).toBe("Ana in Morning Lamps: Psalm 23 tonight?");
    expect(e.lines).toContain('"Psalm 23 tonight?"');
    expect(e.button).toEqual({ label: "Open the chat", href: "https://lampstand.dev/chat/c1" });
  });

  it("includes a shared verse and shortens long subjects", () => {
    const e = notificationEmail(row({ body: "x".repeat(200), verse_ref: "John 3:16", verse_text: "For God so loved the world" }), "https://lampstand.dev");
    expect(e.subject.length).toBeLessThan(90);
    expect(e.lines).toContain('John 3:16: "For God so loved the world"');
    expect(notificationEmail(row({ verse_ref: "John 3:16" }), "b").subject).toBe("Ana in Morning Lamps: shared John 3:16");
  });

  it("includes the nudge and its note, with a button back to Circles", () => {
    const e = notificationEmail(row({ kind: "nudge", body: "Time to light your lamp!", note: "Psalm 1?", nudge_id: "x" }), "https://lampstand.dev");
    expect(e.subject).toBe("Ana nudged you in Morning Lamps: Time to light your lamp!");
    expect(e.lines).toEqual(expect.arrayContaining(['"Time to light your lamp!"', '"Psalm 1?"']));
    expect(e.button.href).toBe("https://lampstand.dev/circles");
  });
});
