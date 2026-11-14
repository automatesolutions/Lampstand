-- Circle message emails that failed to send get another chance. Run after 0009_usage_limits.sql.
--
-- When an email fails, the server clears emailed_at (lib/lamplighters/notify.ts), but before
-- this nothing asked for it again. Now, when someone sends a chat message, the claim also
-- picks up that sender's other unsent message emails in the same Circle from the last hour,
-- so a failed one goes out with the next message. Deleted messages are skipped (their text
-- is gone). Nudges work as before: the latest batch only. Everything else is unchanged from
-- 0006_notifications.sql: claiming sets emailed_at first, so nothing is sent twice.
-- Tested in lib/lamplighters/db.test.ts.

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
                 -- This message, and any earlier one from this sender that wasn't emailed yet.
                 n.kind = 'message' and pr.message_email
                 and exists (select 1 from public.messages mm where mm.id = n.message_id and mm.deleted_at is null)
               else n.kind = 'nudge' and n.created_at = batch and pr.nudge_email end
      and not public.lamp_quiet(n.user_id, n.sender_id, n.circle_id)
    returning n.id, n.kind, n.user_id, n.circle_id, n.message_id, n.nudge_id, n.created_at
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
  where u.email is not null
  order by cl.created_at;
end $$;

revoke execute on function public.claim_notification_emails(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(uuid, uuid, uuid) to service_role;
