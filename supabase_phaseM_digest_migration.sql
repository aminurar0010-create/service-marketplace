-- ============================================================
-- ফেজ M — মালিকের Telegram বট: রাতের সারাংশ ও প্রশ্ন-উত্তরের ডাটা-স্তর
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন। একাধিকবার রান করলেও সমস্যা নেই।
-- ⚠️ আগে ফেজ A–K-র SQL রান করা থাকতে হবে (বিশেষ করে H ও J)।
--
-- নকশা (service-role কী ছাড়া):
--   • Vercel সার্ভার-ফাংশন শুধু anon কী + একটা গোপন কোড (OWNER_BOT_DB_SECRET) দিয়ে নিচের দুটো ফাংশন ডাকে।
--   • ডাটাবেসে কোডটার শুধু SHA-256 hash থাকে (owner_bot_config টেবিলে; কেউ পড়তে পারে না)।
--   • কোড মিললে ভেতরের সাময়িক (শুধু এই লেনদেনে) একজন অ্যাডমিন সেজে ফেজ H-এর ai_* ফাংশন ডাকে —
--     তাই সংখ্যা ড্যাশবোর্ড/AI সহকারীর সাথে হুবহু একই হিসাবে মেলে, নতুন করে হিসাব লেখা হয়নি।
--   • সবই শুধু পড়ে — কিছু বদলায় না। কোড ফাঁস হলেও ঝুঁকি = সারাংশ পড়া; (service-role কী ফাঁসের চেয়ে বহু কম)।
-- ============================================================

-- ১) গোপন কোডের hash রাখার টেবিল (RLS চালু, কোনো policy নেই = কেউ পড়তে/লিখতে পারে না; শুধু নিচের ফাংশনগুলো পারে)
create table if not exists owner_bot_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table owner_bot_config enable row level security;
revoke all on owner_bot_config from anon, authenticated;

-- ২) অভ্যন্তরীণ পাহারাদার: কোড যাচাই + এই লেনদেনের জন্য একজন অ্যাডমিন সাজা
create or replace function _owner_bot_guard(p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_admin uuid;
begin
  select value into v_hash from owner_bot_config where key = 'digest_secret_hash';
  if v_hash is null
     or p_secret is null
     or length(p_secret) < 24
     or encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') <> v_hash then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select p.id into v_admin from profiles p where is_admin(p.id) order by p.id limit 1;
  if v_admin is null then
    raise exception 'no admin';
  end if;
  -- শুধু এই লেনদেনে auth.uid() = ওই অ্যাডমিন (is_local = true)
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
end;
$$;
revoke execute on function _owner_bot_guard(text) from public, anon, authenticated;

-- ৩) মাধ্যমভিত্তিক আয় (ক্যাশ-বুক/স্বাস্থ্য-পরীক্ষার নিয়মেই): POS = sale_payments, বাকি আয় = হাতে-লেখা/অন্য উৎস
create or replace function _owner_methods(p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(method, amt), '{}'::jsonb) from (
    select method, sum(amt) as amt from (
      select p.method::text as method, p.amount as amt
        from sale_payments p join pos_sales s on s.id = p.sale_id
       where p.kind = 'sale'
         and (s.created_at at time zone 'Asia/Dhaka')::date between p_from and p_to
      union all
      select coalesce(c.payment_method, 'unspecified'), c.amount
        from cash_transactions c
       where c.type = 'income' and c.source <> 'pos'
         and c.entry_date between p_from and p_to
    ) x
    group by method
  ) y
$$;
revoke execute on function _owner_methods(date, date) from public, anon, authenticated;

-- ৪) নির্দিষ্ট দিনের যাত্রার টিকিট (ফেজ J) + অপেক্ষমাণ অনুরোধ
create or replace function _owner_tickets(p_day date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'date', p_day,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'type', ticket_type, 'from', from_place, 'to', to_place, 'time', travel_time,
               'status', status, 'name', customer_name, 'count', passenger_count)
             order by travel_time nulls last)
        from (
          select * from ticket_requests
           where travel_date = p_day and status in ('requested', 'booked')
           order by travel_time nulls last
           limit 15
        ) t
    ), '[]'::jsonb),
    'pending', (select count(*) from ticket_requests where status = 'requested')
  )
$$;
revoke execute on function _owner_tickets(date) from public, anon, authenticated;

-- ৫) রাতের পূর্ণ সারাংশ (এক ডাকে সব)
create or replace function owner_digest(p_secret text, p_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := coalesce(p_date, (now() at time zone 'Asia/Dhaka')::date);
begin
  perform _owner_bot_guard(p_secret);
  return jsonb_build_object(
    'date', d,
    'sales', ai_sales_summary(d, d),
    'methods', _owner_methods(d, d),
    'top', ai_top_services(d, d, 3),
    'dues', ai_due_customers(5),
    'stock', ai_low_stock(8),
    'alerts', ai_today_alerts(),
    'tickets', _owner_tickets(d + 1),
    'health', workflow_health()
  );
end;
$$;

-- ৬) বটের প্রশ্নের ডাটা: kind = sales | top | due | stock | tickets | health
create or replace function owner_query(p_secret text, p_kind text, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t date := (now() at time zone 'Asia/Dhaka')::date;
  f date;
  e date;
begin
  perform _owner_bot_guard(p_secret);
  f := coalesce(p_from, t);
  e := coalesce(p_to, f);
  if e < f or e - f > 400 then
    return jsonb_build_object('error', 'তারিখ সঠিক নয়');
  end if;

  if p_kind = 'sales' then
    return ai_sales_summary(f, e) || jsonb_build_object('methods', _owner_methods(f, e));
  elsif p_kind = 'top' then
    return ai_top_services(f, e, 8);
  elsif p_kind = 'due' then
    return ai_due_customers(10) || jsonb_build_object('alerts', ai_today_alerts());
  elsif p_kind = 'stock' then
    return ai_low_stock(15) || jsonb_build_object('alerts', ai_today_alerts());
  elsif p_kind = 'tickets' then
    return _owner_tickets(f + 1);
  elsif p_kind = 'health' then
    return workflow_health();
  end if;
  return jsonb_build_object('error', 'অচেনা প্রশ্ন');
end;
$$;

-- শুধু এই দুটো বাইরে থেকে ডাকা যায় (গোপন কোড ছাড়া কিছুই ফেরত দেয় না)
revoke execute on function owner_digest(text, date) from public;
revoke execute on function owner_query(text, text, date, date) from public;
grant execute on function owner_digest(text, date) to anon, authenticated;
grant execute on function owner_query(text, text, date, date) to anon, authenticated;

-- ============================================================
-- ৭) গোপন কোড বসানো — এই অংশটা আলাদাভাবে, নিজের কোড দিয়ে Run করুন (এই ফাইলে রান হয় না)
--
-- কোড বানান: কমপক্ষে ২৪ অক্ষর, র‍্যান্ডম (যেমন পাসওয়ার্ড-জেনারেটর বা `openssl rand -hex 24`)।
-- একই কোড Vercel env-এ OWNER_BOT_DB_SECRET নামে বসাবেন। কোড চ্যাটে পাঠাবেন না।
--
--   insert into owner_bot_config (key, value)
--   values ('digest_secret_hash', encode(sha256(convert_to('এখানে-আপনার-গোপন-কোড', 'UTF8')), 'hex'))
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- কোড বদলাতে/বন্ধ করতে: একই স্টেটমেন্ট নতুন কোড দিয়ে, অথবা  delete from owner_bot_config;  (সব বন্ধ হয়ে যাবে)
-- ============================================================
