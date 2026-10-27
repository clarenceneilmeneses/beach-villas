-- 006: a short name for the wordmark, and the pin for the About page map.
-- Safe to run more than once.

alter table public.settings add column if not exists short_name text default '';
alter table public.settings add column if not exists map_lat numeric(9,6);
alter table public.settings add column if not exists map_lng numeric(9,6);

-- Patungan Beach (Maragondon, Cavite), past Kaybiang Tunnel.
update public.settings
   set resort_name = case when resort_name = 'Beach Villas' then 'Patungan Beach Lerma & Berto Libay Cottages' else resort_name end,
       short_name = coalesce(nullif(short_name, ''), 'Patungan Beach'),
       map_lat = coalesce(map_lat, 14.274135),
       map_lng = coalesce(map_lng, 120.734924)
 where id = 1;
