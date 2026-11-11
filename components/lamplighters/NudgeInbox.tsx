"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { friendly, markNudgesRead, setMute, type Nudge } from "@/lib/lamplighters/client";
import { Avatar } from "./Avatar";
import { timeAgo } from "./States";

/** Nudges sent to me. Opening the list marks them read. */
/** `shown`: a nudge opened from Notifications, outlined for a moment. */
export function NudgeInbox({ nudges, userId, onChange, shown = null }: { nudges: Nudge[]; userId: string; onChange: () => void; shown?: string | null }) {
  const [muting, setMuting] = useState<Nudge | null>(null);
  const [status, setStatus] = useState("");
  const unread = nudges.filter((n) => !n.read_at);

  async function mute(target: { user: string } | { circle: string }, label: string) {
    try {
      await setMute(userId, target, true);
      setStatus(`Muted ${label}. Change it any time on Me.`);
      setMuting(null);
      onChange();
    } catch (e) {
      setStatus(friendly(e));
    }
  }

  if (!nudges.length) return null;
  return (
    <section aria-labelledby="nudges-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 id="nudges-heading" className="text-eyebrow text-text-secondary">
          Nudges{unread.length > 0 && ` · ${unread.length} new`}
        </h2>
        {unread.length > 0 && (
          <button type="button" onClick={() => markNudgesRead(unread.map((n) => n.id)).then(onChange, () => {})} className="min-h-11 px-1 text-subhead font-medium text-gold-text">
            Mark all read
          </button>
        )}
      </div>
      <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
        {nudges.slice(0, shown && !nudges.slice(0, 6).some((n) => n.id === shown) ? 30 : 6).map((n) => (
          <li key={n.id} id={`nudge-${n.id}`} className={`relative flex scroll-mt-24 gap-3 px-4 py-3.5 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden ${n.read_at ? "" : "bg-gold-wash/40"} ${shown === n.id ? "outline-2 -outline-offset-2 outline-gold" : ""}`}>
            <Avatar id={n.sender_avatar} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-subhead text-text-secondary">
                <strong className="font-semibold text-text">{n.sender_name}</strong> · {n.to_circle ? n.circle_name : `from ${n.circle_name}`} · <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                {!n.read_at && <span className="sr-only"> (new)</span>}
              </p>
              <p className="text-body">{n.message}</p>
              {n.note && <p className="mt-0.5 font-scripture text-subhead italic text-text-secondary">&ldquo;{n.note}&rdquo;</p>}
            </div>
            <button type="button" aria-label={`Mute options for nudges from ${n.sender_name}`} onClick={() => setMuting(n)} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-text-secondary">
              <span aria-hidden="true" className="icon-[lucide--bell-off] size-5" />
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="px-1 text-footnote text-text-secondary">
        {status}
      </p>

      <Sheet open={!!muting} onOpenChange={(o) => !o && setMuting(null)} title="Mute nudges" description="Stop nudges without telling anyone">
        {muting && (
          <div className="flex flex-col gap-2.5 pb-2">
            <p className="text-body text-text-secondary">You won&apos;t get their nudges or message alerts. Their messages still show in the chat. They won&apos;t know, and you can turn this off on Me.</p>
            <Button onClick={() => mute({ user: muting.sender_id }, `nudges from ${muting.sender_name}`)}>Mute {muting.sender_name}</Button>
            <Button onClick={() => mute({ circle: muting.circle_id }, `nudges from ${muting.circle_name}`)}>Mute all of {muting.circle_name}</Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
