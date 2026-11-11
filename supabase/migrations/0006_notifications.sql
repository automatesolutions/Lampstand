-- Circle notifications: a durable in-app item for each chat message and nudge, for
-- each person it reached, plus the "sent by email" marker. Run after 0005_lamplighters.sql.
--
-- The database writes every notification itself (triggers below), so no client can
-- create, skip or fake one. Mutes and blocks apply: a person who muted the sender or the
-- Circle, or blocked the sender, gets no notification and so no email. Emails are sent
-- by the server (app/api/lamplighters), which claims rows with claim_notification_emails
-- so a retried request never sends twice. Tested in lib/lamplighters/db.test.ts.

-- Email switch for chat, off until the person turns it on (like nudge_email).
alter table public.profiles
  add column if not exists message_email boolean not null default false;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade, -- who it's for
  kind text not null check (kind in ('message', 'nudge')),
  circle_id uuid not null references public.circles on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  message_id uuid references public.messages on delete cascade,
  nudge_id uuid references public.nudges on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz, -- set when the server claims it for email; one email per row
  check ((kind = 'message') = (message_id is not null) and (kind = 'nudge') = (nudge_id is not null)),
  check (user_id <> sender_id)
);
create unique index if not exists notifications_one_per_message on public.notifications (user_id, message_id) where message_id is not null;
create unique index if not exists notifications_one_per_nudge on public.notifications (nudge_id) where nudge_id is not null;
create index if not exists notifications_by_user on public.notifications (user_id, created_at desc);
create index if not exists notifications_to_email on public.notifications (sender_id, created_at desc) where emailed_at is null;

/** True when p_user muted p_sender or the Circle, or blocked p_sender. */
create or replace function public.lamp_quiet(p_user uuid, p_sender uuid, p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nudge_mutes mu where mu.user_id = p_user
                   and (mu.muted_user_id = p_sender or mu.muted_circle_id = p_circle))
      or exists (select 1 from public.blocks b where b.blocker_id = p_user and b.blocked_id = p_sender)
$$;

-- A nudge that was delivered (not skipped) notifies its recipient. send_nudge already
-- skips muted and blocking people, for one person and for the whole Circle alike.
create or replace function public.lamp_after_nudge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not new.skipped then
    insert into public.notifications (user_id, kind, circle_id, sender_id, nudge_id, created_at)
    values (new.recipient_id, 'nudge', new.circle_id, new.sender_id, new.id, new.created_at)
    on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists nudge_after_insert on public.nudges;
create trigger nudge_after_insert after insert on public.nudges
  for each row execute function public.lamp_after_nudge();

-- A chat message notifies every other member, except anyone who muted or blocked the sender.
create or replace function public.lamp_after_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, circle_id, sender_id, message_id, created_at)
  select m.user_id, 'message', new.circle_id, new.sender_id, new.id, new.created_at
  from public.circle_members m
  where m.circle_id = new.circle_id and m.user_id <> new.sender_id
    and not public.lamp_quiet(m.user_id, new.sender_id, new.circle_id)
  on conflict do nothing;
  return null;
end $$;
drop trigger if exists message_after_insert on public.messages;
create trigger message_after_insert after insert on public.messages
  for each row execute function public.lamp_after_message();

-- Reading the nudge, or opening the chat, marks the matching notifications read.
create or replace function public.lamp_after_nudge_read() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.read_at is not null and old.read_at is null then
    update public.notifications set read_at = new.read_at where nudge_id = new.id and read_at is null;
  end if;
  return null;
end $$;
drop trigger if exists nudge_after_read on public.nudges;
create trigger nudge_after_read after update of read_at on public.nudges
  for each row execute function public.lamp_after_nudge_read();

create or replace function public.lamp_after_chat_read() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set read_at = now()
  where user_id = new.user_id and circle_id = new.circle_id and kind = 'message'
    and read_at is null and created_at <= now(); -- the database's clock, not the device's
  return null;
end $$;
drop trigger if exists chat_after_read on public.circle_members;
create trigger chat_after_read after update of last_read_message_at on public.circle_members
  for each row execute function public.lamp_after_chat_read();

-- Opening a nudge notification marks the nudge read too, so the inbox and the badge agree.
create or replace function public.lamp_after_notification_read() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.read_at is not null and old.read_at is null and new.nudge_id is not null then
    update public.nudges set read_at = new.read_at where id = new.nudge_id and read_at is null;
  end if;
  return null;
end $$;
drop trigger if exists notification_after_read on public.notifications;
create trigger notification_after_read after update of read_at on public.notifications
  for each row execute function public.lamp_after_notification_read();

/**
 * My notifications, newest first, with what the list shows. Hidden: Circles I left,
 * deleted messages, and anyone I've since blocked.
 */
create or replace function public.my_notifications(p_limit integer default 30)
returns table (id uuid, kind text, circle_id uuid, circle_name text, sender_id uuid, sender_name text,
               sender_avatar text, message_id uuid, nudge_id uuid, body text, verse_ref text, note text,
               to_circle boolean, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.circle_id, c.name, n.sender_id, coalesce(p.display_name, 'Lamplighter'), p.avatar_id,
         n.message_id, n.nudge_id,
         case when n.kind = 'message' then msg.body else nu.message end,
         msg.verse->>'ref',
         nu.note,
         coalesce(nu.to_circle, false),
         n.created_at, n.read_at
  from public.notifications n
  join public.circles c on c.id = n.circle_id
  join public.circle_members me on me.circle_id = n.circle_id and me.user_id = n.user_id
  left join public.profiles p on p.id = n.sender_id
  left join public.messages msg on msg.id = n.message_id
  left join public.nudges nu on nu.id = n.nudge_id
  where n.user_id = (select auth.uid())
    and (n.kind <> 'message' or msg.deleted_at is null)
    and not exists (select 1 from public.blocks b where b.blocker_id = n.user_id and b.blocked_id = n.sender_id)
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

/**
 * Server only. Claims the notifications this sender just caused that should be emailed
 * (the recipient turned on nudge_email or message_email) and returns what the email
 * needs. Claiming sets emailed_at first, so a retried or doubled request finds nothing
 * left to send. For a message, pass its id; for nudges, the latest batch in the Circle
 * (one send_nudge call) is used. If sending fails, the server clears emailed_at again.
 */
create or replace function public.claim_notification_emails(p_sender uuid, p_circle uuid, p_message uuid default null)
returns table (id uuid, kind text, email text, circle_id uuid, circle_name text, sender_name text,
               body text, verse_ref text, verse_text text, note text, nudge_id uuid)
language plpgsql security definer set search_path = '' as $$
declare batch timestamptz;
begin
  if p_message is null then
    select max(n.created_at) into batch from public.notifications n
    where n.sender_id = p_sender and n.circle_id = p_circle and n.kind = 'nudge';
  end if;
  return query
  with claimed as (
    update public.notifications n set emailed_at = now()
    from public.profiles pr
    where pr.id = n.user_id
      and n.sender_id = p_sender and n.circle_id = p_circle and n.emailed_at is null
      and n.created_at > now() - interval '1 hour'
      and case when p_message is not null then n.kind = 'message' and n.message_id = p_message and pr.message_email
               else n.kind = 'nudge' and n.created_at = batch and pr.nudge_email end
      and not public.lamp_quiet(n.user_id, n.sender_id, n.circle_id)
    returning n.id, n.kind, n.user_id, n.circle_id, n.message_id, n.nudge_id
  )
  select cl.id, cl.kind, u.email::text, cl.circle_id, c.name, coalesce(sp.display_name, 'A Lamplighter'),
         case when cl.kind = 'message' then msg.body else nu.message end,
         msg.verse->>'ref', msg.verse->>'text', nu.note, cl.nudge_id
  from claimed cl
  join auth.users u on u.id = cl.user_id
  join public.circles c on c.id = cl.circle_id
  left join public.profiles sp on sp.id = p_sender
  left join public.messages msg on msg.id = cl.message_id
  left join public.nudges nu on nu.id = cl.nudge_id
  where u.email is not null;
end $$;

-- Row-level security: each person reads and marks read only their own notifications.
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mark read" on public.notifications;
create policy "mark read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Chat now goes through the server, which passes the message id the app chose, so a
-- retried send finds the first copy instead of posting twice.
grant insert (id) on public.messages to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.lamp_quiet(uuid, uuid, uuid)', 'public.lamp_after_nudge()', 'public.lamp_after_message()',
    'public.lamp_after_nudge_read()', 'public.lamp_after_chat_read()', 'public.lamp_after_notification_read()',
    'public.my_notifications(integer)', 'public.claim_notification_emails(uuid, uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.my_notifications(integer) to authenticated;
grant execute on function public.claim_notification_emails(uuid, uuid, uuid) to service_role;
