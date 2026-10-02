-- ============================================================
-- ফেজ B — Counter Sales v2 (Due/আংশিক পেমেন্ট, একাধিক পেমেন্ট মেথড, Invoice No.)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- ⚠️ আগে ফেজ A-এর SQL (supabase_phaseA_shop_customers_migration.sql) রান করা থাকতে হবে।
-- একাধিকবার রান করলেও সমস্যা নেই। পুরনো create_pos_sale() ফাংশন অক্ষত থাকে
-- (নতুন ফাংশনের নাম create_pos_sale_v2) — তাই SQL রান ও সাইট ডিপ্লয়ের মাঝখানে POS বন্ধ হবে না।
--
-- কী হবে:
--   ১) pos_sales-এ নতুন কলাম: invoice_no (INV-000001...), paid_amount, due_amount
--      পুরনো সব বিক্রি = "সম্পূর্ণ পরিশোধিত" ধরা হবে এবং তাদের ইনভয়েস নম্বর বসবে
--   ২) sale_payments — একটি বিক্রিতে একাধিক মেথডে (নগদ/বিকাশ/নগদ/রকেট/অন্যান্য) পেমেন্ট
--   ৩) create_pos_sale_v2() — কাস্টমার + Due + একাধিক পেমেন্ট; ক্যাশ-বুকে শুধু পেইড অংশ আয় হয়
--   ৪) shop_customer_summary view-তে total_due এখন সত্যিকারের বকেয়া
-- ============================================================

-- ১) ইনভয়েস সিরিজ ও পেইড/ডিউ কলাম
create sequence if not exists pos_invoice_seq;

alter table pos_sales
  add column if not exists invoice_no text unique
  default ('INV-' || lpad(nextval('pos_invoice_seq')::text, 6, '0'));

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pos_sales' and column_name = 'paid_amount'
  ) then
    alter table pos_sales
      add column paid_amount numeric(10,2) not null default 0,
      add column due_amount numeric(10,2) not null default 0;
    -- শুধু প্রথমবার: পুরনো সব বিক্রি পুরো পরিশোধিত
    update pos_sales set paid_amount = total_amount, due_amount = 0;
  end if;
end $$;

create index if not exists pos_sales_due_idx on pos_sales (shop_customer_id) where due_amount > 0;

-- ২) sale_payments
create table if not exists sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id) on delete cascade,
  method text not null check (method in ('cash', 'bkash', 'nagad', 'rocket', 'other')),
  amount numeric(10,2) not null check (amount > 0),
  kind text not null default 'sale' check (kind in ('sale', 'due_collection')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sale_payments_sale_idx on sale_payments (sale_id);

alter table sale_payments enable row level security;

drop policy if exists "Shop staff can view sale payments" on sale_payments;
create policy "Shop staff can view sale payments" on sale_payments
  for select using (is_shop_staff(auth.uid()));
-- ইনসার্ট শুধু create_pos_sale_v2() (SECURITY DEFINER) দিয়ে হয়

-- পুরনো বিক্রির জন্য একটি করে পেমেন্ট রো (একবারই; যাদের নেই তাদের)
insert into sale_payments (sale_id, method, amount, kind, created_at)
select s.id,
       case when s.payment_method in ('cash', 'bkash', 'nagad', 'rocket') then s.payment_method else 'other' end,
       s.paid_amount, 'sale', s.created_at
from pos_sales s
where s.paid_amount > 0
  and not exists (select 1 from sale_payments sp where sp.sale_id = s.id);

-- ৩) create_pos_sale_v2()
create or replace function create_pos_sale_v2(
  p_items jsonb,                      -- [{item_type, item_ref_id, item_name, quantity, unit_price}]
  p_customer_id uuid default null,    -- shop_customers.id
  p_customer_name text default null,
  p_customer_phone text default null,
  p_discount_amount numeric default 0,
  p_payments jsonb default '[]'::jsonb -- [{method, amount}]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sale_id uuid;
  v_sale_number text;
  v_invoice_no text;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(coalesce(p_discount_amount, 0), 0);
  v_total numeric := 0;
  v_paid numeric := 0;
  v_due numeric := 0;
  v_item jsonb;
  v_pay jsonb;
  v_line_total numeric;
  v_current_qty numeric;
  v_name text := nullif(trim(p_customer_name), '');
  v_phone text := nullif(trim(p_customer_phone), '');
  v_main_method text;
  v_methods text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'staff') then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'কমপক্ষে একটি আইটেম যোগ করুন');
  end if;

  -- আইটেম ও স্টক যাচাই
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::numeric <= 0 or (v_item->>'unit_price')::numeric < 0 then
      return jsonb_build_object('success', false, 'message', 'আইটেমের পরিমাণ বা দাম সঠিক নয়');
    end if;
    if (v_item->>'item_type') = 'inventory' then
      select quantity into v_current_qty from inventory_items where id = (v_item->>'item_ref_id')::uuid;
      if v_current_qty is null then
        return jsonb_build_object('success', false, 'message', 'ইনভেন্টরি আইটেম খুঁজে পাওয়া যায়নি');
      end if;
      if v_current_qty < (v_item->>'quantity')::numeric then
        return jsonb_build_object('success', false, 'message',
          format('"%s" এর পর্যাপ্ত স্টক নেই (আছে: %s)', v_item->>'item_name', v_current_qty));
      end if;
    end if;
    v_subtotal := v_subtotal + ((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric);
  end loop;

  if v_discount > v_subtotal then
    return jsonb_build_object('success', false, 'message', 'ছাড় সাবটোটালের বেশি হতে পারে না');
  end if;
  v_total := v_subtotal - v_discount;

  -- পেমেন্ট যাচাই
  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    if (v_pay->>'method') not in ('cash', 'bkash', 'nagad', 'rocket', 'other') then
      return jsonb_build_object('success', false, 'message', 'পেমেন্ট মেথড সঠিক নয়');
    end if;
    if (v_pay->>'amount')::numeric < 0 then
      return jsonb_build_object('success', false, 'message', 'পেমেন্টের পরিমাণ সঠিক নয়');
    end if;
    v_paid := v_paid + (v_pay->>'amount')::numeric;
  end loop;

  if v_paid > v_total then
    return jsonb_build_object('success', false, 'message', 'পরিশোধের পরিমাণ মোট বিলের বেশি হতে পারে না');
  end if;
  v_due := v_total - v_paid;

  -- কাস্টমার
  if p_customer_id is not null then
    select name, phone into v_name, v_phone from shop_customers where id = p_customer_id;
    if v_phone is null then
      return jsonb_build_object('success', false, 'message', 'কাস্টমার খুঁজে পাওয়া যায়নি');
    end if;
  end if;

  if v_due > 0 and (p_customer_id is null and v_phone is null) then
    return jsonb_build_object('success', false, 'message', 'বাকিতে বিক্রির জন্য কাস্টমার নির্বাচন করুন');
  end if;

  -- প্রধান পেমেন্ট মেথড (পুরনো payment_method কলামের জন্য)
  select m into v_main_method from (
    select (e->>'method') as m, sum((e->>'amount')::numeric) as amt
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) e
    where (e->>'amount')::numeric > 0
    group by 1 order by 2 desc limit 1
  ) t;
  v_main_method := coalesce(v_main_method, 'due');

  insert into pos_sales (
    customer_name, customer_phone, shop_customer_id, payment_method,
    subtotal, discount_amount, total_amount, paid_amount, due_amount, created_by
  )
  values (
    v_name, v_phone, p_customer_id, v_main_method,
    v_subtotal, v_discount, v_total, v_paid, v_due, auth.uid()
  )
  returning id, sale_number, invoice_no into v_sale_id, v_sale_number, v_invoice_no;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;

    insert into pos_sale_items (sale_id, item_type, item_ref_id, item_name, quantity, unit_price, line_total)
    values (
      v_sale_id,
      v_item->>'item_type',
      nullif(v_item->>'item_ref_id', '')::uuid,
      v_item->>'item_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      v_line_total
    );

    if (v_item->>'item_type') = 'inventory' then
      update inventory_items
        set quantity = quantity - (v_item->>'quantity')::numeric, updated_at = now()
        where id = (v_item->>'item_ref_id')::uuid;

      insert into stock_movements (item_id, movement_type, quantity, reason, reference_type, reference_id, created_by)
      values (
        (v_item->>'item_ref_id')::uuid, 'out', (v_item->>'quantity')::numeric,
        'POS বিক্রয় (' || v_invoice_no || ')', 'pos_sale', v_sale_id, auth.uid()
      );
    end if;
  end loop;

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    if (v_pay->>'amount')::numeric > 0 then
      insert into sale_payments (sale_id, method, amount, kind, created_by)
      values (v_sale_id, v_pay->>'method', (v_pay->>'amount')::numeric, 'sale', auth.uid());
    end if;
  end loop;

  -- ক্যাশ-বুকে শুধু আসলে পাওয়া টাকা আয় হিসেবে যায় (Due নয়)
  if v_paid > 0 then
    select string_agg(
             case m when 'cash' then 'নগদ' when 'bkash' then 'বিকাশ' when 'nagad' then 'নগদ(Nagad)'
                    when 'rocket' then 'রকেট' else 'অন্যান্য' end, ', ')
      into v_methods
      from (select distinct (e->>'method') as m from jsonb_array_elements(p_payments) e
            where (e->>'amount')::numeric > 0) x;

    insert into cash_transactions (entry_date, type, category, description, amount, created_by)
    values (
      (now() at time zone 'Asia/Dhaka')::date, 'income', 'POS বিক্রয়',
      'ইনভয়েস ' || v_invoice_no || ' (' || coalesce(v_methods, '') || ')', v_paid, auth.uid()
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'invoice_no', v_invoice_no,
    'total_amount', v_total,
    'paid_amount', v_paid,
    'due_amount', v_due
  );
end;
$$;

grant execute on function create_pos_sale_v2(jsonb, uuid, text, text, numeric, jsonb) to authenticated;

-- ৪) shop_customer_summary — total_due এখন সত্যিকারের বকেয়া (কলামের ক্রম অপরিবর্তিত)
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
  coalesce(p.due, 0)::numeric as total_due,
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
         coalesce(sum(due_amount) filter (where status = 'completed'), 0) as due,
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

-- যাচাই
select
  (select count(*) from pos_sales) as total_sales,
  (select count(*) from pos_sales where invoice_no is null) as sales_without_invoice,
  (select count(*) from sale_payments) as payment_rows,
  (select coalesce(sum(due_amount), 0) from pos_sales) as total_due;
