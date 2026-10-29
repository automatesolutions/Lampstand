// Lamplighters settings. The database enforces the limits (supabase/migrations/0005);
// these copies are for the screens. Change both together.

export const LAMPLIGHTERS = {
  /** Mirrors public.circle_member_limit(). */
  maxMembers: 12,
  nudgesPerDay: 3,
  nudgeMessageMax: 80,
  nudgeNoteMax: 140,
  messageMax: 1000,
  circleNameMax: 40,
  circleDescriptionMax: 200,
  displayNameMax: 40,
  chatPageSize: 30,
  inviteDays: 7,
  nudgePresets: ["Time to light your lamp!", "Thinking of you, ready to read?", "Saving you a seat in the Word today", "Quick chapter together?"],
  reactions: ["🙏", "🔥"] as const,
} as const;

export type ShareLevel = "none" | "streaks" | "chapters";

export const SHARE_LEVELS: { value: ShareLevel; label: string; detail: string }[] = [
  { value: "none", label: "Just the lamp", detail: "Your Circles see only whether you've read today." },
  { value: "streaks", label: "Streak", detail: "Also your streak and streak milestones." },
  { value: "chapters", label: "Chapters", detail: "Also the chapters you finish and how many this week." },
];
