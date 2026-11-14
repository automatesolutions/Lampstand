// The shared Circle notifications list (lib/lamplighters/badge). Supabase is a stand-in.

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ notifications: vi.fn(), nudges: vi.fn(), circles: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ supabase: () => ({}) }));
vi.mock("@/lib/sync", () => ({ useSyncStatus: () => ({ userId: null }) }));
vi.mock("./client", () => ({
  myNotifications: m.notifications,
  myNudges: m.nudges,
  myCircles: m.circles,
  onLampChange: () => () => {},
}));

import { getNotifications, notificationsFor, refreshNotifications } from "./badge";

const note = (id: string, read: boolean) => ({ id, kind: "message", read_at: read ? "2026-11-13T10:00:00Z" : null });

beforeEach(() => {
  notificationsFor(null);
  for (const f of Object.values(m)) f.mockReset();
});

describe("shared notifications", () => {
  it("loads the list and counts the unread ones", async () => {
    m.notifications.mockResolvedValue([note("a", false), note("b", true), note("c", false)]);
    notificationsFor("me");
    await refreshNotifications();
    expect(getNotifications().unread).toBe(2);
    expect(getNotifications().items?.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("asks once when several screens refresh at the same moment", async () => {
    m.notifications.mockResolvedValue([note("a", false)]);
    notificationsFor("me");
    await Promise.all([refreshNotifications(), refreshNotifications(), refreshNotifications()]);
    expect(m.notifications).toHaveBeenCalledTimes(1);
  });

  it("counts new nudges and unread messages on a server without notifications (before 0006)", async () => {
    m.notifications.mockRejectedValue(new Error("function my_notifications does not exist"));
    m.nudges.mockResolvedValue([{ read_at: null }, { read_at: "x" }]);
    m.circles.mockResolvedValue([{ unread_count: 2 }, { unread_count: 1 }]);
    notificationsFor("me");
    await refreshNotifications();
    expect(getNotifications()).toEqual({ items: null, unread: 4, failed: true });
  });

  it("drops an answer that arrives after signing out or switching accounts", async () => {
    let answer!: (v: unknown) => void;
    m.notifications.mockReturnValue(new Promise((r) => (answer = r)));
    notificationsFor("me");
    const pending = refreshNotifications();
    notificationsFor("someone-else");
    answer([note("a", false)]);
    await pending;
    expect(getNotifications().unread).toBe(0);
    expect(getNotifications().items).toBeNull();
  });

  it("does nothing when signed out", async () => {
    await refreshNotifications();
    expect(m.notifications).not.toHaveBeenCalled();
  });
});
