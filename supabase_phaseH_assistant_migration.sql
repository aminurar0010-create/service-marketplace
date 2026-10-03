-- ============================================================
-- ফেজ H — AI সহকারীর নিরাপদ ডাটা-স্তর (Safe Query Layer), অ্যালার্ট, POS ফেরত ও সিস্টেম হেলথ চেক
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- ⚠️ আগে ফেজ A–G-র SQL রান করা থাকতে হবে। একাধিকবার রান করলেও সমস্যা নেই।
--
-- নিয়ম: সহকারী কখনো নিজে SQL চালায় না — শুধু নিচের "ai_*" ফাংশনগুলো ডাকে।
--   • সবগুলো শুধু পড়ে (কিছু বদলায় না), শুধু লগইন-করা ইউজার ডাকতে পারে (anon নয়)
--   • রোল-চেক ভেতরেই: ai_today_alerts → অ্যাডমিন + কাউন্টার অপারেটর; বাকিগুলো → শুধু অ্যাডমিন
--
-- এছাড়া:
--   • refund_pos_sale() — POS বিক্রি ফেরত (স্টক ফেরত, ক্যাশ-বুকে ফেরত-ব্যয়, বকেয়া বাদ) — আগে এই ধাপটাই ছিল না
--   • workflow_health() — বিক্রি → পেমেন্ট → ক্যাশ-বুক → কাস্টমার চেইনের গরমিল ধরার যাচাই
-- ============================================================

-- সাহায্যকারী: ঢাকা সময়ে তারিখ-সীমা
create or replace function _h_start(p_d date) returns timestamptz language sql immutable as $$
  select (p_d::timestamp at time zone 'Asia/Dhaka')
$$;
create or replace function _h_end(p_d date) returns timestamptz language sql immutable as $$
  select ((p_d + 1)::timestamp at time zone 'Asia/Dhaka')
$$;

-- ১) বিক্রি/আয়-ব্যয়ের সারাংশ
create or replace function ai_sales_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pos_total numeric; v_pos_count int; v_pos_due numeric;
  v_on_total numeric; v_on_count int;
  v_income numeric; v_expense numeric; v_collected numeric;
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'এই তথ্য শুধু অ্যাডমিন দেখতে পারেন');
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    return jsonb_build_object('error', 'তারিখ সঠিক নয়');
  end if;

  select coalesce(sum(total_amount), 0), count(*), coalesce(sum(due_amount), 0)
    into v_pos_total, v_pos_count, v_pos_due
    from pos_sales
   where status = 'completed' and created_at >= _h_start(p_from) and created_at < _h_end(p_to);

  select coalesce(sum(total_amount), 0), count(*)
    into v_on_total, v_on_count
    from orders
   where status not in ('cancelled', 'rejected') and payment_status <> 'refunded'
     and created_at >= _h_start(p_from) and created_at < _h_end(p_to);

  select coalesce(sum(amount) filter (where type = 'income'), 0),
         coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_income, v_expense
    from cash_transactions where entry_date between p_from and p_to;

  select coalesce(sum(amount), 0) into v_collected
    from sale_payments
   where kind = 'due_collection' and created_at >= _h_start(p_from) and created_at < _h_end(p_to);

  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'pos_total', v_pos_total, 'pos_count', v_pos_count, 'pos_due', v_pos_due,
    'online_total', v_on_total, 'online_count', v_on_count,
    'income', v_income, 'expense', v_expense, 'net', v_income - v_expense,
    'due_collected', v_collected
  );
end;
$$;

-- ২) সেরা সার্ভিস/পণ্য (POS + অনলাইন)
create or replace function ai_top_services(p_from date, p_to date, p_limit int default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'এই তথ্য শুধু অ্যাডমিন দেখতে পারেন');
  end if;
  return jsonb_build_object('from', p_from, 'to', p_to, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) order by revenue desc)
    from (
      select name, sum(qty) as qty, sum(revenue) as revenue
      from (
        select i.item_name as name, i.quantity as qty, i.line_total as revenue
          from pos_sale_items i join pos_sales s on s.id = i.sale_id
         where s.status = 'completed' and s.created_at >= _h_start(p_from) and s.created_at < _h_end(p_to)
        union all
        select coalesce(sv.name, 'অজানা সার্ভিস'), 1, o.total_amount
          from orders o left join services sv on sv.id = o.service_id
         where o.status not in ('cancelled', 'rejected') and o.payment_status <> 'refunded'
           and o.created_at >= _h_start(p_from) and o.created_at < _h_end(p_to)
      ) u
      group by name
      order by sum(revenue) desc
      limit greatest(1, least(coalesce(p_limit, 5), 20))
    ) t
  ), '[]'::jsonb));
end;
$$;

-- ৩) কাস্টমারের খরচ (নাম দিয়ে খোঁজা; সর্বোচ্চ ৫ জন)
create or replace function ai_customer_spend(p_name text, p_from date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_like text;
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'এই তথ্য শুধু অ্যাডমিন দেখতে পারেন');
  end if;
  v_like := '%' || replace(replace(replace(trim(coalesce(p_name, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  if length(trim(coalesce(p_name, ''))) < 2 then
    return jsonb_build_object('error', 'নাম আরেকটু স্পষ্ট করে লিখুন');
  end if;

  return jsonb_build_object('from', p_from, 'customers', coalesce((
    select jsonb_agg(row_to_json(x)::jsonb) from (
      select
        sc.name, sc.phone, sc.customer_code,
        coalesce((select sum(total_amount) from pos_sales s
                   where s.shop_customer_id = sc.id and s.status = 'completed' and s.created_at >= _h_start(p_from)), 0) as pos_total,
        coalesce((select count(*) from pos_sales s
                   where s.shop_customer_id = sc.id and s.status = 'completed' and s.created_at >= _h_start(p_from)), 0) as pos_visits,
        coalesce((select sum(total_amount) from orders o
                   where o.shop_customer_id = sc.id and o.status not in ('cancelled', 'rejected')
                     and o.payment_status <> 'refunded' and o.created_at >= _h_start(p_from)), 0) as online_total,
        coalesce((select sum(due_amount) from pos_sales s
                   where s.shop_customer_id = sc.id and s.status = 'completed'), 0) as due_now
      from shop_customers sc
      where sc.name ilike v_like
      order by sc.created_at desc
      limit 5
    ) x
  ), '[]'::jsonb));
end;
$$;

-- ৪) বকেয়া কাস্টমার (POS) ও স্টুডেন্টের কোর্স-ফি বকেয়া
create or replace function ai_due_customers(p_limit int default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'এই তথ্য শুধু অ্যাডমিন দেখতে পারেন');
  end if;
  return jsonb_build_object(
    'total_due', coalesce((select sum(total_due) from customer_dues), 0),
    'count', (select count(*) from customer_dues),
    'new_due_today', coalesce((select sum(due_amount) from pos_sales
                                where status = 'completed' and created_at >= _h_start((now() at time zone 'Asia/Dhaka')::date)), 0),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'phone', phone, 'total_due', total_due, 'oldest_due_at', oldest_due_at)
                       order by total_due desc)
      from (select * from customer_dues order by total_due desc limit greatest(1, least(coalesce(p_limit, 8), 30))) d
    ), '[]'::jsonb),
    'student_due_total', coalesce((select sum(due) from student_overview where due > 0), 0),
    'student_due_count', (select count(*) from student_overview where due > 0)
  );
end;
$$;

-- ৫) কম স্টকের পণ্য
create or replace function ai_low_stock(p_limit int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'এই তথ্য শুধু অ্যাডমিন দেখতে পারেন');
  end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object('name', name, 'unit', unit, 'quantity', quantity, 'threshold', low_stock_threshold)
                     order by (quantity - low_stock_threshold))
    from (
      select * from inventory_items
       where is_active and quantity <= low_stock_threshold
       order by (quantity - low_stock_threshold)
       limit greatest(1, least(coalesce(p_limit, 10), 50))
    ) i
  ), '[]'::jsonb));
end;
$$;

-- ৬) "আজকের কাজ"-এর অ্যালার্ট (কাউন্টার অপারেটরও দেখতে পারে)
create or replace function ai_today_alerts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (is_admin(auth.uid()) or is_counter_operator(auth.uid())) then
    return jsonb_build_object('error', 'অনুমতি নেই');
  end if;
  return jsonb_build_object(
    'low_stock_count', (select count(*) from inventory_items where is_active and quantity <= low_stock_threshold and quantity > 0),
    'out_of_stock_count', (select count(*) from inventory_items where is_active and quantity <= 0),
    'due_customers', (select count(*) from customer_dues),
    'due_total', coalesce((select sum(total_due) from customer_dues), 0),
    'old_due_count', (select count(*) from customer_dues where oldest_due_at < now() - interval '30 days'),
    'old_due_total', coalesce((select sum(total_due) from customer_dues where oldest_due_at < now() - interval '30 days'), 0)
  );
end;
$$;

-- ৭) POS ফেরত
alter table cash_transactions drop constraint if exists cash_transactions_source_chk;
alter table cash_transactions add constraint cash_transactions_source_chk
  check (source in ('manual', 'pos', 'due_collection', 'online_order', 'course_fee', 'pos_refund'));

create or replace function refund_pos_sale(p_sale_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale pos_sales;
  v_item record;
  v_pay record;
  v_total numeric := 0;
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('success', false, 'message', 'শুধু অ্যাডমিন ফেরত দিতে পারেন');
  end if;

  select * into v_sale from pos_sales where id = p_sale_id for update;
  if v_sale.id is null then
    return jsonb_build_object('success', false, 'message', 'বিক্রি খুঁজে পাওয়া যায়নি');
  end if;
  if v_sale.status <> 'completed' then
    return jsonb_build_object('success', false, 'message', 'এই বিক্রি আগেই ফেরত হয়েছে');
  end if;

  update pos_sales set status = 'refunded' where id = p_sale_id;

  -- স্টক ফেরত
  for v_item in
    select item_ref_id, quantity from pos_sale_items
     where sale_id = p_sale_id and item_type = 'inventory' and item_ref_id is not null
  loop
    update inventory_items set quantity = quantity + v_item.quantity, updated_at = now() where id = v_item.item_ref_id;
    insert into stock_movements (item_id, movement_type, quantity, reason, reference_type, reference_id, created_by)
    values (v_item.item_ref_id, 'in', v_item.quantity, 'POS ফেরত (' || coalesce(v_sale.invoice_no, v_sale.sale_number) || ')', 'pos_refund', p_sale_id, auth.uid());
  end loop;

  -- যত টাকা আসলে নেওয়া হয়েছিল (বিক্রির সময় + পরে বাকি আদায়) মাধ্যম ধরে ফেরত-ব্যয়
  for v_pay in
    select method, sum(amount) as amt from sale_payments where sale_id = p_sale_id group by method having sum(amount) > 0
  loop
    insert into cash_transactions (entry_date, type, category, description, amount, payment_method, source, created_by)
    values (
      (now() at time zone 'Asia/Dhaka')::date, 'expense', 'POS ফেরত',
      'ইনভয়েস ' || coalesce(v_sale.invoice_no, v_sale.sale_number) || ' ফেরত' || coalesce(' — ' || nullif(trim(p_reason), ''), ''),
      v_pay.amt, v_pay.method, 'pos_refund', auth.uid()
    );
    v_total := v_total + v_pay.amt;
  end loop;

  return jsonb_build_object('success', true, 'refunded', v_total, 'invoice_no', coalesce(v_sale.invoice_no, v_sale.sale_number));
end;
$$;

-- ৮) সিস্টেম হেলথ চেক — পুরো চেইনের গরমিল ধরা (শুধু পড়ে)
create or replace function workflow_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_checks jsonb := '[]'::jsonb;
  v_n numeric;
  v_n2 numeric;
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'শুধু অ্যাডমিন');
  end if;

  -- ক) মোট = জমা + বাকি
  select count(*) into v_n from pos_sales
   where status = 'completed' and abs(total_amount - (coalesce(paid_amount, total_amount) + coalesce(due_amount, 0))) > 0.01;
  v_checks := v_checks || jsonb_build_object('key', 'sale_math', 'label', 'বিক্রির মোট ≠ জমা + বাকি', 'count', v_n, 'hint', 'ইনভয়েসের হিসাবে গরমিল — সংশ্লিষ্ট ইনভয়েস দেখুন');

  -- খ) জমা = পেমেন্ট রেকর্ডের যোগফল
  select count(*) into v_n from pos_sales s
   where s.status = 'completed' and s.paid_amount is not null
     and abs(s.paid_amount - coalesce((select sum(amount) from sale_payments p where p.sale_id = s.id), 0)) > 0.01;
  v_checks := v_checks || jsonb_build_object('key', 'payments_match', 'label', 'বিক্রির জমা ≠ পেমেন্ট রেকর্ড', 'count', v_n, 'hint', 'পুরনো (ফেজ B-র আগের) বিক্রিতে স্বাভাবিক হতে পারে');

  -- গ) প্রতিদিনের POS পেমেন্ট ≈ ক্যাশ-বুকের POS আয়
  select count(*) into v_n from (
    select d, coalesce(a.amt, 0) as pay_amt, coalesce(b.amt, 0) as cash_amt
      from (select distinct (s.created_at at time zone 'Asia/Dhaka')::date as d from pos_sales s where s.paid_amount is not null) days
      left join lateral (select sum(p.amount) as amt from sale_payments p join pos_sales s on s.id = p.sale_id
                          where p.kind = 'sale' and (s.created_at at time zone 'Asia/Dhaka')::date = days.d) a on true
      left join lateral (select sum(c.amount) as amt from cash_transactions c where c.source = 'pos' and c.entry_date = days.d) b on true
  ) x where abs(pay_amt - cash_amt) > 0.5;
  v_checks := v_checks || jsonb_build_object('key', 'pos_cashbook', 'label', 'POS পেমেন্ট ≠ ক্যাশ-বুক (দিনের হিসাবে)', 'count', v_n, 'hint', 'ক্যাশ-বুক থেকে POS এন্ট্রি মুছে থাকলে বা বদলালে এটা আসে');

  -- ঘ) বাকি আদায় ↔ ক্যাশ-বুক
  select coalesce(sum(amount), 0) into v_n from sale_payments where kind = 'due_collection';
  select coalesce(sum(amount), 0) into v_n2 from cash_transactions where source = 'due_collection';
  v_checks := v_checks || jsonb_build_object('key', 'due_cashbook', 'label', 'বাকি আদায় ≠ ক্যাশ-বুক', 'count', case when abs(v_n - v_n2) > 0.5 then 1 else 0 end,
    'hint', format('আদায় ৳%s বনাম ক্যাশ-বুক ৳%s', v_n, v_n2));

  -- ঙ) অনলাইন অর্ডার paid কিন্তু ক্যাশ-বুকে নেই
  select count(*) into v_n from orders o
   where o.payment_status = 'paid' and coalesce(o.total_amount, 0) > 0
     and not exists (select 1 from cash_transactions c where c.order_id = o.id and c.type = 'income');
  v_checks := v_checks || jsonb_build_object('key', 'online_cashbook', 'label', 'পেইড অনলাইন অর্ডার ক্যাশ-বুকে নেই', 'count', v_n, 'hint', 'ফেজ C-র আগের অর্ডার হতে পারে — ব্যাকফিল করা হয়নি');

  -- চ) কোর্স ফি ↔ ক্যাশ-বুক
  select coalesce(sum(amount), 0) into v_n from student_payments;
  select coalesce(sum(amount), 0) into v_n2 from cash_transactions where source = 'course_fee';
  v_checks := v_checks || jsonb_build_object('key', 'course_cashbook', 'label', 'কোর্স ফি ≠ ক্যাশ-বুক', 'count', case when abs(v_n - v_n2) > 0.5 then 1 else 0 end,
    'hint', format('আদায় ৳%s বনাম ক্যাশ-বুক ৳%s', v_n, v_n2));

  -- ছ) কাস্টমারের সাথে লিংকহীন বিক্রি/অর্ডার (ফোন থাকলেও)
  select (select count(*) from orders where shop_customer_id is null and length(coalesce(normalize_phone(customer_phone), '')) >= 10)
       + (select count(*) from pos_sales where shop_customer_id is null and length(coalesce(normalize_phone(customer_phone), '')) >= 10)
    into v_n;
  v_checks := v_checks || jsonb_build_object('key', 'unlinked', 'label', 'কাস্টমারের সাথে লিংকহীন অর্ডার/বিক্রি', 'count', v_n, 'hint', 'ফেজ E-র SQL আবার রান করলে ঠিক হয়');

  -- জ) ঋণাত্মক স্টক
  select count(*) into v_n from inventory_items where quantity < 0;
  v_checks := v_checks || jsonb_build_object('key', 'negative_stock', 'label', 'ঋণাত্মক স্টক', 'count', v_n, 'hint', 'ইনভেন্টরিতে স্টক ঠিক করুন (adjustment)');

  -- ঝ) মাধ্যমহীন আয় (গত ৩০ দিন) — দৈনিক মাধ্যমভিত্তিক হিসাবে "অনির্দিষ্ট"-এ যায়
  select count(*) into v_n from cash_transactions
   where type = 'income' and payment_method is null and entry_date >= (now() at time zone 'Asia/Dhaka')::date - 30;
  v_checks := v_checks || jsonb_build_object('key', 'no_method', 'label', 'পেমেন্ট মাধ্যমহীন আয় (গত ৩০ দিন)', 'count', v_n, 'hint', 'তথ্যমূলক — নতুন এন্ট্রিতে মাধ্যম বাছুন');

  return jsonb_build_object('checks', v_checks);
end;
$$;

-- অনুমতি: শুধু লগইন-করা ইউজার (anon নয়); আসল রোল-চেক ফাংশনের ভেতরে
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any (array['ai_sales_summary','ai_top_services','ai_customer_spend','ai_due_customers',
                                  'ai_low_stock','ai_today_alerts','refund_pos_sale','workflow_health'])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- যাচাই: আজকের সারাংশ (SQL Editor-এ auth নেই বলে "শুধু অ্যাডমিন" এলেও ফাংশন তৈরি হয়েছে — অ্যাপ থেকে চেক করুন)
select p.proname as function_name, has_function_privilege('anon', p.oid, 'execute') as anon_can_run
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('ai_sales_summary','ai_top_services','ai_customer_spend','ai_due_customers','ai_low_stock','ai_today_alerts','refund_pos_sale','workflow_health')
 order by 1;
