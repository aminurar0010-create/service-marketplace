-- ============================================================
-- ফেজ I — প্রিন্টিং প্রাইস ক্যালকুলেটর ও কোটেশন
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন। একাধিকবার রান করলেও সমস্যা নেই।
-- ⚠️ আগে ফেজ A–H রান করা থাকতে হবে।
--
-- কী হবে:
--   ১) price_rules — সার্ভিসের রেট (একক: বর্গফুট/পিস/পাতা/সেট, ন্যূনতম চার্জ, পরিমাণ-ভিত্তিক ধাপ)
--   ২) quotes + quote_items — কোটেশন (নম্বর QT-000001…, মেয়াদ, স্ট্যাটাস)
--   ৩) create_quote() / set_quote_status() / link_quote_sale() — সব লেখা এই ফাংশনের মাধ্যমে (মোট সার্ভারেই হিসাব হয়)
-- রেট বদলানো শুধু অ্যাডমিন; কোটেশন বানানো/দেখা অ্যাডমিন + কাউন্টার অপারেটর।
-- ============================================================

create table if not exists price_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  category text,
  unit text not null check (unit in ('piece', 'sqft', 'page', 'set')),
  rate numeric(10,2) not null check (rate >= 0),
  min_charge numeric(10,2) not null default 0 check (min_charge >= 0),
  tiers jsonb not null default '[]'::jsonb check (jsonb_typeof(tiers) = 'array'),
  note text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create sequence if not exists quote_no_seq;

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null unique,
  shop_customer_id uuid references shop_customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  note text,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'sold')),
  valid_until date,
  sale_id uuid references pos_sales(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quotes_created_idx on quotes (created_at desc);
create index if not exists quotes_customer_idx on quotes (shop_customer_id);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  detail text,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null,
  rule_id uuid references price_rules(id) on delete set null,
  sort_order int not null default 0
);
create index if not exists quote_items_quote_idx on quote_items (quote_id, sort_order);

alter table price_rules enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;

drop policy if exists "Admin and counter view price rules" on price_rules;
create policy "Admin and counter view price rules" on price_rules
  for select using (is_admin(auth.uid()) or is_counter_operator(auth.uid()));
drop policy if exists "Admins manage price rules" on price_rules;
create policy "Admins manage price rules" on price_rules
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists "Admin and counter view quotes" on quotes;
create policy "Admin and counter view quotes" on quotes
  for select using (is_admin(auth.uid()) or is_counter_operator(auth.uid()));
drop policy if exists "Admins delete quotes" on quotes;
create policy "Admins delete quotes" on quotes
  for delete using (is_admin(auth.uid()));
-- ইনসার্ট/আপডেট শুধু নিচের ফাংশন দিয়ে

drop policy if exists "Admin and counter view quote items" on quote_items;
create policy "Admin and counter view quote items" on quote_items
  for select using (is_admin(auth.uid()) or is_counter_operator(auth.uid()));

-- কোটেশন তৈরি (মোট সার্ভারে হিসাব হয়, ক্লায়েন্টের পাঠানো মোট বিশ্বাস করা হয় না)
create or replace function create_quote(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_note text,
  p_discount numeric,
  p_valid_days int,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_customer_name), '');
  v_phone text := nullif(trim(p_customer_phone), '');
  v_subtotal numeric := 0;
  v_discount numeric := greatest(coalesce(p_discount, 0), 0);
  v_id uuid;
  v_no text;
  v_item jsonb;
  v_qty numeric;
  v_price numeric;
  v_i int := 0;
begin
  if not (is_admin(auth.uid()) or is_counter_operator(auth.uid())) then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'কোটেশনে অন্তত একটি আইটেম দিন');
  end if;
  if jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('success', false, 'message', 'একটি কোটেশনে সর্বোচ্চ ৫০টি আইটেম');
  end if;

  if p_customer_id is not null then
    select name, phone into v_name, v_phone from shop_customers where id = p_customer_id;
    if v_name is null then
      return jsonb_build_object('success', false, 'message', 'কাস্টমার খুঁজে পাওয়া যায়নি');
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    if coalesce(trim(v_item->>'description'), '') = '' or v_qty is null or v_qty <= 0 or v_price is null or v_price < 0 then
      return jsonb_build_object('success', false, 'message', 'আইটেমের বিবরণ, পরিমাণ ও দাম সঠিক নয়');
    end if;
    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  end loop;

  if v_discount > v_subtotal then
    return jsonb_build_object('success', false, 'message', 'ছাড় মোটের বেশি হতে পারে না');
  end if;

  v_no := 'QT-' || lpad(nextval('quote_no_seq')::text, 6, '0');
  insert into quotes (quote_no, shop_customer_id, customer_name, customer_phone, note, subtotal, discount, total, valid_until, created_by)
  values (
    v_no, p_customer_id, v_name, v_phone, nullif(trim(p_note), ''), v_subtotal, v_discount, v_subtotal - v_discount,
    (now() at time zone 'Asia/Dhaka')::date + least(greatest(coalesce(p_valid_days, 7), 1), 90),
    auth.uid()
  )
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_i := v_i + 1;
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    insert into quote_items (quote_id, description, detail, quantity, unit_price, line_total, rule_id, sort_order)
    values (
      v_id, trim(v_item->>'description'), nullif(trim(v_item->>'detail'), ''), v_qty, v_price, round(v_qty * v_price, 2),
      nullif(v_item->>'rule_id', '')::uuid, v_i
    );
  end loop;

  return jsonb_build_object('success', true, 'id', v_id, 'quote_no', v_no, 'total', v_subtotal - v_discount);
end;
$$;

create or replace function set_quote_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cur text;
begin
  if not (is_admin(auth.uid()) or is_counter_operator(auth.uid())) then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  if p_status not in ('draft', 'sent', 'accepted', 'rejected') then
    return jsonb_build_object('success', false, 'message', 'স্ট্যাটাস সঠিক নয়');
  end if;
  select status into v_cur from quotes where id = p_id;
  if v_cur is null then
    return jsonb_build_object('success', false, 'message', 'কোটেশন পাওয়া যায়নি');
  end if;
  if v_cur = 'sold' then
    return jsonb_build_object('success', false, 'message', 'এই কোটেশন থেকে বিক্রি হয়ে গেছে, বদলানো যাবে না');
  end if;
  update quotes set status = p_status where id = p_id;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function link_quote_sale(p_quote_id uuid, p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  if not exists (select 1 from pos_sales where id = p_sale_id) then
    return jsonb_build_object('success', false, 'message', 'বিক্রি পাওয়া যায়নি');
  end if;
  update quotes set sale_id = p_sale_id, status = 'sold' where id = p_quote_id and status <> 'sold';
  return jsonb_build_object('success', true);
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('create_quote', 'set_quote_status', 'link_quote_sale')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- নমুনা রেট (শুধু টেবিল ফাঁকা থাকলে) — অ্যাপ থেকে আপনার আসল রেট বসিয়ে নিন
insert into price_rules (name, category, unit, rate, min_charge, tiers, note, sort_order)
select * from (values
  ('ফ্লেক্স ব্যানার', 'ব্যানার', 'sqft', 12::numeric, 150::numeric, '[]'::jsonb, 'নমুনা রেট — আপনার রেট বসান', 1),
  ('ভিজিটিং কার্ড', 'কার্ড', 'piece', 3.5::numeric, 100::numeric, '[{"min_qty":200,"rate":3},{"min_qty":500,"rate":2.5}]'::jsonb, 'নমুনা রেট — আপনার রেট বসান', 2),
  ('ফটোকপি', 'কপি', 'page', 2::numeric, 0::numeric, '[{"min_qty":100,"rate":1.5}]'::jsonb, 'নমুনা রেট — আপনার রেট বসান', 3),
  ('কালার প্রিন্ট (A4)', 'প্রিন্ট', 'page', 15::numeric, 0::numeric, '[{"min_qty":50,"rate":12}]'::jsonb, 'নমুনা রেট — আপনার রেট বসান', 4),
  ('ল্যামিনেশন', 'ফিনিশিং', 'piece', 20::numeric, 0::numeric, '[]'::jsonb, 'নমুনা রেট — আপনার রেট বসান', 5)
) v(name, category, unit, rate, min_charge, tiers, note, sort_order)
where not exists (select 1 from price_rules);

-- যাচাই
select (select count(*) from price_rules) as price_rules,
       (select count(*) from quotes) as quotes,
       (select count(*) from pg_policies where schemaname = 'public' and tablename in ('price_rules', 'quotes', 'quote_items')) as policies;
