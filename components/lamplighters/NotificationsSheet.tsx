"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { markNotificationsRead, type LampNotification } from "@/lib/lamplighters/client";
import { Avatar } from "./Avatar";
import { timeAgo } from "./States";

/**
 * Chat messages and nudges that reached me, newest first. Tapping one marks it read
 * and opens it: a message opens that Circle's chat, a nudge shows it in the inbox.
 */
export function NotificationsSheet({
  open,
  onOpenChange,
  items,
  onShowNudge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LampNotification[];
  onShowNudge: (nudgeId: string) => void;
}) {
  const router = useRouter();
  const unread = items.filter((n) => !n.read_at);

  function openItem(n: LampNotification) {
    if (!n.read_at) markNotificationsRead([n.id]).catch(() => {});
    onOpenChange(false);
    if (n.kind === "message") router.push(`/chat/${n.circle_id}`);
    else if (n.nudge_id) onShowNudge(n.nudge_id);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Notifications"
      description="Messages and nudges from your Circles"
      footer={
        unread.length > 0 ? (
          <Button className="w-full" onClick={() => markNotificationsRead(unread.map((n) => n.id)).catch(() => {})}>
            Mark all read
          </Button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="bell" className="size-8 text-gold" />
          <p className="text-headline">Nothing new</p>
          <p className="max-w-[30ch] text-subhead text-text-secondary">Messages and nudges from your Circles show up here.</p>
        </div>
      ) : (
        <ul className="-mx-5 flex flex-col">
          {items.map((n) => (
            <li key={n.id} className="relative after:absolute after:inset-x-5 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
              <button
                type="button"
                onClick={() => openItem(n)}
                className={`flex min-h-16 w-full gap-3 px-5 py-3.5 text-left active:bg-gold-wash ${n.read_at ? "" : "bg-gold-wash/40"}`}
              >
                <Avatar id={n.sender_avatar} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-subhead text-text-secondary">
                    <strong className="font-semibold text-text">{n.sender_name}</strong> · {n.circle_name} · <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                    {!n.read_at && <span className="sr-only"> (new)</span>}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-body">{describe(n)}</span>
                  {n.kind === "nudge" && n.note && <span className="mt-0.5 line-clamp-2 block font-scripture text-subhead italic text-text-secondary">&ldquo;{n.note}&rdquo;</span>}
                </span>
                <Icon name={n.kind === "message" ? "message-circle" : "bell"} className="mt-1 size-5 text-text-tertiary" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function describe(n: LampNotification): string {
  if (n.kind === "nudge") return `${n.to_circle ? "Nudged the Circle" : "Nudged you"}: ${n.body ?? ""}`;
  if (n.body) return n.body;
  return n.verse_ref ? `Shared ${n.verse_ref}` : "Sent a message";
}
