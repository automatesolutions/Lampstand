-- Share a highlight to a Circle. Run after 0010_notification_email_retry.sql.
--
-- A shared highlight is a chat message that carries the highlight, so everything chat
-- already does applies: only members can read it (row-level security from 0005), and the
-- notification triggers from 0006 notify the other members, skipping anyone who muted or
-- blocked the sender, and emailing only people who turned on message emails.
--
-- The share follows the highlight:
-- - Deleting the highlight deletes the share (highlight_id cascades).
-- - Changing its verses removes the share (its words no longer match); changing only its
--   color updates the share.
-- - Leaving a Circle removes the shares you posted there.
-- Only your own highlight can be shared, and the verses and color always come from your
-- highlight row, not from what the browser sent. Tested in lib/lamplighters/shares.db.test.ts.

alter table public.messages
  -- on update cascade: sync can give a highlight row a new id (same first verse); the
  -- trigger below then removes the share, instead of the update failing.
  add column if not exists highlight_id uuid references public.highlights on delete cascade on update cascade,
  -- { ref, text, color, book, chapter, verse_start, verse_end, summary? }: the words are KJV, from the server
  add column if not exists highlight jsonb;

alter table public.messages drop constraint if exists messages_check;
alter table public.messages drop constraint if exists messages_has_content;
alter table public.messages add constraint messages_has_content
  check (deleted_at is not null or body is not null or verse is not null or highlight is not null);
alter table public.messages drop constraint if exists messages_highlight_pair;
alter table public.messages add constraint messages_highlight_pair check ((highlight is null) = (highlight_id is null));

-- One share of a highlight per Circle (sharing again finds the first one).
create unique index if not exists messages_one_share on public.messages (circle_id, highlight_id) where highlight_id is not null;

-- Cleans each new message, as in 0005, and checks a shared highlight.
create or replace function public.lamp_before_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h public.highlights;
begin
  new.created_at := now();
  new.deleted_at := null;
  new.body := public.lamp_clean(new.body, 1000);
  if new.verse is not null then
    if jsonb_typeof(new.verse) <> 'object' or public.lamp_clean(new.verse->>'ref', 40) is null or public.lamp_clean(new.verse->>'text', 800) is null then
      raise exception 'bad_verse' using errcode = 'P0001';
    end if;
    new.verse := jsonb_build_object('ref', public.lamp_clean(new.verse->>'ref', 40), 'text', public.lamp_clean(new.verse->>'text', 800));
  end if;
  if new.highlight_id is not null or new.highlight is not null then
    select * into h from public.highlights where id = new.highlight_id and user_id = new.sender_id;
    if h.id is null or jsonb_typeof(new.highlight) <> 'object'
       or public.lamp_clean(new.highlight->>'ref', 60) is null or public.lamp_clean(new.highlight->>'text', 2000) is null then
      raise exception 'bad_highlight' using errcode = 'P0001';
    end if;
    -- The verses and color come from the highlight itself.
    new.highlight := jsonb_build_object(
      'ref', public.lamp_clean(new.highlight->>'ref', 60),
      'text', public.lamp_clean(new.highlight->>'text', 2000),
      'color', h.color, 'book', h.book, 'chapter', h.chapter, 'verse_start', h.verse_start, 'verse_end', h.verse_end)
      || case when public.lamp_clean(new.highlight->>'summary', 800) is not null
              then jsonb_build_object('summary', public.lamp_clean(new.highlight->>'summary', 800)) else '{}'::jsonb end;
  end if;
  if new.body is null and new.verse is null and new.highlight is null then raise exception 'message_required' using errcode = 'P0001'; end if;
  perform public.lamp_rate(new.sender_id, 'message_minute', 20, interval '1 minute');
  perform public.lamp_rate(new.sender_id, 'message_day', 500, interval '1 day');
  return new;
end $$;

/** Members delete their own messages; owners can delete any. The text is erased, a share too. */
create or replace function public.delete_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.lamp_require_user();
begin
  update public.messages m set deleted_at = now(), body = null, verse = null, highlight = null, highlight_id = null
  where m.id = p_message and m.deleted_at is null and (m.sender_id = uid or public.is_circle_owner(m.circle_id));
  if not found then raise exception 'not_allowed' using errcode = 'P0001'; end if;
end $$;

-- The share follows its highlight: new verses remove it, a new color updates it.
create or replace function public.lamp_after_highlight_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.book, new.chapter, new.verse_start, new.verse_end) is distinct from (old.book, old.chapter, old.verse_start, old.verse_end)
     or new.id is distinct from old.id then
    delete from public.messages where highlight_id in (old.id, new.id);
  elsif new.color is distinct from old.color then
    update public.messages set highlight = jsonb_set(highlight, '{color}', to_jsonb(new.color)) where highlight_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists highlight_after_change on public.highlights;
create trigger highlight_after_change after update on public.highlights
  for each row execute function public.lamp_after_highlight_change();

-- Which Circles get my new highlights automatically. Off (no rows) by default.
create table if not exists public.highlight_auto_share (
  user_id uuid not null references auth.users on delete cascade,
  circle_id uuid not null references public.circles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, circle_id)
);
alter table public.highlight_auto_share enable row level security;
revoke all on public.highlight_auto_share from anon, authenticated;
drop policy if exists "own choices" on public.highlight_auto_share;
create policy "own choices" on public.highlight_auto_share for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_circle_member(circle_id));
grant select, insert, delete on public.highlight_auto_share to authenticated;

-- Leaving a Circle (or being removed) takes your shares and auto-share choice with you.
create or replace function public.lamp_after_member_leaves_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.messages where circle_id = old.circle_id and sender_id = old.user_id and highlight_id is not null;
  delete from public.highlight_auto_share where circle_id = old.circle_id and user_id = old.user_id;
  return null;
end $$;
drop trigger if exists circle_member_left_shares on public.circle_members;
create trigger circle_member_left_shares after delete on public.circle_members
  for each row execute function public.lamp_after_member_leaves_shares();

-- Notifications and emails name the shared verses, like a verse card (otherwise as in 0006 and 0010).
create or replace function public.my_notifications(p_limit integer default 30)
returns table (id uuid, kind text, circle_id uuid, circle_name text, sender_id uuid, sender_name text,
               sender_avatar text, message_id uuid, nudge_id uuid, body text, verse_ref text, note text,
               to_circle boolean, created_at timestamptz, read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.circle_id, c.name, n.sender_id, coalesce(p.display_name, 'Lamplighter'), p.avatar_id,
         n.message_id, n.nudge_id,
         case when n.kind = 'message' then msg.body else nu.message end,
         coalesce(msg.verse->>'ref', msg.highlight->>'ref'),
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
      and case when p_message is not null then
                 n.kind = 'message' and pr.message_email
                 and exists (select 1 from public.messages mm where mm.id = n.message_id and mm.deleted_at is null)
               else n.kind = 'nudge' and n.created_at = batch and pr.nudge_email end
      and not public.lamp_quiet(n.user_id, n.sender_id, n.circle_id)
    returning n.id, n.kind, n.user_id, n.circle_id, n.message_id, n.nudge_id, n.created_at
  )
  select cl.id, cl.kind, u.email::text, cl.circle_id, c.name, coalesce(sp.display_name, 'A Lamplighter'),
         case when cl.kind = 'message' then msg.body else nu.message end,
         coalesce(msg.verse->>'ref', msg.highlight->>'ref'), coalesce(msg.verse->>'text', msg.highlight->>'text'),
         nu.note, cl.nudge_id
  from claimed cl
  join auth.users u on u.id = cl.user_id
  join public.circles c on c.id = cl.circle_id
  left join public.profiles sp on sp.id = p_sender
  left join public.messages msg on msg.id = cl.message_id
  left join public.nudges nu on nu.id = cl.nudge_id
  where u.email is not null
  order by cl.created_at;
end $$;

-- The server posts shares as the signed-in person (their token), so these columns are
-- open to insert; the trigger above checks them.
grant insert (highlight_id, highlight) on public.messages to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.lamp_before_message()', 'public.delete_message(uuid)', 'public.lamp_after_highlight_change()',
    'public.lamp_after_member_leaves_shares()', 'public.my_notifications(integer)', 'public.claim_notification_emails(uuid, uuid, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.delete_message(uuid), public.my_notifications(integer) to authenticated;
grant execute on function public.claim_notification_emails(uuid, uuid, uuid) to service_role;
