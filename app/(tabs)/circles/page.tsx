"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountSheet } from "@/components/AccountSheet";
import { Avatar } from "@/components/lamplighters/Avatar";
import { CreateCircleSheet } from "@/components/lamplighters/CreateCircleSheet";
import { NotificationsSheet } from "@/components/lamplighters/NotificationsSheet";
import { NudgeInbox } from "@/components/lamplighters/NudgeInbox";
import { ProfileSheet } from "@/components/lamplighters/ProfileSheet";
import { EmptyState, ErrorState, LoadingRows } from "@/components/lamplighters/States";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageTitle } from "@/components/ui/NavBar";
import { useNotifications } from "@/lib/lamplighters/badge";
import { myCircles, myNudges, useLampProfile, useLampVersion, useLoad } from "@/lib/lamplighters/client";
import { accountsEnabled } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/store";

/** Circles (Lamplighters): your private reading groups, notifications, and nudges sent to you. */
export default function CirclesPage() {
  const hydrated = useHydrated();
  const me = useLampProfile();
  const signedIn = !!me.userId;
  const v = useLampVersion();
  // The same list the Circles tab dot counts (lib/lamplighters/badge), so the bell, its
  // sheet and the dot always agree. When the count changes, nudges and Circles reload too.
  const notifications = useNotifications();
  const circles = useLoad(signedIn ? myCircles : null, [me.userId, v, notifications.unread]);
  const nudges = useLoad(signedIn ? myNudges : null, [me.userId, v, notifications.unread]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shownNudge, setShownNudge] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // First visit: pick a name and avatar before anything else.
  const needsProfile = !!me.data && !me.data.display_name;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens once the profile has loaded
    if (needsProfile) setProfileOpen(true);
  }, [needsProfile]);

  const header = <PageTitle eyebrow="Lamplighters">Circles</PageTitle>;

  if (!hydrated || (accountsEnabled && !me.ready)) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <LoadingRows />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="arrive flex flex-col gap-8">
        {header}
        <EmptyState kind="signedOut">
          {accountsEnabled ? (
            <Button variant="primary" size="large" onClick={() => setSignInOpen(true)}>
              Sign in to start a Circle
            </Button>
          ) : (
            <p className="text-subhead text-text-secondary">Accounts aren&apos;t set up on this server yet.</p>
          )}
        </EmptyState>
        <ul className="flex flex-col gap-2 px-1 text-subhead text-text-secondary">
          <li>Private and invite-only. No public profiles, no strangers.</li>
          <li>See who&apos;s lit their lamp today, and send a friendly nudge.</li>
          <li>Chat, share a verse, and cheer each other on.</li>
        </ul>
        <AccountSheet open={signInOpen} onOpenChange={setSignInOpen} />
      </div>
    );
  }

  const list = circles.data ?? [];
  const newCount = notifications.unread;

  // A nudge opened from Notifications: scroll to it in the inbox and mark it for a moment.
  function showNudge(id: string) {
    setShownNudge(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`nudge-${id}`);
      el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    window.setTimeout(() => setShownNudge((s) => (s === id ? null : s)), 2400);
  }
  return (
    <div className="arrive flex flex-col gap-8">
      <div className="flex items-end justify-between gap-3">
        {header}
        <div className="mb-1 flex items-center gap-2">
          {notifications.items && (
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-haspopup="dialog"
              aria-label={newCount ? `Notifications, ${newCount} new` : "Notifications"}
              className="relative grid size-11 place-items-center rounded-full text-gold-text"
            >
              <Icon name="bell" className="size-6" />
              {newCount > 0 && (
                <span aria-hidden="true" className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[0.6875rem] font-semibold leading-5 text-bg ring-2 ring-bg">
                  {newCount > 99 ? "99+" : newCount}
                </span>
              )}
            </button>
          )}
          {me.data && (
            <button type="button" onClick={() => setProfileOpen(true)} aria-label="Your profile" className="rounded-full">
              <Avatar id={me.data.avatar_id} size={44} />
            </button>
          )}
        </div>
      </div>

      {nudges.data && <NudgeInbox nudges={nudges.data} userId={me.userId!} onChange={nudges.reload} shown={shownNudge} />}

      <section aria-labelledby="circles-heading" className="flex flex-col gap-2">
        <h2 id="circles-heading" className="px-1 text-eyebrow text-text-secondary">
          Your Circles
        </h2>
        {circles.error && !circles.data ? (
          <ErrorState message={circles.error} onRetry={circles.reload} />
        ) : !circles.data ? (
          <LoadingRows />
        ) : list.length === 0 ? (
          <EmptyState kind="emptyCircles">
            <Button variant="primary" size="large" icon="plus" onClick={() => setCreateOpen(true)}>
              Start a Circle
            </Button>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/circles/${c.id}`} className="flex min-h-[76px] items-center gap-3.5 rounded-lg bg-surface-raised px-4 py-3 shadow-soft ring-1 ring-divider/60 active:bg-gold-wash">
                  <span aria-hidden="true" className="flex shrink-0 -space-x-3">
                    {c.avatars.slice(0, 3).map((a, i) => (
                      <Avatar key={i} id={a || null} size={36} className="rounded-full ring-2 ring-surface-raised" />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-headline">{c.name}</span>
                    <span className="block text-footnote text-text-secondary">
                      {c.kind === "pair" ? "Lamplighter pair" : `${c.member_count} ${c.member_count === 1 ? "member" : "members"}`} · {c.lit_count} of {c.member_count} lamps lit today
                    </span>
                  </span>
                  {c.unread_count > 0 && (
                    <span className="grid min-w-6 place-items-center rounded-full bg-gold-strong px-1.5 py-0.5 text-footnote font-semibold text-on-gold">
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                      <span className="sr-only"> unread {c.unread_count === 1 ? "message" : "messages"}</span>
                    </span>
                  )}
                  <Icon name="chevron-right" className="size-5 text-text-tertiary" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <Button icon="plus" className="mt-1 self-start" onClick={() => setCreateOpen(true)}>
            New Circle
          </Button>
        )}
      </section>

      <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} items={notifications.items ?? []} onShowNudge={showNudge} />
      <CreateCircleSheet open={createOpen} onOpenChange={setCreateOpen} />
      {me.data && (
        <ProfileSheet key={String(profileOpen)} open={profileOpen} onOpenChange={setProfileOpen} userId={me.userId!} profile={me.data} welcome={needsProfile} />
      )}
    </div>
  );
}
