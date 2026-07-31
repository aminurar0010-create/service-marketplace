-- =========================================================================
-- ফেজ ৫ (বাকি অংশ) মাইগ্রেশন — ইনভেন্টরি/স্টক ম্যানেজমেন্ট + POS
-- Supabase Dashboard → SQL Editor → এই পুরো ফাইলটি পেস্ট করে Run করুন
-- (Bolt দিয়ে এই SQL চালাবেন না — টোকেন বাঁচবে)
-- =========================================================================

-- -------------------------------------------------------------------------
-- ১. inventory_items টেবিল — স্টক/পণ্যের ক্যাটালগ
-- -------------------------------------------------------------------------
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  category text,
  unit text not null default 'পিস',
  quantity numeric(10,2) not null default 0,
  low_stock_threshold numeric(10,2) not null default 5,
  cost_price numeric(10,2) not null default 0,
  sell_price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_category_idx on inventory_items (category);

alter table inventory_items enable row level security;

drop policy if exists "Staff and admin can view inventory" on inventory_items;
create policy "Staff and admin can view inventory" on inventory_items
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','staff')
  ));

drop policy if exists "Admins can manage inventory" on inventory_items;
create policy "Admins can manage inventory" on inventory_items
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- -------------------------------------------------------------------------
-- ২. stock_movements টেবিল — প্রতিটি স্টক পরিবর্তনের হিসাব (ইন/আউট/সমন্বয়)
-- -------------------------------------------------------------------------
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('in','out','adjustment')),
  quantity numeric(10,2) not null,
  reason text,
  reference_type text,
  reference_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_item_idx on stock_movements (item_id);
create index if not exists stock_movements_created_at_idx on stock_movements (created_at desc);

alter table stock_movements enable row level security;

drop policy if exists "Staff and admin can view stock movements" on stock_movements;
create policy "Staff and admin can view stock movements" on stock_movements
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','staff')
  ));

drop policy if exists "Staff and admin can insert stock movements" on stock_movements;
create policy "Staff and admin can insert stock movements" on stock_movements
  for insert with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','staff')
  ));

-- -------------------------------------------------------------------------
-- ৩. pos_sales ও pos_sale_items — দোকানে সরাসরি আসা কাস্টমারের বিক্রয় (POS)
-- -------------------------------------------------------------------------
create table if not exists pos_sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text unique not null
    default ('POS-' || substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  customer_name text,
  customer_phone text,
  payment_method text not null default 'cash',
  subtotal numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  status text not null default 'completed' check (status in ('completed','refunded')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists pos_sales_created_at_idx on pos_sales (created_at desc);

alter table pos_sales enable row level security;

drop policy if exists "Staff and admin can view pos sales" on pos_sales;
create policy "Staff and admin can view pos sales" on pos_sales
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','staff')
  ));

drop policy if exists "Admins can update pos sales" on pos_sales;
create policy "Admins can update pos sales" on pos_sales
  for update using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

create table if not exists pos_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id) on delete cascade,
  item_type text not null check (item_type in ('service','inventory','custom')),
  item_ref_id uuid,
  item_name text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0
);

create index if not exists pos_sale_items_sale_idx on pos_sale_items (sale_id);

alter table pos_sale_items enable row level security;

drop policy if exists "Staff and admin can view pos sale items" on pos_sale_items;
create policy "Staff and admin can view pos sale items" on pos_sale_items
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','staff')
  ));

-- -------------------------------------------------------------------------
-- ৪. create_pos_sale() — একটি POS বিক্রয় সম্পন্ন করে: sale + items ইনসার্ট,
--    ইনভেন্টরি স্টক কমানো, stock_movements-এ লগ, এবং cash_transactions-এ আয় যোগ
--    (সবকিছু একটি transaction-এ হয়, তাই আংশিক ব্যর্থতা হবে না)
-- -------------------------------------------------------------------------
create or replace function create_pos_sale(
  p_items jsonb,               -- [{item_type, item_ref_id, item_name, quantity, unit_price}, ...]
  p_customer_name text default null,
  p_customer_phone text default null,
  p_payment_method text default 'cash',
  p_discount_amount numeric default 0
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_role text;
  v_sale_id uuid;
  v_sale_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_line_total numeric;
  v_current_qty numeric;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin','staff') then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'কমপক্ষে একটি আইটেম যোগ করুন');
  end if;

  -- স্টক ভ্যালিডেশন: ইনভেন্টরি আইটেমের জন্য পর্যাপ্ত স্টক আছে কিনা যাচাই
  for v_item in select * from jsonb_array_elements(p_items)
  loop
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

  v_total := greatest(v_subtotal - coalesce(p_discount_amount, 0), 0);

  insert into pos_sales (customer_name, customer_phone, payment_method, subtotal, discount_amount, total_amount, created_by)
  values (nullif(trim(p_customer_name), ''), nullif(trim(p_customer_phone), ''), coalesce(p_payment_method, 'cash'), v_subtotal, coalesce(p_discount_amount, 0), v_total, auth.uid())
  returning id, sale_number into v_sale_id, v_sale_number;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_line_total := (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric;

    insert into pos_sale_items (sale_id, item_type, item_ref_id, item_name, quantity, unit_price, line_total)
    values (
      v_sale_id,
      v_item->>'item_type',
      nullif(v_item->>'item_ref_id','')::uuid,
      v_item->>'item_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      v_line_total
    );

    if (v_item->>'item_type') = 'inventory' then
      update inventory_items
        set quantity = quantity - (v_item->>'quantity')::numeric,
            updated_at = now()
        where id = (v_item->>'item_ref_id')::uuid;

      insert into stock_movements (item_id, movement_type, quantity, reason, reference_type, reference_id, created_by)
      values (
        (v_item->>'item_ref_id')::uuid,
        'out',
        (v_item->>'quantity')::numeric,
        'POS বিক্রয় (' || v_sale_number || ')',
        'pos_sale',
        v_sale_id,
        auth.uid()
      );
    end if;
  end loop;

  insert into cash_transactions (entry_date, type, category, description, amount, created_by)
  values (current_date, 'income', 'POS বিক্রয়', 'বিক্রয় নং ' || v_sale_number, v_total, auth.uid());

  return jsonb_build_object('success', true, 'sale_id', v_sale_id, 'sale_number', v_sale_number, 'total_amount', v_total);
end;
$$;

-- -------------------------------------------------------------------------
-- ৫. adjust_stock() — ম্যানুয়াল স্টক ইন/আউট/সমন্বয় (ক্রয়, নষ্ট হওয়া, গণনা সংশোধন ইত্যাদি)
-- -------------------------------------------------------------------------
create or replace function adjust_stock(
  p_item_id uuid,
  p_movement_type text,   -- 'in' | 'out' | 'adjustment'
  p_quantity numeric,     -- 'adjustment' হলে এটি নতুন সম্পূর্ণ কোয়ান্টিটি, নাহলে পরিবর্তনের পরিমাণ
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_role text;
  v_current_qty numeric;
  v_new_qty numeric;
  v_movement_qty numeric;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin','staff') then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  if p_movement_type not in ('in','out','adjustment') then
    return jsonb_build_object('success', false, 'message', 'ভুল movement_type');
  end if;

  select quantity into v_current_qty from inventory_items where id = p_item_id;
  if v_current_qty is null then
    return jsonb_build_object('success', false, 'message', 'আইটেম খুঁজে পাওয়া যায়নি');
  end if;

  if p_movement_type = 'in' then
    v_new_qty := v_current_qty + p_quantity;
    v_movement_qty := p_quantity;
  elsif p_movement_type = 'out' then
    if v_current_qty < p_quantity then
      return jsonb_build_object('success', false, 'message', 'পর্যাপ্ত স্টক নেই');
    end if;
    v_new_qty := v_current_qty - p_quantity;
    v_movement_qty := p_quantity;
  else -- adjustment: p_quantity নতুন চূড়ান্ত পরিমাণ হিসেবে গণ্য হবে
    v_new_qty := p_quantity;
    v_movement_qty := p_quantity - v_current_qty;
  end if;

  update inventory_items set quantity = v_new_qty, updated_at = now() where id = p_item_id;

  insert into stock_movements (item_id, movement_type, quantity, reason, reference_type, created_by)
  values (p_item_id, p_movement_type, abs(v_movement_qty), p_reason, 'manual', auth.uid());

  return jsonb_build_object('success', true, 'new_quantity', v_new_qty);
end;
$$;

-- =========================================================================
-- সম্পন্ন। এখন AdminDashboard-এ "ইনভেন্টরি" ও "POS" ট্যাব দুটো কাজ করবে।
-- =========================================================================
