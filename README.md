# Beach Villas

Booking system for a 14-cottage beach resort, a lean version of the Malaya stack: TanStack Start + React 19 + Tailwind 4 + Supabase, deployed on Vercel. Plain white for now; branding comes later.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev                  # http://localhost:3000
```

## Database

`supabase/schema.sql` is the whole database. Paste it into **Supabase → SQL Editor → Run** once, on an empty project. Section 9 at the bottom is sample data for the preview; delete those rows before go-live.

`npm run test:schema` runs the schema on an in-memory Postgres (PGlite) and checks the booking rules: no double booking, day + night on one cottage, 22 hours blocking both, extending a day tour, double-tap protection, flexible and editable final amounts.

### How double bookings are stopped

Every booking (website, walk-in, chat, block) is a row in `bookings` with a time range. A Postgres exclusion constraint refuses any two live rows on the same cottage whose times overlap, and every write goes through a database function (`staff_create_booking`, `create_online_booking`, `extend_to_overnight`, `move_booking`, `block_slot`), so the browser never writes bookings directly.

## Preview logins

| Who | Email | Password |
| --- | --- | --- |
| Owner | owner@beach.test | beach1234 |
| Front desk | staff@beach.test | beach1234 |
| Guest | guest@beach.test | beach1234 |

## Screens

- Guest: `/` (pick date, slot, pax → cottage types with live free counts and estimate), `/book`, `/my` (bookings + downpayment receipt upload), chat buttons to Messenger / WhatsApp / Viber.
- Admin (`/admin`, bottom tabs): Home (cottage board, needs action, today's money), Inbox, Bookings (Today, Requests, All, Guests, detail with check in / stay overnight / settle / edit payment / move / cancel), Calendar (week grid), Finance (owner: collections, daily close, expenses, per cottage), Team (owner) and Settings (rates, pax, slot times, payment details).

## Not built yet

Messenger live connection (needs Meta app review), Airbnb / Booking.com iCal (data model ready), emails (Resend), hold sweeper on a schedule (expired holds are released whenever someone books), cottage photos, branding.

## Deploy

Vercel: import the repo, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The build uses nitro's `vercel` preset. Never put the secret key in a `VITE_` variable.
