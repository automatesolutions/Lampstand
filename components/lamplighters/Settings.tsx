"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ListGroup, ListRow } from "@/components/ui/List";
import { Sheet } from "@/components/ui/Sheet";
import { avatarLabel } from "@/lib/lamplighters/assets";
import { deleteAccount, friendly, myMutes, setMute, updateProfile, useLampProfile, useLampVersion, useLoad } from "@/lib/lamplighters/client";
import { SHARE_LEVELS, type ShareLevel } from "@/lib/lamplighters/config";
import { setPrefs, useStore } from "@/lib/store";
import { signOut } from "@/lib/sync";
import { Avatar } from "./Avatar";
import { ProfileSheet } from "./ProfileSheet";

/** The mascot switch. On the device, so it works for guests too (synced when signed in). */
export function MascotSetting() {
  const on = useStore((s) => s.prefs.mascot);
  return (
    <ListRow
      title="Mascot celebrations"
      subtitle={on ? "Cheers when you finish a chapter or reach a milestone" : "Off. No pop-ups or messages"}
      icon="party-popper"
      selected={on}
      onClick={() => setPrefs({ mascot: !on })}
    />
  );
}

/** Lamplighters settings on Me, for signed-in readers. */
export function LamplighterSettings() {
  const me = useLampProfile();
  const v = useLampVersion();
  const mutes = useLoad(me.userId ? myMutes : null, [me.userId, v]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!me.userId || !me.data) return null;
  const p = me.data;
  const uid = me.userId;
  const share = SHARE_LEVELS.find((s) => s.value === p.share_level) ?? SHARE_LEVELS[0];
  const muteCount = mutes.data?.length ?? 0;

  const save = (patch: Parameters<typeof updateProfile>[1], said: string) =>
    updateProfile(uid, patch).then(
      () => setStatus(said),
      (e) => setStatus(friendly(e)),
    );

  async function unmuteAll() {
    try {
      for (const m of mutes.data ?? []) await setMute(uid, m.muted_user_id ? { user: m.muted_user_id } : { circle: m.muted_circle_id! }, false);
      setStatus("Nudges and message alerts are back on from everyone.");
    } catch (e) {
      setStatus(friendly(e));
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut();
      setDeleteOpen(false);
      setStatus("Your account is deleted. Your reading is still on this device.");
    } catch (e) {
      setStatus(friendly(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ListGroup label="Lamplighters">
        <li className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider">
          <button type="button" onClick={() => setProfileOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-gold-wash">
            <Avatar id={p.avatar_id} size={40} alt={avatarLabel(p.avatar_id)} />
            <span className="min-w-0 flex-1">
              <span className="block text-headline">{p.display_name ?? "Add your name"}</span>
              <span className="block text-subhead text-text-secondary">Name and avatar your Circles see</span>
            </span>
            <span aria-hidden="true" className="icon-[lucide--chevron-right] size-5 text-text-tertiary" />
          </button>
        </li>
        <ListRow title="What Circles see" value={share.label} chevron onClick={() => setShareOpen(true)} />
        <ListRow
          title="Email me nudges"
          subtitle="Besides the in-app nudge"
          icon="mail"
          selected={p.nudge_email}
          onClick={() => save({ nudge_email: !p.nudge_email }, p.nudge_email ? "Nudge emails are off." : "Nudges will be emailed to you too.")}
        />
        <ListRow
          title="Email me Circle messages"
          subtitle="Besides the in-app notification"
          icon="mail"
          selected={p.message_email}
          onClick={() => save({ message_email: !p.message_email }, p.message_email ? "Message emails are off." : "Circle messages will be emailed to you too.")}
        />
        <ListRow
          title="Show my email to my Circles"
          subtitle={p.show_email ? "Members can see your email" : "Hidden. Members see only your name"}
          icon="user"
          selected={p.show_email}
          onClick={() => save({ show_email: !p.show_email }, p.show_email ? "Your email is hidden." : "Your Circles can see your email.")}
        />
        {muteCount > 0 && <ListRow title="Turn muted people back on" subtitle={`${muteCount} muted`} icon="bell" onClick={unmuteAll} />}
        <ListRow title={<span className="text-danger">Delete account</span>} icon="trash" onClick={() => setDeleteOpen(true)} />
      </ListGroup>
      <p role="status" className="-mt-6 min-h-5 px-1 text-footnote text-text-secondary">
        {status}
      </p>

      <ProfileSheet key={String(profileOpen)} open={profileOpen} onOpenChange={setProfileOpen} userId={uid} profile={p} />

      <Sheet open={shareOpen} onOpenChange={setShareOpen} title="What Circles see" description="Choose what your Circles can see">
        <div role="radiogroup" aria-label="What Circles see" className="flex flex-col gap-2 pb-2">
          {SHARE_LEVELS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={p.share_level === s.value}
              onClick={() => save({ share_level: s.value as ShareLevel }, `Your Circles now see: ${s.label.toLowerCase()}.`).then(() => setShareOpen(false))}
              className={`flex min-h-16 items-center gap-3 rounded-md px-4 py-3 text-left ${p.share_level === s.value ? "bg-gold-wash ring-2 ring-gold" : "bg-surface"}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-headline">{s.label}</span>
                <span className="block text-subhead text-text-secondary">{s.detail}</span>
              </span>
              {p.share_level === s.value && <span aria-hidden="true" className="icon-[lucide--check] size-5 text-gold-text" />}
            </button>
          ))}
          <p className="mt-2 text-footnote text-text-secondary">Never what you read in your notes or highlights. The read-today lamp shows only that you read, not what.</p>
        </div>
      </Sheet>

      <Sheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="Delete your account and everything in it"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={() => setDeleteOpen(false)}>Not now</Button>
            <Button variant="primary" onClick={remove} disabled={deleting} className="bg-danger! text-bg!">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 pb-2 text-body">
          <p>This deletes your account, your saved reading, notes and highlights, and your messages and nudges. You leave every Circle; Circles you own pass to the next member.</p>
          <p className="text-text-secondary">It can&apos;t be undone. A copy of your reading stays on this device.</p>
        </div>
      </Sheet>
    </>
  );
}
