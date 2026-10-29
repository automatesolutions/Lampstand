"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { parseRef, versesIn } from "@/lib/bible/parse";
import {
  circlePeople,
  deleteMessage,
  friendly,
  getCircle,
  getMessage,
  markChatRead,
  messagesBefore,
  reportMessage,
  sendMessage,
  setBlocked,
  useLampProfile,
  useLoad,
  type Message,
} from "@/lib/lamplighters/client";
import { LAMPLIGHTERS } from "@/lib/lamplighters/config";
import { supabase } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";
import { ErrorState, LoadingRows } from "./States";

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/** Newest last, one copy of each message. */
function mergeMessages(a: Message[], b: Message[]) {
  const map = new Map(a.map((m) => [m.id, m]));
  for (const m of b) map.set(m.id, m);
  return [...map.values()].sort((x, y) => x.created_at.localeCompare(y.created_at));
}

/** A Circle's private chat: live messages, history, typing, verse cards. */
export function ChatScreen({ id }: { id: string }) {
  const me = useLampProfile();
  const uid = me.userId;
  const circle = useLoad(uid ? () => getCircle(id) : null, [id, uid]);
  const people = useLoad(uid ? () => circlePeople(id) : null, [id, uid]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Message | null>(null);
  const [verseOpen, setVerseOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scroller = useRef<HTMLDivElement>(null);
  const keepBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const typingChannel = useRef<ReturnType<NonNullable<ReturnType<typeof supabase>>["channel"]> | null>(null);
  const lastTypingSent = useRef(0);

  const byId = useMemo(() => new Map((people.data ?? []).map((p) => [p.user_id, p])), [people.data]);
  const owner = (people.data ?? []).some((p) => p.is_me && p.role === "owner");

  // First page.
  const loadFirst = useCallback(() => {
    if (!uid) return;
    messagesBefore(id, null, LAMPLIGHTERS.chatPageSize).then(
      (page) => {
        setMessages((m) => mergeMessages(m, page));
        setHasMore(page.length === LAMPLIGHTERS.chatPageSize);
        setLoaded("ready");
      },
      () => setLoaded("error"),
    );
  }, [id, uid]);
  useEffect(loadFirst, [loadFirst]);

  // Live: new and deleted messages (row-level security filters them), and typing on the
  // members-only "circle:<id>" channel. Falls back to checking every 15 seconds.
  useEffect(() => {
    const db = supabase();
    if (!db || !uid) return;
    let live = false;
    const changes = db
      .channel(`messages:${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `circle_id=eq.${id}` }, (payload) => {
        const row = payload.new as Message;
        if (row?.id) getMessage(row.id).then((m) => m && setMessages((list) => mergeMessages(list, [m])));
      })
      .subscribe((status) => (live = status === "SUBSCRIBED"));
    const poll = setInterval(() => {
      if (!live && document.visibilityState === "visible") messagesBefore(id, null, LAMPLIGHTERS.chatPageSize).then((page) => setMessages((m) => mergeMessages(m, page)), () => {});
    }, 15_000);

    let typingCh: typeof typingChannel.current = null;
    db.realtime.setAuth().then(() => {
      typingCh = db
        .channel(`circle:${id}`, { config: { private: true, broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const who = (payload as { user?: string })?.user;
          if (who && who !== uid) setTyping((t) => ({ ...t, [who]: Date.now() }));
        })
        .subscribe();
      typingChannel.current = typingCh;
    }, () => {});

    return () => {
      clearInterval(poll);
      db.removeChannel(changes);
      if (typingCh) db.removeChannel(typingCh);
      typingChannel.current = null;
    };
  }, [id, uid]);

  // Typing names fade after four seconds.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const typingNames = Object.entries(typing)
    .filter(([, at]) => now - at < 4000)
    .map(([who]) => byId.get(who)?.display_name ?? "Someone");

  // Seen: everything up to now, whenever messages arrive while the chat is open.
  useEffect(() => {
    if (uid && loaded === "ready" && document.visibilityState === "visible") markChatRead(id, uid).catch(() => {});
  }, [id, uid, loaded, messages.length]);

  // Stay at the bottom for new messages; keep the place when older ones load above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restoreFrom.current != null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (keepBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  async function loadEarlier() {
    const el = scroller.current;
    if (!messages.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await messagesBefore(id, messages[0].created_at, LAMPLIGHTERS.chatPageSize);
      restoreFrom.current = el ? el.scrollHeight - el.scrollTop : null;
      setMessages((m) => mergeMessages(m, page));
      setHasMore(page.length === LAMPLIGHTERS.chatPageSize);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function send(body: string, verse: Message["verse"] = null) {
    if (!uid || (!body.trim() && !verse)) return;
    setSending(true);
    setError("");
    try {
      const m = await sendMessage(id, uid, body.trim(), verse);
      keepBottom.current = true;
      setMessages((list) => mergeMessages(list, [m]));
      setDraft("");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setSending(false);
    }
  }

  function onType(value: string) {
    setDraft(value);
    if (Date.now() - lastTypingSent.current > 2000 && value.trim()) {
      lastTypingSent.current = Date.now();
      typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { user: uid } }).catch(() => {});
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends on keyboards with a pointer; phones keep Enter for new lines.
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      e.preventDefault();
      send(draft);
    }
  }

  const title = circle.data?.name ?? "Chat";

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="glass z-10 flex shrink-0 items-center gap-2 border-b border-divider px-2 pt-[env(safe-area-inset-top)]">
        <Link href={`/circles/${id}`} className="flex min-h-11 items-center gap-0.5 rounded-md pr-2 text-body text-gold-text">
          <Icon name="chevron-left" className="size-6" />
          <span className="sr-only">Back to </span>Circle
        </Link>
        <div className="min-w-0 flex-1 py-1.5 text-center">
          <h1 className="truncate text-headline">{title}</h1>
          <p aria-live="polite" className="h-[18px] truncate text-footnote text-text-secondary">
            {typingNames.length ? (
              <>
                {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing
                <span aria-hidden="true">
                  <span className="typing-dot">.</span>
                  <span className="typing-dot [animation-delay:.2s]">.</span>
                  <span className="typing-dot [animation-delay:.4s]">.</span>
                </span>
              </>
            ) : people.data ? (
              `${people.data.length} ${people.data.length === 1 ? "member" : "members"}`
            ) : (
              ""
            )}
          </p>
        </div>
        <span aria-hidden="true" className="flex w-[76px] justify-end -space-x-2 pr-1">
          {(people.data ?? []).slice(0, 3).map((p) => (
            <Avatar key={p.user_id} id={p.avatar_id} size={28} className="rounded-full ring-2 ring-bg" />
          ))}
        </span>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          keepBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div role="log" aria-label={`Messages in ${title}`} className="mx-auto flex w-full max-w-[680px] flex-col gap-1 px-gutter py-4">
          {loaded === "loading" && !messages.length ? (
            <LoadingRows rows={3} label="Loading messages" />
          ) : loaded === "error" && !messages.length ? (
            <ErrorState message={circle.error ?? "Couldn't load the messages."} onRetry={() => (setLoaded("loading"), loadFirst())} />
          ) : (
            <>
              {hasMore && messages.length > 0 && (
                <Button variant="plain" className="self-center" onClick={loadEarlier} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load earlier messages"}
                </Button>
              )}
              {messages.length === 0 && (
                <p className="my-10 text-center text-body text-text-secondary">No messages yet. Say hi, or share a verse that stuck with you.</p>
              )}
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const mine = m.sender_id === uid;
                const person = byId.get(m.sender_id);
                const newDay = !prev || dayOf(prev.created_at) !== dayOf(m.created_at);
                const grouped = !newDay && prev?.sender_id === m.sender_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
                return (
                  <div key={m.id} className="flex flex-col">
                    {newDay && <p className="my-3 self-center rounded-full bg-surface px-3 py-1 text-footnote text-text-secondary">{dayOf(m.created_at)}</p>}
                    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${grouped ? "" : "mt-2"}`}>
                      {!mine && (grouped ? <span className="w-8 shrink-0" /> : <Avatar id={person?.avatar_id} size={32} />)}
                      <button
                        type="button"
                        onClick={() => !m.deleted_at && setSelected(m)}
                        aria-label={`${mine ? "You" : (person?.display_name ?? "Former member")}, ${timeOf(m.created_at)}: ${m.deleted_at ? "message deleted" : (m.verse ? `${m.verse.ref}. ${m.verse.text}. ` : "") + (m.body ?? "")}. Options`}
                        className={`flex max-w-[78%] flex-col gap-1 rounded-lg px-3.5 py-2.5 text-left ${mine ? "rounded-br-[6px] bg-gold-wash" : "rounded-bl-[6px] bg-surface-raised shadow-soft ring-1 ring-divider/60"}`}
                      >
                        {!mine && !grouped && <span className="text-footnote font-semibold text-gold-text">{person?.display_name ?? "Former member"}</span>}
                        {m.deleted_at ? (
                          <span className="text-subhead italic text-text-secondary">Message deleted</span>
                        ) : (
                          <>
                            {m.verse && (
                              <span className="flex flex-col gap-1 rounded-md border-l-2 border-gold bg-bg/70 px-3 py-2">
                                <span className="font-scripture text-subhead leading-relaxed">{m.verse.text}</span>
                                <span className="text-footnote font-semibold text-gold-text">{m.verse.ref} KJV</span>
                              </span>
                            )}
                            {m.body && <span className="whitespace-pre-wrap break-words text-body">{m.body}</span>}
                          </>
                        )}
                        <span className={`text-[0.75rem] text-text-secondary ${mine ? "self-end" : ""}`}>{timeOf(m.created_at)}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          send(draft);
        }}
        className="glass shrink-0 border-t border-divider px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2"
      >
        {error && (
          <p role="alert" className="mx-auto mb-1.5 max-w-[680px] px-2 text-callout text-danger">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-[680px] items-end gap-1.5">
          <IconButton icon="quote" label="Share a verse" onClick={() => setVerseOpen(true)} />
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKey}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            maxLength={LAMPLIGHTERS.messageMax}
            placeholder="Message"
            className="min-h-11 flex-1 resize-none rounded-[22px] bg-surface px-4 py-[11px] text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={sending || !draft.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-strong text-on-gold disabled:opacity-40"
          >
            <Icon name="send" className="size-5" />
          </button>
        </div>
      </form>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title="Message" description="Options for this message">
        {selected && (
          <MessageOptions
            message={selected}
            mine={selected.sender_id === uid}
            canDelete={selected.sender_id === uid || owner}
            senderName={byId.get(selected.sender_id)?.display_name ?? "Former member"}
            onDone={(msg, remove) => {
              setSelected(null);
              if (remove) setMessages((list) => list.filter((m) => m.sender_id !== remove));
              if (msg) setError(msg);
            }}
            onDeleted={(m) => setMessages((list) => list.map((x) => (x.id === m ? { ...x, deleted_at: new Date().toISOString(), body: null, verse: null } : x)))}
            userId={uid ?? ""}
          />
        )}
      </Sheet>

      {verseOpen && <VerseSheet onClose={() => setVerseOpen(false)} onShare={(verse, note) => send(note, verse).then(() => setVerseOpen(false))} />}
    </div>
  );
}

function MessageOptions({
  message,
  mine,
  canDelete,
  senderName,
  userId,
  onDone,
  onDeleted,
}: {
  message: Message;
  mine: boolean;
  canDelete: boolean;
  senderName: string;
  userId: string;
  onDone: (status?: string, removeSender?: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const text = [message.verse ? `${message.verse.text} (${message.verse.ref} KJV)` : "", message.body ?? ""].filter(Boolean).join("\n");

  const act = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    try {
      await fn();
      after();
    } catch (e) {
      onDone(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  if (reporting) {
    return (
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-body text-text-secondary">Tell us what&apos;s wrong. {senderName} won&apos;t be told who reported it.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="It's hurtful because…"
          className="resize-none rounded-md bg-surface px-4 py-3 text-body outline-none ring-1 ring-divider focus:ring-2 focus:ring-gold"
        />
        <Button variant="primary" size="large" icon="flag" disabled={busy} onClick={() => act(() => reportMessage(message.id, reason.trim()), () => onDone("Thanks. We'll look at it."))}>
          Send report
        </Button>
        <Button
          icon="ban"
          disabled={busy}
          onClick={() => act(() => reportMessage(message.id, reason.trim()).then(() => setBlocked(userId, message.sender_id, true)), () => onDone(`Reported, and you blocked ${senderName}.`, message.sender_id))}
        >
          Report and block {senderName}
        </Button>
      </div>
    );
  }

  return (
    <ul className="mb-2 overflow-hidden rounded-lg bg-surface">
      <li>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text).then(() => onDone(), () => onDone("Copy isn't available in this browser."))}
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-headline"
        >
          <Icon name="copy" className="size-5 text-gold" /> Copy
        </button>
      </li>
      {canDelete && (
        <li className="border-t border-divider">
          <button type="button" disabled={busy} onClick={() => act(() => deleteMessage(message.id), () => (onDeleted(message.id), onDone()))} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-headline text-danger">
            <Icon name="trash" className="size-5" /> {mine ? "Delete for everyone" : "Delete (as owner)"}
          </button>
        </li>
      )}
      {!mine && (
        <>
          <li className="border-t border-divider">
            <button type="button" onClick={() => setReporting(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-headline">
              <Icon name="flag" className="size-5 text-gold" /> Report
            </button>
          </li>
          <li className="border-t border-divider">
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => setBlocked(userId, message.sender_id, true), () => onDone(`You blocked ${senderName}. Unblock from the Circle's member list.`, message.sender_id))}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-headline"
            >
              <Icon name="ban" className="size-5 text-gold" /> Block {senderName}
            </button>
          </li>
        </>
      )}
    </ul>
  );
}

/** Pick a verse by typing its reference ("jn 3:16"); shares the KJV text. */
function VerseSheet({ onClose, onShare }: { onClose: () => void; onShare: (verse: { ref: string; text: string }, note: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [verse, setVerse] = useState<{ ref: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function find(e: FormEvent) {
    e.preventDefault();
    const m = parseRef(query)[0];
    if (!m || !m.chapter || !m.verse || m.verse > versesIn(m.book.code, m.chapter)) return setError("Type a verse like John 3:16 or ps 23:1.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/verse/${m.book.code}/${m.chapter}/${m.verse}`);
      if (!res.ok) throw new Error();
      setVerse(await res.json());
    } catch {
      setError("Couldn't find that verse. Check the reference.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title="Share a verse"
      description="Share a Bible verse card in the chat"
      footer={
        verse ? (
          <Button variant="primary" size="large" icon="send" disabled={busy} onClick={() => (setBusy(true), onShare(verse, note.trim()).finally(() => setBusy(false)))}>
            Share {verse.ref}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <form onSubmit={find} className="flex gap-2">
          <label className="sr-only" htmlFor="verse-ref">
            Verse
          </label>
          <input
            id="verse-ref"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="John 3:16"
            autoComplete="off"
            className="min-h-[52px] flex-1 rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
          />
          <Button type="submit" disabled={busy}>
            Find
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-callout text-danger">
            {error}
          </p>
        )}
        {verse && (
          <>
            <blockquote className="flex flex-col gap-1.5 rounded-md border-l-2 border-gold bg-surface px-4 py-3">
              <p className="font-scripture text-body leading-relaxed">{verse.text}</p>
              <footer className="text-footnote font-semibold text-gold-text">{verse.ref} KJV</footer>
            </blockquote>
            <label className="flex flex-col gap-1.5">
              <span className="text-caption text-text-secondary">Add a message (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={LAMPLIGHTERS.messageMax}
                placeholder="This one got me today"
                className="min-h-[52px] rounded-md bg-surface px-4 text-body outline-none ring-1 ring-divider placeholder:text-text-tertiary focus:ring-2 focus:ring-gold"
              />
            </label>
          </>
        )}
      </div>
    </Sheet>
  );
}
