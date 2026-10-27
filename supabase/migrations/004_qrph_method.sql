-- 004 — one QR Ph code for every bank and e-wallet, so a payment can say "QR Ph".
-- Paste into Supabase → SQL Editor → Run, once. (Also included in schema.sql.)
-- The QR image itself lives in settings.gcash_qr_path, shown to guests as the QR Ph code.

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cash', 'gcash', 'bank', 'qrph'));
