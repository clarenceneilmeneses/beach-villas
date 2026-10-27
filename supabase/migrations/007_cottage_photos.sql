-- 007: photos per cottage type. The first photo is the cover; the rest make
-- the gallery on the cottage page. Files live in the public cottage-photos
-- bucket; only the owner adds, replaces or removes them. Safe to re-run.

alter table public.cottage_types add column if not exists photos text[] not null default '{}';

insert into storage.buckets (id, name, public) values ('cottage-photos', 'cottage-photos', true) on conflict do nothing;
drop policy if exists "cottage-photos: owner uploads" on storage.objects;
create policy "cottage-photos: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'cottage-photos' and public.is_owner());
drop policy if exists "cottage-photos: owner replaces" on storage.objects;
create policy "cottage-photos: owner replaces" on storage.objects for update to authenticated
  using (bucket_id = 'cottage-photos' and public.is_owner());
drop policy if exists "cottage-photos: owner removes" on storage.objects;
create policy "cottage-photos: owner removes" on storage.objects for delete to authenticated
  using (bucket_id = 'cottage-photos' and public.is_owner());

-- The resort's first photos (already uploaded), only where none are set yet.
update public.cottage_types set photos = array[
  'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/kubo-5.webp', 'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/kubo-8.webp', 'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/kubo-9.webp'
] where name = 'Kubo' and photos = '{}';
update public.cottage_types set photos = array[
  'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/family-front.webp', 'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/family-inside.webp', 'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/family-room.webp',
  'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/family-front-2.webp', 'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/family-room-2.webp', 'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/family-pair.webp'
] where name = 'Family Cottage' and photos = '{}';
update public.cottage_types set photos = array[
  'https://ojbthnhievmdhtouhxcb.supabase.co/storage/v1/object/public/cottage-photos/patungan/beachfront-1.webp'
] where name = 'Barkada Cottage' and photos = '{}';
update public.cottage_types set photo_url = photos[1] where cardinality(photos) > 0;
