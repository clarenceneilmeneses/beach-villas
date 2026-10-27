-- 003 — free cottages of one type, per date and slot, for the guest's calendar.
-- Paste into Supabase → SQL Editor → Run, once. (Also included in schema.sql.)

create or replace function public.type_month_availability(p_type uuid, p_from date, p_to date)
returns table (on_date date, slot text, free int)
language sql stable security definer set search_path = public as $$
  select d::date, s.slot,
    (select count(*)::int from cottages c
      where c.type_id = p_type and c.active
        and not exists (select 1 from bookings b
          where b.cottage_id = c.id and is_live(b.status, b.hold_until)
            and b.during && slot_range(d::date, s.slot)))
  from generate_series(p_from, least(p_to, p_from + 62), interval '1 day') d
  cross join (values ('day'), ('night'), ('h22')) s(slot)
  order by 1, 2
$$;
