-- Beach Villas — the whole database in one file.
-- Paste into Supabase → SQL Editor → Run. Safe to run once on an empty project.
-- The sample data at the bottom (section 9) is for the preview; delete it before go-live.

create extension if not exists btree_gist;

-- ─── 1. Settings & cottages ─────────────────────────────────────────────────

create table public.settings (
  id int primary key default 1 check (id = 1),
  resort_name text not null default 'Beach Villas',
  tagline text default 'Simple cottages by the beach',
  address text default '',
  -- Slot times, Asia/Manila. A night or 22-hour slot ends the next morning.
  day_start time not null default '08:00',
  day_end time not null default '17:00',
  night_start time not null default '18:00',
  night_end time not null default '07:00',
  h22_start time not null default '14:00',
  h22_end time not null default '12:00',
  hold_hours int not null default 3,
  entrance_adult numeric(10,2) not null default 0,
  entrance_child numeric(10,2) not null default 0,
  gcash_name text default '',
  gcash_number text default '',
  bank_name text default '',
  bank_account_name text default '',
  bank_account_number text default '',
  messenger_url text default '',
  whatsapp_number text default '',
  viber_number text default '',
  facebook_url text default ''
);

create table public.cottage_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  photo_url text default '',
  pax_included int not null default 4,
  max_pax int not null default 6,
  rate_day numeric(10,2) not null,
  rate_night numeric(10,2) not null,
  rate_h22 numeric(10,2) not null,
  weekend_surcharge numeric(10,2) not null default 0,  -- added on Fri and Sat
  extra_head_fee numeric(10,2) not null default 0,
  downpayment numeric(10,2) not null default 0,
  sort int not null default 0,
  active boolean not null default true
);

create table public.cottages (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.cottage_types(id),
  name text not null,
  sort int not null default 0,
  active boolean not null default true
);

-- Holidays and peak days: a surcharge on top of the normal rate.
create table public.rate_overrides (
  id uuid primary key default gen_random_uuid(),
  on_date date not null,
  type_id uuid references public.cottage_types(id),  -- null = every type
  surcharge numeric(10,2) not null,
  label text default ''
);

-- ─── 2. People ──────────────────────────────────────────────────────────────

create table public.staff (
  email text primary key,
  name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  mobile text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text default '',
  email text default '',
  user_id uuid unique,  -- set when the guest has a website account
  created_at timestamptz not null default now()
);

-- ─── 3. Bookings — the one table every channel writes to ───────────────────

create sequence public.booking_seq start 1001;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('BK-' || nextval('public.booking_seq')),
  cottage_id uuid not null references public.cottages(id),
  guest_id uuid references public.guests(id),
  user_id uuid,  -- the website account that made it, if any
  stay_date date not null,
  -- day · night · h22 · day_night (a day tour extended to overnight)
  slot text not null check (slot in ('day', 'night', 'h22', 'day_night')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  during tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'checked_in', 'settled', 'cancelled', 'no_show', 'expired', 'blocked')),
  source text not null default 'website'
    check (source in ('website', 'walk_in', 'messenger', 'whatsapp', 'viber', 'phone', 'facebook', 'block')),
  pax_adults int not null default 1,
  pax_children int not null default 0,
  estimate numeric(10,2) not null default 0,
  final_amount numeric(10,2),
  hold_until timestamptz,  -- online bookings only; null once a receipt is in
  block_reason text,
  notes text default '',
  cancel_reason text,
  checked_out_at timestamptz,
  client_key uuid unique,  -- one save = one booking, even on a double tap
  created_by text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- THE double-booking guard: no two live bookings on one cottage may overlap in time.
  constraint no_double_booking exclude using gist (cottage_id with =, during with &&)
    where (status in ('pending', 'confirmed', 'checked_in', 'settled', 'blocked'))
);
create index bookings_stay_date on public.bookings (stay_date);
create index bookings_guest on public.bookings (guest_id);
create index bookings_status on public.bookings (status);

-- ─── 4. Money ───────────────────────────────────────────────────────────────

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  kind text not null check (kind in ('downpayment', 'final', 'refund')),
  method text not null check (method in ('cash', 'gcash', 'bank')),
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'verified' check (status in ('submitted', 'verified', 'rejected')),
  receipt_path text,
  reference text default '',
  created_by text,
  created_at timestamptz not null default now(),
  verified_by text,
  verified_at timestamptz,
  edited boolean not null default false
);
create index payments_booking on public.payments (booking_id);
create index payments_created on public.payments (created_at);

create table public.payment_edits (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  old_amount numeric(10,2) not null,
  new_amount numeric(10,2) not null,
  reason text default '',
  edited_by text,
  edited_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default ((now() at time zone 'Asia/Manila')::date),
  category text not null default 'Other',
  cottage_id uuid references public.cottages(id),
  amount numeric(10,2) not null check (amount >= 0),
  note text default '',
  created_by text,
  created_at timestamptz not null default now()
);

create table public.daily_closes (
  close_date date primary key,
  cash_counted numeric(10,2) not null,
  cash_expected numeric(10,2) not null,
  note text default '',
  closed_by text,
  closed_at timestamptz not null default now()
);

-- ─── 5. Inbox ───────────────────────────────────────────────────────────────

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guests(id),  -- one thread per guest
  channel text not null default 'messenger' check (channel in ('messenger', 'whatsapp', 'viber', 'phone')),
  assigned_to text,
  unread boolean not null default true,
  last_message_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id),
  author text not null check (author in ('guest', 'staff')),
  body text not null,
  by_email text,
  created_at timestamptz not null default now()
);
create index messages_thread on public.messages (thread_id, created_at);

create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  sort int not null default 0
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text,
  action text not null,
  booking_id uuid references public.bookings(id),
  detail text default ''
);
create index activity_at on public.activity_log (at desc);

-- ─── 6. Helpers ─────────────────────────────────────────────────────────────

create or replace function public.me() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where lower(email) = public.me() and active)
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where lower(email) = public.me() and active and role = 'owner')
$$;

create or replace function public.manila_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Manila')::date $$;

-- The time range a slot covers on a date, from the owner's slot times.
create or replace function public.slot_range(p_date date, p_slot text) returns tstzrange
language plpgsql stable set search_path = public as $$
declare s settings; a timestamp; b timestamp;
begin
  select * into s from settings where id = 1;
  if p_slot = 'day' then a := p_date + s.day_start; b := p_date + s.day_end;
  elsif p_slot = 'night' then a := p_date + s.night_start; b := p_date + 1 + s.night_end;
  elsif p_slot = 'h22' then a := p_date + s.h22_start; b := p_date + 1 + s.h22_end;
  elsif p_slot = 'day_night' then a := p_date + s.day_start; b := p_date + 1 + s.night_end;
  else raise exception 'Unknown slot %', p_slot;
  end if;
  return tstzrange(a at time zone 'Asia/Manila', b at time zone 'Asia/Manila', '[)');
end $$;

create or replace function public.bookings_set_range() returns trigger
language plpgsql set search_path = public as $$
declare r tstzrange;
begin
  r := slot_range(new.stay_date, new.slot);
  new.starts_at := lower(r);
  new.ends_at := upper(r);
  return new;
end $$;

create trigger bookings_set_range before insert or update of stay_date, slot on public.bookings
for each row execute function public.bookings_set_range();

-- A pending online booking whose hold ran out, with no receipt sent, no longer counts.
create or replace function public.is_live(p_status text, p_hold timestamptz) returns boolean
language sql stable as $$
  select p_status in ('pending', 'confirmed', 'checked_in', 'settled', 'blocked')
     and not (p_status = 'pending' and p_hold is not null and p_hold < now())
$$;

create or replace function public.release_expired_holds() returns int
language sql security definer set search_path = public as $$
  with x as (
    update bookings set status = 'expired'
    where status = 'pending' and hold_until is not null and hold_until < now()
    returning 1
  ) select count(*)::int from x
$$;

create or replace function public.price_estimate(p_type uuid, p_date date, p_slot text, p_adults int, p_children int)
returns numeric language plpgsql stable set search_path = public as $$
declare t cottage_types; s settings; rate numeric; extra numeric;
begin
  select * into t from cottage_types where id = p_type;
  select * into s from settings where id = 1;
  rate := case p_slot when 'day' then t.rate_day when 'night' then t.rate_night
                      when 'h22' then t.rate_h22 when 'day_night' then t.rate_day + t.rate_night end;
  if extract(isodow from p_date) in (5, 6) then rate := rate + t.weekend_surcharge; end if;
  rate := rate + coalesce((select sum(surcharge) from rate_overrides
                           where on_date = p_date and (type_id is null or type_id = p_type)), 0);
  extra := greatest(0, p_adults + p_children - t.pax_included) * t.extra_head_fee;
  return rate + extra + p_adults * s.entrance_adult + p_children * s.entrance_child;
end $$;

create or replace function public.log_activity(p_action text, p_booking uuid, p_detail text) returns void
language sql security definer set search_path = public as $$
  insert into activity_log (actor, action, booking_id, detail) values (public.me(), p_action, p_booking, p_detail)
$$;

-- ─── 7. Actions (every write that touches availability goes through these) ──

-- Free cottages of each type per slot on a date — public, shows no guest data.
create or replace function public.type_availability(p_date date)
returns table (type_id uuid, slot text, free int)
language sql stable security definer set search_path = public as $$
  select t.id, s.slot,
    (select count(*)::int from cottages c
      where c.type_id = t.id and c.active
        and not exists (select 1 from bookings b
          where b.cottage_id = c.id and is_live(b.status, b.hold_until)
            and b.during && slot_range(p_date, s.slot)))
  from cottage_types t cross join (values ('day'), ('night'), ('h22')) s(slot)
  where t.active
$$;

-- The front-desk board: every cottage, its Day and Night half, and who is in it.
create or replace function public.board(p_date date)
returns table (cottage_id uuid, cottage_name text, type_id uuid, type_name text, half text,
               booking_id uuid, code text, guest_name text, status text, slot text, source text,
               pax int, block_reason text, checked_out_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, t.id, t.name, h.half,
         bk.id, bk.code, g.name, bk.status, bk.slot, bk.source,
         bk.pax_adults + bk.pax_children, bk.block_reason, bk.checked_out_at
  from cottages c
  join cottage_types t on t.id = c.type_id
  cross join (values ('day'), ('night')) h(half)
  left join lateral (
    select * from bookings b
    where b.cottage_id = c.id and is_live(b.status, b.hold_until)
      and b.during && slot_range(p_date, h.half)
    order by b.starts_at limit 1
  ) bk on true
  left join guests g on g.id = bk.guest_id
  where c.active and public.is_staff()
  order by t.sort, c.sort, h.half
$$;

-- A guest books a cottage TYPE online; the first free cottage of that type is assigned.
create or replace function public.create_online_booking(
  p_type uuid, p_date date, p_slot text, p_adults int, p_children int, p_name text, p_mobile text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); gid uuid; t cottage_types; s settings; c record; bid uuid; bcode text; est numeric;
begin
  if uid is null then raise exception 'Sign in to book'; end if;
  if p_slot not in ('day', 'night', 'h22') then raise exception 'Pick a slot'; end if;
  if p_date < manila_today() then raise exception 'That date has passed'; end if;
  select * into t from cottage_types where id = p_type and active;
  if not found then raise exception 'Unknown cottage type'; end if;
  if p_adults < 1 or p_adults + p_children > t.max_pax then
    raise exception 'This cottage fits up to % guests', t.max_pax;
  end if;
  select * into s from settings where id = 1;
  perform release_expired_holds();

  select id into gid from guests where user_id = uid;
  if gid is null then
    insert into guests (name, mobile, email, user_id) values (p_name, p_mobile, public.me(), uid) returning id into gid;
  else
    update guests set name = p_name, mobile = p_mobile where id = gid;
  end if;

  est := price_estimate(p_type, p_date, p_slot, p_adults, p_children);
  for c in select id, name from cottages where type_id = p_type and active order by sort loop
    begin
      insert into bookings (cottage_id, guest_id, user_id, stay_date, slot, status, source,
                            pax_adults, pax_children, estimate, hold_until, created_by, starts_at, ends_at)
      values (c.id, gid, uid, p_date, p_slot, 'pending', 'website', p_adults, p_children, est,
              now() + make_interval(hours => s.hold_hours), public.me(), now(), now() + interval '1 second')
      returning id, code into bid, bcode;
      perform log_activity('online booking', bid, c.name);
      return json_build_object('id', bid, 'code', bcode, 'cottage', c.name, 'estimate', est,
                               'downpayment', t.downpayment, 'hold_until', now() + make_interval(hours => s.hold_hours));
    exception when exclusion_violation then
      -- this cottage is taken for that slot; try the next one of the same type
    end;
  end loop;
  raise exception 'Sorry, no % is free for that slot any more', t.name;
end $$;

-- Staff: walk-in, chat or phone booking on a specific cottage.
create or replace function public.staff_create_booking(
  p_cottage uuid, p_date date, p_slot text, p_adults int, p_children int,
  p_name text, p_mobile text, p_source text, p_status text, p_notes text, p_client_key uuid,
  p_downpayment numeric, p_dp_method text)
returns json language plpgsql security definer set search_path = public as $$
declare gid uuid; bid uuid; bcode text; tid uuid; est numeric; existing record;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select id, code into existing from bookings where client_key = p_client_key;
  if found then return json_build_object('id', existing.id, 'code', existing.code, 'repeat', true); end if;
  perform release_expired_holds();

  if coalesce(p_mobile, '') <> '' then select id into gid from guests where mobile = p_mobile limit 1; end if;
  if gid is null then
    insert into guests (name, mobile) values (coalesce(nullif(p_name, ''), 'Walk-in guest'), coalesce(p_mobile, '')) returning id into gid;
  end if;

  select type_id into tid from cottages where id = p_cottage;
  est := price_estimate(tid, p_date, p_slot, p_adults, p_children);
  begin
    insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children,
                          estimate, notes, client_key, created_by, starts_at, ends_at)
    values (p_cottage, gid, p_date, p_slot, coalesce(p_status, 'confirmed'), p_source, p_adults, p_children,
            est, coalesce(p_notes, ''), p_client_key, public.me(), now(), now() + interval '1 second')
    returning id, code into bid, bcode;
  exception when exclusion_violation then
    raise exception 'That slot was just taken. Pick another cottage or slot.';
  end;
  if coalesce(p_downpayment, 0) > 0 then
    insert into payments (booking_id, kind, method, amount, status, created_by, verified_by, verified_at)
    values (bid, 'downpayment', coalesce(p_dp_method, 'cash'), p_downpayment, 'verified', public.me(), public.me(), now());
  end if;
  perform log_activity(case when p_source = 'walk_in' then 'walk-in' else 'booking added' end, bid, p_source);
  return json_build_object('id', bid, 'code', bcode, 'estimate', est);
end $$;

create or replace function public.block_slot(p_cottage uuid, p_date date, p_slot text, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  begin
    insert into bookings (cottage_id, stay_date, slot, status, source, pax_adults, block_reason, created_by, starts_at, ends_at)
    values (p_cottage, p_date, p_slot, 'blocked', 'block', 0, p_reason, public.me(), now(), now() + interval '1 second')
    returning id into bid;
  exception when exclusion_violation then
    raise exception 'That slot already has a booking.';
  end;
  perform log_activity('blocked', bid, p_reason);
  return bid;
end $$;

-- A day guest decides to stay the night.
create or replace function public.extend_to_overnight(p_booking uuid)
returns json language plpgsql security definer set search_path = public as $$
declare b bookings; tid uuid; alts text;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into b from bookings where id = p_booking;
  if b.slot <> 'day' then raise exception 'Only a day tour can be extended to overnight'; end if;
  select type_id into tid from cottages where id = b.cottage_id;
  begin
    update bookings set slot = 'day_night',
      estimate = estimate + (price_estimate(tid, stay_date, 'day_night', pax_adults, pax_children)
                           - price_estimate(tid, stay_date, 'day', pax_adults, pax_children))
    where id = p_booking;
  exception when exclusion_violation then
    select string_agg(c.name, ', ' order by c.sort) into alts from cottages c
    where c.type_id = tid and c.active and c.id <> b.cottage_id
      and not exists (select 1 from bookings x where x.cottage_id = c.id and is_live(x.status, x.hold_until)
                        and x.during && slot_range(b.stay_date, 'day_night'));
    raise exception 'Tonight is taken in this cottage. Free for the whole stay: %', coalesce(alts, 'none');
  end;
  perform log_activity('extended to overnight', p_booking, '');
  return json_build_object('ok', true);
end $$;

-- Move to another cottage and/or date and slot; refused if the new spot is taken.
create or replace function public.move_booking(p_booking uuid, p_cottage uuid, p_date date, p_slot text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  begin
    update bookings set cottage_id = p_cottage, stay_date = p_date, slot = p_slot where id = p_booking;
  exception when exclusion_violation then
    raise exception 'That cottage is taken for that slot.';
  end;
  perform log_activity('moved', p_booking, '');
end $$;

create or replace function public.update_booking(p_booking uuid, p_adults int, p_children int, p_source text, p_notes text, p_estimate numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  update bookings set pax_adults = p_adults, pax_children = p_children, source = p_source,
    notes = p_notes, estimate = p_estimate where id = p_booking;
  perform log_activity('edited', p_booking, '');
end $$;

create or replace function public.set_booking_status(p_booking uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  if p_action = 'check_in' then update bookings set status = 'checked_in' where id = p_booking;
  elsif p_action = 'check_out' then update bookings set checked_out_at = now() where id = p_booking;
  elsif p_action = 'cancel' then update bookings set status = 'cancelled', cancel_reason = p_reason where id = p_booking;
  elsif p_action = 'no_show' then update bookings set status = 'no_show' where id = p_booking;
  elsif p_action = 'unblock' then update bookings set status = 'cancelled' where id = p_booking and status = 'blocked';
  else raise exception 'Unknown action %', p_action;
  end if;
  perform log_activity(p_action, p_booking, coalesce(p_reason, ''));
end $$;

create or replace function public.recompute_final(p_booking uuid) returns void
language sql security definer set search_path = public as $$
  update bookings set final_amount = (
    select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0)
    from payments where booking_id = p_booking and status = 'verified')
  where id = p_booking and status = 'settled'
$$;

-- The final amount is flexible: staff collect whatever was agreed on site.
create or replace function public.settle_booking(p_booking uuid, p_amount numeric, p_method text, p_receipt text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  if coalesce(p_amount, 0) > 0 then
    insert into payments (booking_id, kind, method, amount, status, receipt_path, created_by, verified_by, verified_at)
    values (p_booking, 'final', p_method, p_amount, 'verified', p_receipt, public.me(), public.me(), now());
  end if;
  update bookings set status = 'settled', checked_out_at = coalesce(checked_out_at, now()) where id = p_booking;
  perform recompute_final(p_booking);
  perform log_activity('settled', p_booking, p_method || ' ' || p_amount);
end $$;

-- Staff and owner may change an amount later; the old figure is always kept.
create or replace function public.edit_payment(p_payment uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare p payments;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into p from payments where id = p_payment;
  if p.amount = p_amount then return; end if;
  insert into payment_edits (payment_id, old_amount, new_amount, reason, edited_by)
  values (p_payment, p.amount, p_amount, coalesce(p_reason, ''), public.me());
  update payments set amount = p_amount, edited = true where id = p_payment;
  perform recompute_final(p.booking_id);
  perform log_activity('payment edited', p.booking_id, p.amount || ' → ' || p_amount);
end $$;

create or replace function public.verify_payment(p_payment uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p payments; s settings;
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  select * into p from payments where id = p_payment;
  select * into s from settings where id = 1;
  if p_ok then
    update payments set status = 'verified', verified_by = public.me(), verified_at = now() where id = p_payment;
    update bookings set status = 'confirmed', hold_until = null where id = p.booking_id and status = 'pending';
  else
    update payments set status = 'rejected', verified_by = public.me(), verified_at = now() where id = p_payment;
    -- give the guest a fresh hold to send a correct receipt
    update bookings set hold_until = now() + make_interval(hours => s.hold_hours)
    where id = p.booking_id and status = 'pending';
  end if;
  perform log_activity(case when p_ok then 'downpayment verified' else 'downpayment rejected' end, p.booking_id, '');
end $$;

-- A guest sends the downpayment receipt; the slot is then held until staff decide.
create or replace function public.submit_receipt(p_booking uuid, p_path text, p_method text, p_amount numeric, p_reference text)
returns void language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking and user_id = auth.uid();
  if not found then raise exception 'Booking not found'; end if;
  if not is_live(b.status, b.hold_until) then raise exception 'This booking''s hold has expired. Please book again.'; end if;
  insert into payments (booking_id, kind, method, amount, status, receipt_path, reference, created_by)
  values (p_booking, 'downpayment', p_method, p_amount, 'submitted', p_path, coalesce(p_reference, ''), public.me());
  update bookings set hold_until = null where id = p_booking;
  perform log_activity('receipt uploaded', p_booking, p_method);
end $$;

create or replace function public.send_message(p_thread uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'Staff only'; end if;
  insert into messages (thread_id, author, body, by_email) values (p_thread, 'staff', p_body, public.me());
  update threads set last_message_at = now(), unread = false where id = p_thread;
end $$;

-- ─── 8. Row-level security ──────────────────────────────────────────────────

alter table public.settings enable row level security;
alter table public.cottage_types enable row level security;
alter table public.cottages enable row level security;
alter table public.rate_overrides enable row level security;
alter table public.staff enable row level security;
alter table public.guests enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payment_edits enable row level security;
alter table public.expenses enable row level security;
alter table public.daily_closes enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.quick_replies enable row level security;
alter table public.activity_log enable row level security;

create policy "public read" on public.settings for select using (true);
create policy "owner writes" on public.settings for update using (public.is_owner());
create policy "public read" on public.cottage_types for select using (true);
create policy "owner writes" on public.cottage_types for all using (public.is_owner()) with check (public.is_owner());
create policy "public read" on public.cottages for select using (true);
create policy "owner writes" on public.cottages for all using (public.is_owner()) with check (public.is_owner());
create policy "public read" on public.rate_overrides for select using (true);
create policy "owner writes" on public.rate_overrides for all using (public.is_owner()) with check (public.is_owner());

create policy "staff read" on public.staff for select using (public.is_staff());
create policy "owner manages" on public.staff for all using (public.is_owner()) with check (public.is_owner());

create policy "staff all" on public.guests for all using (public.is_staff()) with check (public.is_staff());
create policy "guest own" on public.guests for select using (user_id = auth.uid());

-- Bookings change only through the functions above, so the guard and the log always run.
create policy "staff read" on public.bookings for select using (public.is_staff());
create policy "guest own" on public.bookings for select using (user_id = auth.uid());

create policy "staff read" on public.payments for select using (public.is_staff());
create policy "guest own" on public.payments for select using (
  exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "staff read" on public.payment_edits for select using (public.is_staff());

create policy "staff read" on public.expenses for select using (public.is_staff());
create policy "staff add" on public.expenses for insert with check (public.is_staff());
create policy "owner edits" on public.expenses for update using (public.is_owner());
create policy "owner deletes" on public.expenses for delete using (public.is_owner());

create policy "staff all" on public.daily_closes for all using (public.is_staff()) with check (public.is_staff());
create policy "staff all" on public.threads for all using (public.is_staff()) with check (public.is_staff());
create policy "staff read" on public.messages for select using (public.is_staff());
create policy "staff read" on public.quick_replies for select using (public.is_staff());
create policy "owner writes" on public.quick_replies for all using (public.is_owner()) with check (public.is_owner());
create policy "staff read" on public.activity_log for select using (public.is_staff());

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.cottage_types, public.cottages, public.rate_overrides to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Live updates for the front-desk board.
alter publication supabase_realtime add table public.bookings, public.payments, public.messages;

-- Receipts and cash photos: private. Guests upload into their own folder.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict do nothing;
create policy "receipts: guest uploads own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts: staff uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_staff());
create policy "receipts: read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text));

-- ─── 9. Sample data for the preview (delete before go-live) ────────────────

insert into public.settings (id, resort_name, tagline, address, entrance_adult, entrance_child,
  gcash_name, gcash_number, bank_name, bank_account_name, bank_account_number,
  messenger_url, whatsapp_number, viber_number, facebook_url)
values (1, 'Beach Villas', 'Simple cottages right on the sand', 'Sample address, Philippines', 100, 50,
  'Sample Name', '0917 000 0000', 'BDO', 'Sample Name', '0000 0000 0000',
  'https://m.me/', '+639170000000', '+639170000000', 'https://facebook.com/');

insert into public.staff (email, name, role) values
  ('owner@beach.test', 'Owner (demo)', 'owner'),
  ('staff@beach.test', 'Front desk (demo)', 'staff');

do $$
declare kubo uuid; fam uuid; bark uuid; d date := public.manila_today();
  g1 uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid; b uuid; i int;
begin
  insert into cottage_types (name, description, pax_included, max_pax, rate_day, rate_night, rate_h22, weekend_surcharge, extra_head_fee, downpayment, sort)
  values ('Kubo', 'Bamboo kubo with a table and benches, a few steps from the water.', 6, 10, 800, 1200, 1800, 200, 100, 500, 1)
  returning id into kubo;
  insert into cottage_types (name, description, pax_included, max_pax, rate_day, rate_night, rate_h22, weekend_surcharge, extra_head_fee, downpayment, sort)
  values ('Family Cottage', 'Roofed cottage with a sleeping area, fan and its own grill.', 10, 15, 1500, 2500, 3500, 300, 150, 1000, 2)
  returning id into fam;
  insert into cottage_types (name, description, pax_included, max_pax, rate_day, rate_night, rate_h22, weekend_surcharge, extra_head_fee, downpayment, sort)
  values ('Barkada Cottage', 'Our biggest cottage for groups, with a long table and a videoke corner.', 20, 30, 2500, 4000, 5500, 500, 150, 2000, 3)
  returning id into bark;

  for i in 1..6 loop insert into cottages (type_id, name, sort) values (kubo, 'Kubo ' || i, i); end loop;
  for i in 1..5 loop insert into cottages (type_id, name, sort) values (fam, 'Family ' || i, 10 + i); end loop;
  for i in 1..3 loop insert into cottages (type_id, name, sort) values (bark, 'Barkada ' || i, 20 + i); end loop;

  insert into guests (name, mobile) values ('Maria Santos', '09171234567') returning id into g1;
  insert into guests (name, mobile) values ('Jun Reyes', '09181234567') returning id into g2;
  insert into guests (name, mobile) values ('Ana Cruz', '09191234567') returning id into g3;
  insert into guests (name, mobile) values ('Mark Villanueva', '09201234567') returning id into g4;
  insert into guests (name, mobile) values ('Liza Garcia', '09211234567') returning id into g5;

  -- today: a day tour in, an overnight coming, a 22-hour group, a walk-in, a block
  insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children, estimate, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Kubo 1'), g1, d, 'day', 'checked_in', 'messenger', 6, 2, 1800, 'staff@beach.test', now(), now())
  returning id into b;
  insert into payments (booking_id, kind, method, amount, created_by, verified_by, verified_at) values (b, 'downpayment', 'gcash', 500, 'staff@beach.test', 'staff@beach.test', now());

  insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children, estimate, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Family 2'), g2, d, 'night', 'confirmed', 'whatsapp', 9, 3, 3950, 'staff@beach.test', now(), now())
  returning id into b;
  insert into payments (booking_id, kind, method, amount, created_by, verified_by, verified_at) values (b, 'downpayment', 'bank', 1000, 'staff@beach.test', 'staff@beach.test', now());

  insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children, estimate, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Barkada 1'), g3, d, 'h22', 'checked_in', 'viber', 22, 0, 8100, 'owner@beach.test', now(), now())
  returning id into b;
  insert into payments (booking_id, kind, method, amount, created_by, verified_by, verified_at) values (b, 'downpayment', 'gcash', 2000, 'owner@beach.test', 'owner@beach.test', now());

  insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children, estimate, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Kubo 3'), g4, d, 'day', 'checked_in', 'walk_in', 4, 0, 1200, 'staff@beach.test', now(), now());

  insert into bookings (cottage_id, stay_date, slot, status, source, pax_adults, block_reason, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Kubo 6'), d, 'day', 'blocked', 'block', 0, 'Roof repair', 'owner@beach.test', now(), now());

  -- yesterday: settled, one with a discount
  insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children, estimate, final_amount, checked_out_at, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Family 1'), g5, d - 1, 'day', 'settled', 'messenger', 10, 2, 2200, 2000, now() - interval '1 day', 'staff@beach.test', now(), now())
  returning id into b;
  insert into payments (booking_id, kind, method, amount, created_by, verified_by, verified_at, created_at) values
    (b, 'downpayment', 'gcash', 1000, 'staff@beach.test', 'staff@beach.test', now() - interval '3 days', now() - interval '3 days'),
    (b, 'final', 'cash', 1000, 'staff@beach.test', 'staff@beach.test', now() - interval '1 day', now() - interval '1 day');

  -- tomorrow: an online booking waiting for staff to verify the receipt
  insert into bookings (cottage_id, guest_id, stay_date, slot, status, source, pax_adults, pax_children, estimate, created_by, starts_at, ends_at)
  values ((select id from cottages where name = 'Kubo 2'), g2, d + 1, 'night', 'pending', 'website', 5, 0, 1700, 'guest', now(), now())
  returning id into b;
  insert into payments (booking_id, kind, method, amount, status, reference, created_by) values (b, 'downpayment', 'gcash', 500, 'submitted', 'GCash ref 1234 5678', 'guest');

  insert into expenses (spent_on, category, amount, note, created_by) values
    (d, 'Supplies', 850, 'Charcoal and ice', 'staff@beach.test'),
    (d - 1, 'Utilities', 3200, 'Electricity, partial', 'owner@beach.test'),
    (d - 2, 'Laundry', 600, 'Towels', 'staff@beach.test');

  insert into threads (guest_id, channel, unread, last_message_at) values (g1, 'messenger', false, now() - interval '2 hours') returning id into b;
  insert into messages (thread_id, author, body, created_at) values
    (b, 'guest', 'Hi! May available pa po bang kubo today, 8 pax?', now() - interval '3 hours'),
    (b, 'staff', 'Yes po, Kubo 1 is free for the day tour. ₱800 + entrance. Downpayment ₱500 via GCash.', now() - interval '2 hours');
  insert into threads (guest_id, channel, unread, last_message_at) values (g5, 'messenger', true, now() - interval '10 minutes') returning id into b;
  insert into messages (thread_id, author, body, created_at) values
    (b, 'guest', 'Hello, how much po ang Family Cottage overnight this Saturday? 12 pax kami.', now() - interval '10 minutes');
  insert into threads (guest_id, channel, unread, last_message_at) values (g2, 'whatsapp', false, now() - interval '1 day') returning id into b;
  insert into messages (thread_id, author, body, created_at) values
    (b, 'guest', 'Sent the bank transfer for tonight.', now() - interval '1 day'),
    (b, 'staff', 'Received, thank you! See you at 6 PM.', now() - interval '1 day');

  insert into quick_replies (title, body, sort) values
    ('Rates', 'Kubo: ₱800 day / ₱1,200 overnight / ₱1,800 22 hrs. Family: ₱1,500 / ₱2,500 / ₱3,500. Barkada: ₱2,500 / ₱4,000 / ₱5,500. Entrance ₱100 adult, ₱50 child.', 1),
    ('Slot times', 'Day tour 8 AM–5 PM · Overnight 6 PM–7 AM · 22 hours 2 PM–12 NN next day.', 2),
    ('Downpayment', 'To reserve, please send the downpayment via GCash (0917 000 0000) or BDO (0000 0000 0000) and send us the receipt here.', 3),
    ('Directions', 'Here is our pin: (Google Maps link). Look for the blue gate by the beach.', 4);
end $$;
