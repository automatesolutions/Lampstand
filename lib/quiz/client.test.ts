import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ supabase: () => null }));
vi.mock("@/lib/lamplighters/client", () => ({ LampError: class extends Error {} }));

import { quizError, scopeLabel, timeLeft } from "./client";

describe("challenge labels and timing", () => {
  it("names the scope", () => {
    expect(scopeLabel({ kind: "bible" })).toBe("The whole Bible");
    expect(scopeLabel({ kind: "book", book: "GEN" })).toBe("Genesis");
    expect(scopeLabel({ kind: "chapters", book: "JHN", from: 1, to: 3 })).toBe("John 1–3");
    expect(scopeLabel({ kind: "chapters", book: "JHN", from: 3, to: 3 })).toBe("John 3");
  });

  it("times a question with the database's clock, not the device's", () => {
    const started = "2026-11-14T10:00:00.000Z";
    const deviceNow = Date.parse("2026-11-14T10:00:05.000Z");
    expect(timeLeft(started, 20, 0, deviceNow)).toBe(15_000);
    // This device's clock runs 3 seconds behind the database's.
    expect(timeLeft(started, 20, 3000, deviceNow)).toBe(12_000);
    expect(timeLeft(started, 20, 0, Date.parse("2026-11-14T10:01:00.000Z"))).toBe(0);
  });

  it("words database errors for people", () => {
    expect(quizError(new Error("not_enough_questions"))).toMatch(/aren't enough questions/);
    expect(quizError(new Error("game_not_found"))).toMatch(/No open game/);
  });
});
