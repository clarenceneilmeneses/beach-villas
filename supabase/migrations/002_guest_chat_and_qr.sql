-- 002 — guest chat inside the site, and payment QR codes at checkout.
-- Paste into Supabase → SQL Editor → Run, once, on a database that already has schema.sql.
-- (A fresh project gets this from schema.sql, which includes it.)

-- QR images the guest scans at checkout, uploaded by the owner in Settings → Payments.
alter table public.settings add column if not exists gcash_qr_path text default '';
alter table public.settings add column if not exists bank_qr_path text default '';

insert into storage.buckets (id, name, public) values ('payment-qr', 'payment-qr', true) on conflict do nothing;
create policy "payment-qr: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-qr' and public.is_owner());
create policy "payment-qr: owner replaces" on storage.objects for update to authenticated
  using (bucket_id = 'payment-qr' and public.is_owner());
create policy "payment-qr: owner removes" on storage.objects for delete to authenticated
  using (bucket_id = 'payment-qr' and public.is_owner());

-- A guest's own thread, written from the website and answered from the Inbox.
alter table public.threads drop constraint if exists threads_channel_check;
alter table public.threads add constraint threads_channel_check
  check (channel in ('website', 'messenger', 'whatsapp', 'viber', 'phone'));
alter table public.threads alter column channel set default 'website';

create policy "guest own" on public.threads for select using (
  exists (select 1 from public.guests g where g.id = guest_id and g.user_id = auth.uid()));
create policy "guest own" on public.messages for select using (
  exists (select 1 from public.threads t join public.guests g on g.id = t.guest_id
          where t.id = thread_id and g.user_id = auth.uid()));

-- The guest writes through this, so a message can never be signed as staff.
create or replace function public.guest_send_message(p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); gid uuid; tid uuid;
begin
  if uid is null then raise exception 'Sign in to message us'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'Write a message first'; end if;
  select id into gid from guests where user_id = uid;
  if gid is null then
    insert into guests (name, email, user_id) values (split_part(public.me(), '@', 1), public.me(), uid) returning id into gid;
  end if;
  select id into tid from threads where guest_id = gid;
  if tid is null then
    insert into threads (guest_id, channel, unread, last_message_at) values (gid, 'website', true, now()) returning id into tid;
  end if;
  insert into messages (thread_id, author, body) values (tid, 'guest', trim(p_body));
  update threads set unread = true, last_message_at = now() where id = tid;
  return tid;
end $$;
