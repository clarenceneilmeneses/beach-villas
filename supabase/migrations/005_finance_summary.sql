-- 005 — Finance totals worked out by the database, so they stay right at any
-- volume. (A browser read stops at 1,000 rows; a busy month has more payments.)
-- Paste into Supabase → SQL Editor → Run, once. (Also included in schema.sql.)
--
-- Money in is by the day a payment was made; bookings, stays and discounts are
-- by stay date; expenses by the day they were spent. p_cottages = null means
-- every cottage; with a list, resort-wide expenses are left out.

create or replace function public.finance_summary(p_from date, p_to date, p_cottages uuid[] default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not is_staff() then raise exception 'Staff only'; end if;

  with pay as (
    select p.kind, p.method, p.amount, b.cottage_id,
           (p.created_at at time zone 'Asia/Manila')::date as d,
           case when p.kind = 'refund' then -p.amount else p.amount end as signed
    from payments p join bookings b on b.id = p.booking_id
    where p.status = 'verified'
      and (p.created_at at time zone 'Asia/Manila')::date between p_from and p_to
      and (p_cottages is null or b.cottage_id = any(p_cottages))
  ),
  exp as (
    select category, amount, cottage_id, spent_on from expenses
    where spent_on between p_from and p_to
      and (p_cottages is null or cottage_id = any(p_cottages))
  ),
  bk as (
    select * from bookings
    where stay_date between p_from and p_to
      and status in ('confirmed', 'checked_in', 'settled', 'no_show', 'cancelled')
      and (p_cottages is null or cottage_id = any(p_cottages))
  ),
  live as (select * from bk where status not in ('cancelled', 'no_show')),
  cots as (select id, name, sort from cottages where active and (p_cottages is null or id = any(p_cottages)))
  select json_build_object(
    'collected',    coalesce((select sum(signed) from pay), 0),
    'payments',     (select count(*) from pay),
    'downpayments', coalesce((select sum(amount) from pay where kind = 'downpayment'), 0),
    'finals',       coalesce((select sum(amount) from pay where kind = 'final'), 0),
    'refunds',      coalesce((select sum(amount) from pay where kind = 'refund'), 0),
    'by_method',    coalesce((select json_agg(json_build_object('method', method, 'total', t) order by t desc)
                               from (select method, sum(signed) t from pay group by method) x), '[]'),
    'expenses',     coalesce((select sum(amount) from exp), 0),
    'by_category',  coalesce((select json_agg(json_build_object('category', category, 'total', t) order by t desc)
                               from (select category, sum(amount) t from exp group by category) x), '[]'),
    'bookings',     (select count(*) from live),
    'cancelled',    (select count(*) from bk where status in ('cancelled', 'no_show')),
    'settled',      (select count(*) from bk where status = 'settled'),
    'by_slot',      coalesce((select json_agg(json_build_object('slot', slot, 'n', n) order by n desc)
                               from (select slot, count(*) n from live group by slot) x), '[]'),
    'halves',       coalesce((select sum(case when slot in ('h22', 'day_night') then 2 else 1 end) from live), 0),
    'capacity',     (select count(*) from cots) * 2 * (p_to - p_from + 1),
    'discounts',    coalesce((select sum(greatest(0, estimate - coalesce(final_amount, 0))) from bk where status = 'settled'), 0),
    'daily',        coalesce((select json_agg(json_build_object('d', g::date,
                                 'collected', coalesce((select sum(signed) from pay where pay.d = g::date), 0),
                                 'expenses',  coalesce((select sum(amount) from exp where exp.spent_on = g::date), 0)) order by g)
                               from generate_series(p_from, p_to, interval '1 day') g), '[]'),
    'cottages',     coalesce((select json_agg(json_build_object(
                                 'id', c.id, 'name', c.name,
                                 'collected', coalesce((select sum(signed) from pay where pay.cottage_id = c.id), 0),
                                 'expenses',  coalesce((select sum(amount) from exp where exp.cottage_id = c.id), 0),
                                 'bookings',  (select count(*) from live where live.cottage_id = c.id),
                                 'day',       (select count(*) from live where live.cottage_id = c.id and slot = 'day'),
                                 'night',     (select count(*) from live where live.cottage_id = c.id and slot in ('night', 'day_night')),
                                 'h22',       (select count(*) from live where live.cottage_id = c.id and slot = 'h22'),
                                 'halves',    coalesce((select sum(case when slot in ('h22', 'day_night') then 2 else 1 end) from live where live.cottage_id = c.id), 0),
                                 'discounts', coalesce((select sum(greatest(0, estimate - coalesce(final_amount, 0))) from bk where bk.cottage_id = c.id and status = 'settled'), 0)
                               ) order by c.sort) from cots c), '[]')
  ) into result;
  return result;
end $$;
