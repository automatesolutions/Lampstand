"use client";

import Link from "next/link";
import { mascotMessage } from "@/lib/lamplighters/assets";
import { myNudges, useLampVersion, useLoad } from "@/lib/lamplighters/client";
import { daysAway } from "@/lib/lamplighters/milestones";
import { today, useStore } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import { Avatar } from "./Avatar";
import { MascotSays } from "./Mascot";

/**
 * Today's mascot line: a no-guilt welcome back after missed days, a cheer once today's
 * reading is in, or a daily encouragement. Plus the newest unread nudge, if any.
 */
export function TodayMascot({ readToday }: { readToday: number }) {
  const on = useStore((s) => s.prefs.mascot);
  const reads = useStore((s) => s.reads);
  const { userId } = useSyncStatus();
  const v = useLampVersion();
  const nudges = useLoad(userId ? myNudges : null, [userId, v]);
  const nudge = nudges.data?.find((n) => !n.read_at);

  const date = today();
  const away = daysAway(reads, date);
  const message = away ? mascotMessage("welcomeBack", date, { days: away }) : readToday > 0 ? mascotMessage("readToday", date) : mascotMessage("daily", date);

  return (
    <>
      {nudge && (
        <Link href="/circles" className="flex min-h-16 items-center gap-3 rounded-lg bg-gold-wash/60 px-4 py-3 ring-1 ring-gold/40">
          <Avatar id={nudge.sender_avatar} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-headline">{nudge.sender_name} nudged you</span>
            <span className="block truncate text-subhead text-text-secondary">{nudge.message}</span>
          </span>
          <span aria-hidden="true" className="icon-[lucide--chevron-right] size-[18px] text-text-secondary" />
        </Link>
      )}
      {on && <MascotSays message={message} size={60} />}
    </>
  );
}
