// Runs supabase/schema.sql on an in-memory Postgres (PGlite) with Supabase's
// auth and storage stubbed, then checks the booking rules that matter most.
// Usage: npm run test:schema
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const db = new PGlite({ extensions: { btree_gist } });

await db.exec(`
  create role anon; create role authenticated;
  create publication supabase_realtime;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
`);

await db.exec(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));

let failures = 0;
const as = (email, uid = "") =>
  db.exec(`select set_config('test.email', '${email}', false), set_config('test.uid', '${uid}', false)`);
async function expectOk(label, sql) {
  try {
    const r = await db.query(sql);
    console.log("  ok   ", label);
    return r.rows[0];
  } catch (e) {
    failures++;
    console.log("  FAIL ", label, "→", e.message);
  }
}
async function expectError(label, sql, match) {
  try {
    await db.query(sql);
    failures++;
    console.log("  FAIL ", label, "→ no error");
  } catch (e) {
    const good = !match || e.message.includes(match);
    if (!good) failures++;
    console.log(good ? "  ok   " : "  FAIL ", label, "→", e.message);
  }
}
const id = async (sql) => (await db.query(sql)).rows[0].id;

console.log("schema loaded");
await as("staff@beach.test");
const kubo5 = await id(`select id from cottages where name = 'Kubo 5'`);
const kubo1 = await id(`select id from cottages where name = 'Kubo 1'`);
const kuboType = await id(`select id from cottage_types where name = 'Kubo'`);
const day = (await db.query(`select (manila_today() + 7)::text as d`)).rows[0].d;

const walk = (cottage, slot, key) =>
  `select staff_create_booking('${cottage}', '${day}', '${slot}', 4, 0, 'Test', '', 'walk_in', 'confirmed', '', '${key}', 0, null) as r`;

await expectOk("day tour on Kubo 5", walk(kubo5, "day", "00000000-0000-0000-0000-000000000001"));
await expectOk("same save twice = one booking", walk(kubo5, "day", "00000000-0000-0000-0000-000000000001"));
await expectError("second day tour on Kubo 5 is refused", walk(kubo5, "day", "00000000-0000-0000-0000-000000000002"), "just taken");
await expectOk("overnight on the same cottage and date is allowed", walk(kubo5, "night", "00000000-0000-0000-0000-000000000003"));
await expectError("22 hours on top of those is refused", walk(kubo5, "h22", "00000000-0000-0000-0000-000000000004"), "just taken");

const dayOnly = await expectOk("day tour on Kubo 1", walk(kubo1, "day", "00000000-0000-0000-0000-000000000005"));
await expectOk("extend Kubo 1 day tour to overnight", `select extend_to_overnight('${dayOnly.r.id}')`);
await expectError("walk-in for Kubo 1 tonight is refused after the extension", walk(kubo1, "night", "00000000-0000-0000-0000-000000000006"), "just taken");

const d5 = await expectOk("day tour on Kubo 5 the next day", walk(kubo5, "day", "00000000-0000-0000-0000-000000000007").replace(`'${day}'`, `'${day}'::date + 1`));
const nightTaken = await expectOk("night on Kubo 5 the next day", walk(kubo5, "night", "00000000-0000-0000-0000-000000000008").replace(`'${day}'`, `'${day}'::date + 1`));
await expectError("extending into a taken night is refused with alternatives", `select extend_to_overnight('${d5.r.id}')`, "Free for the whole stay");

const avail = await db.query(`select slot, free from type_availability('${day}') where type_id = '${kuboType}' order by slot`);
console.log("  info  Kubo free on test day:", avail.rows.map((r) => `${r.slot}=${r.free}`).join(" "));

await as("guest@beach.test", "11111111-1111-1111-1111-111111111111");
const online = await expectOk("online booking picks a free Kubo", `select create_online_booking('${kuboType}', '${day}', 'day', 2, 0, 'Guest', '0917') as r`);
console.log("  info  assigned", online?.r?.cottage);
await expectOk("guest uploads receipt", `select submit_receipt('${online.r.id}', '11111111-1111-1111-1111-111111111111/r.jpg', 'gcash', 500, 'ref')`);
await expectError("guest cannot verify", `select verify_payment((select id from payments where booking_id = '${online.r.id}'), true)`, "Staff only");

await as("staff@beach.test");
await expectOk("staff verifies the downpayment", `select verify_payment((select id from payments where booking_id = '${online.r.id}'), true)`);
const st = await db.query(`select status from bookings where id = '${online.r.id}'`);
console.log(st.rows[0].status === "confirmed" ? "  ok   " : "  FAIL ", "booking is confirmed →", st.rows[0].status);
if (st.rows[0].status !== "confirmed") failures++;

await expectOk("settle with a flexible final amount", `select settle_booking('${online.r.id}', 700, 'cash', null)`);
const fp = await id(`select id from payments where booking_id = '${online.r.id}' and kind = 'final'`);
await expectOk("edit the final payment later", `select edit_payment('${fp}', 650, 'counted again')`);
const fin = await db.query(`select final_amount from bookings where id = '${online.r.id}'`);
const finOk = Number(fin.rows[0].final_amount) === 1150;
if (!finOk) failures++;
console.log(finOk ? "  ok   " : "  FAIL ", "final amount = 500 + 650 →", fin.rows[0].final_amount);

await expectOk("board for today returns 28 halves", `select count(*) as n from board(manila_today())`);
console.log("  info  board rows:", (await db.query(`select count(*)::int as n from board(manila_today())`)).rows[0].n);

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
