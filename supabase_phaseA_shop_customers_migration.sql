-- ============================================================
-- ফেজ A — Unified Customer System (ফোন নম্বর-ভিত্তিক কেন্দ্রীয় কাস্টমার)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- একাধিকবার রান করলেও সমস্যা নেই (idempotent)। কোনো পুরনো টেবিল/ডেটা মোছে না।
--
-- কী তৈরি হবে:
--   ১) normalize_phone()     — +880 / 880 / স্পেস সরিয়ে 01XXXXXXXXX ফরম্যাট
--   ২) shop_customers        — কেন্দ্রীয় কাস্টমার টেবিল (ফোন unique, কোড NP-0001...)
--   ৩) orders / pos_sales    — নতুন কলাম shop_customer_id (পুরনো orders.customer_id অক্ষত)
--   ৪) অটো-লিংক ট্রিগার      — নতুন অর্ডার/POS বিক্রিতে ফোন ধরে কাস্টমার অটো তৈরি/লিংক
--   ৫) পুরনো ডেটার backfill   — আগের সব অর্ডার ও POS বিক্রি থেকে কাস্টমার তৈরি
--   ৬) shop_customer_summary — কাস্টমার-ভিত্তিক হিসাব (view)
--   ৭) get_shop_customer_history() — একজন কাস্টমারের অর্ডার + POS ইতিহাস
-- ============================================================

-- ১) ফোন নম্বর স্বাভাবিক করার ফাংশন
create or replace function normalize_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(
    case
      when s.x ~ '^8801[0-9]{9}$' then substr(s.x, 3)
      when s.x ~ '^1[0-9]{9}$' then '0' || s.x
      else s.x
    end, '')
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as x) s;
$$;

grant execute on function normalize_phone(text) to anon, authenticated;

-- হেল্পার: লগইন-করা ইউজার কি দোকানের স্টাফ (admin/staff/counter_operator)?
create or replace function is_shop_staff(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = uid and role in ('admin', 'staff', 'counter_operator')
  );
$$;

grant execute on function is_shop_staff(uuid) to authenticated;

-- ২) shop_customers টেবিল
create sequence if not exists shop_customer_code_seq;

create table if not exists shop_customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique not null
    default ('NP-' || lpad(nextval('shop_customer_code_seq')::text, 4, '0')),
  name text not null,
  phone text not null,
  address text,
  customer_type text not null default 'regular'
    check (customer_type in ('regular', 'vip', 'student', 'business')),
  auth_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shop_customers_phone_uidx on shop_customers (phone);
create index if not exists shop_customers_name_idx on shop_customers (lower(name));

-- ফোন সবসময় স্বাভাবিক ফরম্যাটে সেভ হবে
create or replace function shop_customers_before_write()
returns trigger
language plpgsql
as $$
begin
  new.phone := normalize_phone(new.phone);
  if new.phone is null or length(new.phone) < 10 then
    raise exception 'সঠিক মোবাইল নম্বর দিন';
  end if;
  new.name := coalesce(nullif(trim(new.name), ''), 'নামহীন');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_shop_customers_before_write on shop_customers;
create trigger trg_shop_customers_before_write
  before insert or update on shop_customers
  for each row execute function shop_customers_before_write();

alter table shop_customers enable row level security;

drop policy if exists "Shop staff can view shop customers" on shop_customers;
create policy "Shop staff can view shop customers" on shop_customers
  for select using (is_shop_staff(auth.uid()));

drop policy if exists "Shop staff can insert shop customers" on shop_customers;
create policy "Shop staff can insert shop customers" on shop_customers
  for insert with check (is_shop_staff(auth.uid()));

drop policy if exists "Shop staff can update shop customers" on shop_customers;
create policy "Shop staff can update shop customers" on shop_customers
  for update using (is_shop_staff(auth.uid()));

drop policy if exists "Admins can delete shop customers" on shop_customers;
create policy "Admins can delete shop customers" on shop_customers
  for delete using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ৩) লিংক কলাম (পুরনো orders.customer_id অন্য কাজে ব্যবহৃত, তাই নতুন নাম)
alter table orders add column if not exists shop_customer_id uuid references shop_customers(id) on delete set null;
alter table pos_sales add column if not exists shop_customer_id uuid references shop_customers(id) on delete set null;

create index if not exists orders_shop_customer_idx on orders (shop_customer_id);
create index if not exists pos_sales_shop_customer_idx on pos_sales (shop_customer_id);

-- ৪) অটো-লিংক ট্রিগার — গেস্ট অর্ডারেও কাজ করে (SECURITY DEFINER), কখনো অর্ডার আটকাবে না
create or replace function link_shop_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id uuid;
begin
  if new.shop_customer_id is not null then
    return new;
  end if;

  v_phone := normalize_phone(new.customer_phone);
  if v_phone is null or length(v_phone) < 10 then
    return new;
  end if;

  begin
    insert into shop_customers (name, phone)
    values (coalesce(nullif(trim(new.customer_name), ''), 'নামহীন'), v_phone)
    on conflict (phone) do nothing;

    select id into v_id from shop_customers where phone = v_phone;
    new.shop_customer_id := v_id;
  exception when others then
    -- কোনো কারণে ব্যর্থ হলেও অর্ডার/বিক্রি যেন সেভ হয়
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_orders_link_shop_customer on orders;
create trigger trg_orders_link_shop_customer
  before insert on orders
  for each row execute function link_shop_customer();

drop trigger if exists trg_pos_sales_link_shop_customer on pos_sales;
create trigger trg_pos_sales_link_shop_customer
  before insert on pos_sales
  for each row execute function link_shop_customer();

-- ৫) পুরনো ডেটা থেকে কাস্টমার তৈরি (backfill) — একই ফোন একবারই, সর্বশেষ নামটি রাখা হয়
insert into shop_customers (name, phone, created_at)
select distinct on (t.p)
  coalesce(t.n, 'নামহীন'), t.p, t.at
from (
  select normalize_phone(customer_phone) as p, nullif(trim(customer_name), '') as n, created_at as at from orders
  union all
  select normalize_phone(customer_phone), nullif(trim(customer_name), ''), created_at from pos_sales
) t
where t.p is not null and length(t.p) >= 10
order by t.p, (t.n is null), t.at desc
on conflict (phone) do nothing;

update orders o
set shop_customer_id = sc.id
from shop_customers sc
where o.shop_customer_id is null
  and normalize_phone(o.customer_phone) = sc.phone;

update pos_sales s
set shop_customer_id = sc.id
from shop_customers sc
where s.shop_customer_id is null
  and normalize_phone(s.customer_phone) = sc.phone;

-- ৬) কাস্টমার সামারি view (RLS কলারের ক্ষমতা অনুযায়ী প্রযোজ্য)
-- মোট খরচ = বাতিল/প্রত্যাখ্যাত/ফেরত বাদে অর্ডারের মোট + সম্পন্ন POS বিক্রির মোট
-- total_due এখন ০ — ফেজ B/C-তে Due চালু হলে এই view আপডেট হবে
create or replace view shop_customer_summary
with (security_invoker = true) as
select
  sc.id,
  sc.customer_code,
  sc.name,
  sc.phone,
  sc.address,
  sc.customer_type,
  sc.created_at,
  coalesce(o.cnt, 0)::int as total_orders,
  coalesce(p.cnt, 0)::int as total_pos_sales,
  (coalesce(o.cnt, 0) + coalesce(p.cnt, 0))::int as total_transactions,
  coalesce(v.visits, 0)::int as total_visits,
  (coalesce(o.spent, 0) + coalesce(p.spent, 0))::numeric as total_spent,
  0::numeric as total_due,
  greatest(o.last_at, p.last_at) as last_activity_at
from shop_customers sc
left join lateral (
  select count(*) as cnt,
         coalesce(sum(total_amount) filter (
           where status not in ('cancelled', 'rejected') and payment_status <> 'refunded'
         ), 0) as spent,
         max(created_at) as last_at
  from orders where shop_customer_id = sc.id
) o on true
left join lateral (
  select count(*) as cnt,
         coalesce(sum(total_amount) filter (where status = 'completed'), 0) as spent,
         max(created_at) as last_at
  from pos_sales where shop_customer_id = sc.id
) p on true
left join lateral (
  select count(distinct d) as visits from (
    select (created_at at time zone 'Asia/Dhaka')::date as d from orders where shop_customer_id = sc.id
    union all
    select (created_at at time zone 'Asia/Dhaka')::date from pos_sales where shop_customer_id = sc.id
  ) x
) v on true;

grant select on shop_customer_summary to authenticated;

-- ৭) একজন কাস্টমারের ইতিহাস (অর্ডার + POS একসাথে, নতুন থেকে পুরনো)
create or replace function get_shop_customer_history(p_customer_id uuid)
returns table (
  source text,
  ref_no text,
  title text,
  amount numeric,
  status text,
  created_at timestamptz
)
language sql
stable
as $$
  select 'order'::text, o.tracking_id::text, coalesce(s.name, 'অর্ডার')::text,
         o.total_amount::numeric, o.status::text, o.created_at
  from orders o
  left join services s on s.id = o.service_id
  where o.shop_customer_id = p_customer_id
  union all
  select 'pos'::text, ps.sale_number::text,
         coalesce((select string_agg(i.item_name, ', ') from pos_sale_items i where i.sale_id = ps.id), 'POS বিক্রি')::text,
         ps.total_amount::numeric, ps.status::text, ps.created_at
  from pos_sales ps
  where ps.shop_customer_id = p_customer_id
  order by created_at desc
  limit 200;
$$;

grant execute on function get_shop_customer_history(uuid) to authenticated;

-- যাচাই: কতজন কাস্টমার তৈরি হলো এবং কয়টি অর্ডার/বিক্রি লিংক হয়নি (ফোন ছোট/ফাঁকা থাকলে)
select
  (select count(*) from shop_customers) as total_customers,
  (select count(*) from orders where shop_customer_id is null) as unlinked_orders,
  (select count(*) from pos_sales where shop_customer_id is null) as unlinked_pos_sales;
