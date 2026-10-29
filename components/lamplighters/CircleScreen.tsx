"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ListGroup, ListRow } from "@/components/ui/List";
import { PageTitle } from "@/components/ui/NavBar";
import { Sheet } from "@/components/ui/Sheet";
import { bookByCode } from "@/lib/bible/books";
import {
  circleActivity,
  circlePeople,
  friendly,
  getCircle,
  myBlocks,
  myCircles,
  myInvites,
  myMutes,
  react,
  removeMember,
  renameCircle,
  setBlocked,
  setMute,
  useLampProfile,
  useLampVersion,
  useLoad,
  type Activity,
  type Person,
} from "@/lib/lamplighters/client";
import { LAMPLIGHTERS } from "@/lib/lamplighters/config";
import { Avatar, ReadLamp } from "./Avatar";
import { InviteSheet } from "./InviteSheet";
import { NudgeSheet } from "./NudgeSheet";
import { ProfileSheet } from "./ProfileSheet";
import { EmptyState, ErrorState, LoadingRows, timeAgo } from "./States";

const bookName = (code?: string) => (code && bookByCode(code)?.name) || "a book";

function describe(a: Activity, name: (id: string | null | undefined) => string) {
  const who = name(a.actor_id);
  switch (a.kind) {
    case "chapter":
      return `${who} finished ${bookName(a.data.book)} ${a.data.chapter}`;
    case "joined":
      return `${who} joined the Circle`;
    case "nudge":
      return a.data.to ? `${who} nudged ${name(a.data.to)}` : `${who} nudged the Circle`;
    case "milestone":
      if (a.data.type === "book") return `${who} finished the book of ${bookName(a.data.book)}`;
      if (a.data.type === "streak") return `${who} is on a ${a.data.value}-day streak`;
      return `${who} has read ${a.data.value?.toLocaleString("en-US")} chapters`;
  }
}

/** One Circle: members and their lamps, the week together, recent moments, and actions. */
export function CircleScreen({ id }: { id: string }) {
  const router = useRouter();
  const me = useLampProfile();
  const v = useLampVersion();
  const uid = me.userId;
  const circle = useLoad(uid ? () => getCircle(id) : null, [id, uid, v]);
  const people = useLoad(uid ? () => circlePeople(id) : null, [id, uid, v]);
  const activity = useLoad(uid ? () => circleActivity(id) : null, [id, uid, v]);
  const invites = useLoad(uid ? () => myInvites(id) : null, [id, uid, v]);
  const prefs = useLoad(uid ? () => Promise.all([myMutes(), myBlocks()]) : null, [uid, v]);
  const unread = useLoad(uid ? async () => (await myCircles()).find((c) => c.id === id)?.unread_count ?? 0 : null, [id, uid, v]);

  const [nudging, setNudging] = useState<Person | "all" | null>(null);
  const [member, setMember] = useState<Person | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [status, setStatus] = useState("");

  // Lamps change through the day: refresh when the tab comes back into view.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        people.reload();
        activity.reload();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  });

  const list = useMemo(() => people.data ?? [], [people.data]);
  const byId = useMemo(() => new Map(list.map((p) => [p.user_id, p])), [list]);
  const nameOf = (pid: string | null | undefined) => (pid && byId.get(pid) ? (byId.get(pid)!.is_me ? "You" : byId.get(pid)!.display_name) : "A former member");

  if (!me.ready || (uid && (!circle.data || !people.data) && !circle.error && !people.error)) {
    return (
      <div className="flex flex-col gap-8">
        <PageTitle back={{ href: "/circles", label: "Circles" }}>Circle</PageTitle>
        <LoadingRows rows={4} label="Loading the Circle" />
      </div>
    );
  }
  if (!uid || circle.error || people.error || !circle.data) {
    return (
      <div className="flex flex-col gap-8">
        <PageTitle back={{ href: "/circles", label: "Circles" }}>Circle</PageTitle>
        <ErrorState message={!uid ? "Sign in to see your Circles." : (circle.error ?? people.error ?? "This Circle isn't available.")} onRetry={uid ? () => (circle.reload(), people.reload()) : undefined} />
      </div>
    );
  }

  const c = circle.data;
  const self = list.find((p) => p.is_me);
  const owner = self?.role === "owner";
  const lit = list.filter((p) => p.read_today).length;
  const sharers = list.filter((p) => p.chapters_week != null);
  const weekTotal = sharers.reduce((n, p) => n + (p.chapters_week ?? 0), 0);
  const pending = invites.data ?? [];
  const spotsLeft = c.max_members - list.length - pending.length;
  const [mutes, blocks] = prefs.data ?? [[], []];
  const circleMuted = mutes.some((m) => m.muted_circle_id === id);
  const canNudgeAll = list.some((p) => !p.is_me && !p.read_today);
  const alone = list.length === 1;

  const done = (msg: string) => {
    setStatus(msg);
    people.reload();
    activity.reload();
  };

  return (
    <div className="arrive flex flex-col gap-7">
      <PageTitle back={{ href: "/circles", label: "Circles" }} eyebrow={c.kind === "pair" ? "Lamplighter pair" : `Circle · ${list.length} of ${c.max_members}`}>
        {c.name}
      </PageTitle>
      {c.description && <p className="-mt-4 text-body text-text-secondary">{c.description}</p>}

      {alone ? (
        <EmptyState kind="emptyCircle" seed={id}>
          <Button variant="primary" size="large" icon="user-plus" onClick={() => setInviteOpen(true)}>
            Invite your first Lamplighter
          </Button>
        </EmptyState>
      ) : (
        <section aria-label="This week" className="flex items-center gap-4 rounded-xl bg-surface px-[18px] py-4">
          <div className="flex -space-x-2" aria-hidden="true">
            {list.slice(0, 5).map((p) => (
              <ReadLamp key={p.user_id} lit={p.read_today} className="size-8! ring-2 ring-surface" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-headline">{sharers.length ? `Your Circle read ${weekTotal} ${weekTotal === 1 ? "chapter" : "chapters"} this week` : `${lit} of ${list.length} lamps lit today`}</p>
            <p className="text-footnote text-text-secondary">
              {sharers.length ? `${lit} of ${list.length} lamps lit today · counts ${sharers.length === list.length ? "everyone" : `the ${sharers.length} who share chapters`}` : "Each person chooses what their Circle sees."}
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <ButtonLink href={`/chat/${id}`} icon="message-circle" variant={alone ? "secondary" : "primary"}>
          Chat{unread.data ? ` · ${unread.data}` : ""}
          {unread.data ? <span className="sr-only"> unread</span> : null}
        </ButtonLink>
        <Button icon="bell" onClick={() => setNudging("all")} disabled={!canNudgeAll}>
          Nudge all
        </Button>
      </div>
      <p role="status" className="-mt-4 min-h-5 px-1 text-footnote text-text-secondary">
        {status}
      </p>

      <section aria-labelledby="members-heading" className="-mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 id="members-heading" className="text-eyebrow text-text-secondary">
            Lamplighters
          </h2>
          {!alone && (
            <button type="button" onClick={() => setInviteOpen(true)} className="flex min-h-11 items-center gap-1.5 px-1 text-subhead font-medium text-gold-text">
              <Icon name="user-plus" className="size-[18px]" /> Invite
            </button>
          )}
        </div>
        <ul className="overflow-hidden rounded-lg bg-surface-raised shadow-soft ring-1 ring-divider/60">
          {list.map((p) => (
            <li key={p.user_id} className="relative after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-divider last:after:hidden">
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <Avatar id={p.avatar_id} size={44} lit={p.read_today} />
                <button type="button" onClick={() => (p.is_me ? setProfileOpen(true) : setMember(p))} className="min-w-0 flex-1 py-1 text-left">
                  <span className="block truncate text-headline">
                    {p.is_me ? `${p.display_name} (you)` : p.display_name}
                    {p.role === "owner" && <span className="ml-2 rounded-full bg-gold-wash px-2 py-0.5 align-middle text-footnote font-semibold text-gold-text">Owner</span>}
                  </span>
                  <span className="block text-footnote text-text-secondary">
                    {p.read_today ? "Read today" : "Not yet today"}
                    {p.streak ? ` · ${p.streak}-day streak` : ""}
                    {p.chapters_week ? ` · ${p.chapters_week} this week` : ""}
                    {p.email ? ` · ${p.email}` : ""}
                  </span>
                </button>
                {!p.is_me && !p.read_today && (
                  <button type="button" onClick={() => setNudging(p)} aria-label={`Nudge ${p.display_name}`} className="grid size-11 place-items-center rounded-full bg-surface text-gold-text">
                    <Icon name="bell" className="size-5" />
                  </button>
                )}
                {!p.is_me && (
                  <button type="button" onClick={() => setMember(p)} aria-label={`More for ${p.display_name}`} className="-mr-2 grid size-11 place-items-center rounded-full text-text-secondary">
                    <Icon name="ellipsis" className="size-5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
        <h2 id="recent-heading" className="px-1 text-eyebrow text-text-secondary">
          Recently
        </h2>
        {activity.error && !activity.data ? (
          <ErrorState message={activity.error} onRetry={activity.reload} />
        ) : !activity.data ? (
          <LoadingRows rows={2} />
        ) : activity.data.length === 0 ? (
          <p className="rounded-lg bg-surface px-4 py-3.5 text-subhead text-text-secondary">Finished chapters, streaks and nudges show up here, as each person chooses to share them.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activity.data.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-lg bg-surface px-4 py-3">
                <Avatar id={byId.get(a.actor_id ?? "")?.avatar_id} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-subhead">
                    {describe(a, nameOf)}
                    {a.kind === "milestone" ? " 🎉" : ""}
                  </p>
                  <p className="text-footnote text-text-secondary">
                    <time dateTime={a.created_at}>{timeAgo(a.created_at)}</time>
                  </p>
                </div>
                {a.kind !== "nudge" && (
                  <div className="flex gap-1">
                    {LAMPLIGHTERS.reactions.map((emoji) => {
                      const count = a.reactions.filter((r) => r.emoji === emoji).length;
                      const mine = a.reactions.some((r) => r.emoji === emoji && r.user_id === uid);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          aria-pressed={mine}
                          aria-label={`${emoji === "🙏" ? "Praying" : "Fire"}${count ? `, ${count}` : ""}`}
                          onClick={() => react(a.id, uid, emoji, !mine).then(activity.reload, (e) => setStatus(friendly(e)))}
                          className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-subhead ${mine ? "bg-gold-wash ring-1 ring-gold" : "bg-surface-raised ring-1 ring-divider"}`}
                        >
                          <span aria-hidden="true">{emoji}</span>
                          {count > 0 && <span aria-hidden="true" className="tabular-nums">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ListGroup label="This Circle">
        {!alone && <ListRow title="Invite a Lamplighter" icon="user-plus" value={pending.length ? `${pending.length} waiting` : undefined} chevron onClick={() => setInviteOpen(true)} />}
        <ListRow
          title={circleMuted ? "Nudges from this Circle are muted" : "Mute nudges from this Circle"}
          icon="bell-off"
          selected={circleMuted}
          onClick={() => setMute(uid, { circle: id }, !circleMuted).then(prefs.reload, (e) => setStatus(friendly(e)))}
        />
        {owner && <ListRow title="Rename" icon="pencil" chevron onClick={() => setRenameOpen(true)} />}
        <ListRow title={<span className="text-danger">Leave {c.kind === "pair" ? "this pair" : "the Circle"}</span>} icon="log-out" onClick={() => setLeaveOpen(true)} />
      </ListGroup>

      {nudging && (
        <NudgeSheet
          circleId={id}
          circleName={c.name}
          to={nudging === "all" ? null : { id: nudging.user_id, name: nudging.display_name, avatar: nudging.avatar_id }}
          myAvatar={self?.avatar_id ?? null}
          onClose={() => setNudging(null)}
          onSent={done}
        />
      )}

      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} circleId={id} circleName={c.name} invites={pending} spotsLeft={spotsLeft} onChange={invites.reload} />

      <Sheet open={!!member} onOpenChange={(o) => !o && setMember(null)} title={member?.display_name ?? ""} description="Options for this Lamplighter">
        {member && (
          <MemberOptions
            person={member}
            ownerView={owner}
            muted={mutes.some((m) => m.muted_user_id === member.user_id)}
            blocked={blocks.includes(member.user_id)}
            onNudge={() => (setMember(null), setNudging(member))}
            onMute={(on) => setMute(uid, { user: member.user_id }, on).then(() => (prefs.reload(), setMember(null), setStatus(on ? `Nudges from ${member.display_name} are muted.` : `Nudges from ${member.display_name} are back on.`)), (e) => setStatus(friendly(e)))}
            onBlock={(on) => setBlocked(uid, member.user_id, on).then(() => (prefs.reload(), setMember(null), setStatus(on ? `Blocked ${member.display_name}. You won't see their messages or nudges.` : `Unblocked ${member.display_name}.`)), (e) => setStatus(friendly(e)))}
            onRemove={() => removeMember(id, member.user_id).then(() => (setMember(null), done(`${member.display_name} was removed.`)), (e) => setStatus(friendly(e)))}
          />
        )}
      </Sheet>

      <Sheet
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={`Leave ${c.name}?`}
        description="Leave this Circle"
        footer={
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={() => setLeaveOpen(false)}>Not now</Button>
            <Button
              variant="primary"
              onClick={() =>
                removeMember(id, uid).then(
                  () => router.replace("/circles"),
                  (e) => (setLeaveOpen(false), setStatus(friendly(e))),
                )
              }
            >
              Leave
            </Button>
          </div>
        }
      >
        <p className="pb-2 text-body text-text-secondary">
          You&apos;ll stop seeing its members, chat and nudges. {owner && list.length > 1 ? `${list.filter((p) => !p.is_me)[0].display_name} becomes the owner.` : ""}
          {list.length === 1 ? "You're the only one here, so the Circle will be deleted." : " Your messages stay unless you delete them first."}
        </p>
      </Sheet>

      {renameOpen && <RenameSheet circleId={id} name={c.name} description={c.description ?? ""} onClose={() => setRenameOpen(false)} />}

      {me.data && <ProfileSheet key={String(profileOpen)} open={profileOpen} onOpenChange={setProfileOpen} userId={uid} profile={me.data} />}
    </div>
  );
}

function MemberOptions({
  person,
  ownerView,
  muted,
  blocked,
  onNudge,
  onMute,
  onBlock,
  onRemove,
}: {
  person: Person;
  ownerView: boolean;
  muted: boolean;
  blocked: boolean;
  onNudge: () => void;
  onMute: (on: boolean) => void;
  onBlock: (on: boolean) => void;
  onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center gap-3">
        <Avatar id={person.avatar_id} size={56} lit={person.read_today} />
        <p className="text-body text-text-secondary">
          {person.read_today ? "Has read today." : "Hasn't read yet today."}
          {person.streak ? ` On a ${person.streak}-day streak.` : ""}
        </p>
      </div>
      <ul className="overflow-hidden rounded-lg bg-surface">
        {!person.read_today && <ListRow title={`Nudge ${person.display_name}`} icon="bell" onClick={onNudge} />}
        <ListRow title={muted ? "Turn their nudges back on" : "Mute their nudges"} icon="bell-off" onClick={() => onMute(!muted)} />
        <ListRow title={blocked ? "Unblock" : "Block"} subtitle={blocked ? undefined : "Hides their messages and nudges from you. They aren't told."} icon="ban" onClick={() => onBlock(!blocked)} />
        {ownerView &&
          (confirm ? (
            <ListRow title={<span className="text-danger">Tap again to remove {person.display_name}</span>} icon="user-minus" onClick={onRemove} />
          ) : (
            <ListRow title={<span className="text-danger">Remove from the Circle</span>} icon="user-minus" onClick={() => setConfirm(true)} />
          ))}
      </ul>
    </div>
  );
}

function RenameSheet({ circleId, name, description, onClose }: { circleId: string; name: string; description: string; onClose: () => void }) {
  const [n, setN] = useState(name);
  const [d, setD] = useState(description);
  const [error, setError] = useState("");
  const input = "min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider focus:ring-2 focus:ring-gold";
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Rename"
      footer={
        <Button
          variant="primary"
          size="large"
          onClick={() => (n.trim() ? renameCircle(circleId, n, d).then(onClose, (e) => setError(friendly(e))) : setError("Give it a name."))}
        >
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">Name</span>
          <input value={n} onChange={(e) => setN(e.target.value)} maxLength={LAMPLIGHTERS.circleNameMax} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption text-text-secondary">About it</span>
          <textarea value={d} onChange={(e) => setD(e.target.value)} maxLength={LAMPLIGHTERS.circleDescriptionMax} rows={2} className={`${input} resize-none py-3`} />
        </label>
        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
