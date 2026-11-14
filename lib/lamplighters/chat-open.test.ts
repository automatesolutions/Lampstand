import { describe, expect, it } from "vitest";
import { loadedEnough, openingPoint } from "./chat-open";
import type { Message } from "./client";

const msg = (id: string, at: string, sender = "friend", deleted = false): Message => ({ id, circle_id: "c", sender_id: sender, body: id, verse: null, created_at: at, deleted_at: deleted ? at : null });
const LIST = [msg("a", "2026-11-14T08:00:00Z"), msg("b", "2026-11-14T09:00:00Z", "me"), msg("c", "2026-11-14T10:00:00Z"), msg("d", "2026-11-14T11:00:00Z")];

describe("openingPoint", () => {
  it("opens at the first message I haven't read, from someone else", () => {
    expect(openingPoint(LIST, "2026-11-14T08:30:00Z", "me", null)).toEqual({ firstUnread: "c", target: "c" }); // b is mine
  });

  it("opens at the newest when everything is read, or the chat was never opened", () => {
    expect(openingPoint(LIST, "2026-11-14T12:00:00Z", "me", null)).toEqual({ firstUnread: null, target: null });
    expect(openingPoint(LIST, null, "me", null)).toEqual({ firstUnread: null, target: null });
  });

  it("opens at the message a notification pointed at, if it's loaded", () => {
    expect(openingPoint(LIST, "2026-11-14T08:30:00Z", "me", "a")).toEqual({ firstUnread: "c", target: "a" });
    expect(openingPoint(LIST, "2026-11-14T08:30:00Z", "me", "zzz").target).toBe("c");
  });

  it("skips deleted messages", () => {
    const list = [msg("x", "2026-11-14T09:00:00Z", "friend", true), msg("y", "2026-11-14T10:00:00Z")];
    expect(openingPoint(list, "2026-11-14T08:00:00Z", "me", null).firstUnread).toBe("y");
  });
});

describe("loadedEnough", () => {
  it("wants earlier pages until the first unread and the wanted message are loaded", () => {
    expect(loadedEnough(LIST, "2026-11-14T08:30:00Z", null)).toBe(true);
    expect(loadedEnough(LIST, "2026-11-14T07:00:00Z", null)).toBe(false); // unread starts before the oldest loaded
    expect(loadedEnough(LIST, null, "zzz")).toBe(false);
    expect(loadedEnough(LIST, null, "a")).toBe(true);
    expect(loadedEnough([], null, null)).toBe(true);
  });
});
