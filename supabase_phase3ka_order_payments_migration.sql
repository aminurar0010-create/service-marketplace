-- ফেজ ৩-ক (অংশ ২) — অর্ডারে আংশিক পেমেন্ট ও বাকি
-- লক্ষ্য: কুইক অর্ডারে "এখন কত টাকা পেলেন" লিখে বাকিতে রাখা যাবে; পরে কিস্তিতে/একসাথে টাকা নেওয়া যাবে।
-- হিসাবের নিয়ম (আগের সঙ্গে মিলিয়ে):
--   • প্রতিটি পাওয়া টাকা ক্যাশ-বুকে ঠিক একবার উঠবে (source = 'online_order', মাধ্যমসহ) — ডে-ক্লোজ আগের মতোই গুনবে।
--   • পুরনো অর্ডারের কোনো সারি বদলানো হয় না (কোনো মাস-আপডেট নেই)।
--   • পুরনো পদ্ধতি (ড্রপডাউনে সরাসরি "paid" করা) আগের মতোই কাজ করে; আংশিক টাকা আগে নেওয়া থাকলে শুধু বাকিটুকু ক্যাশ-বুকে ওঠে।
-- নিরাপদ: `if not exists` / `create or replace`; একাধিকবার রান করা যায়।

-- ১) orders-এ নতুন কলাম
alter table orders add column if not exists paid_amount numeric not null default 0;
alter table orders add column if not exists credit_sale boolean not null default false;  -- স্টাফ বাকিতে দিয়েছেন
alter table orders add column if not exists internal_note text;                          -- কুইক অর্ডারের নোট (আগে কিছু ডাটাবেসে ছিল না)

alter table orders drop constraint if exists orders_paid_amount_chk;
alter table orders add constraint orders_paid_amount_chk check (paid_amount >= 0);

-- ২) প্রতিটি পেমেন্টের লগ
create table if not exists order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('cash', 'bkash', 'nagad', 'rocket', 'other')),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid
);
create index if not exists order_payments_order_idx on order_payments (order_id, created_at);

alter table order_payments enable row level security;
drop policy if exists "Shop staff can view order payments" on order_payments;
create policy "Shop staff can view order payments" on order_payments
  for select to authenticated using (is_shop_staff(auth.uid()));
-- লেখা শুধু নিচের ফাংশন দিয়ে (সরাসরি insert/update/delete-এর পলিসি নেই)
grant select on order_payments to authenticated;

-- ৩) পেমেন্ট নেওয়ার ফাংশন
create or replace function record_order_payment(p_tracking_id text, p_amount numeric, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_due numeric;
  v_new_paid numeric;
  v_label text;
begin
  if auth.uid() is null or not is_shop_staff(auth.uid()) then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  if p_method is null or p_method not in ('cash', 'bkash', 'nagad', 'rocket', 'other') then
    return jsonb_build_object('success', false, 'message', 'পেমেন্ট মেথড সঠিক নয়');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'টাকার পরিমাণ সঠিক নয়');
  end if;

  -- একই অর্ডারে দুইজন একসাথে টাকা নিলে গোলমাল এড়াতে সারি লক
  select * into v_order from orders where tracking_id = p_tracking_id for update;
  if not found then
    return jsonb_build_object('success', false, 'message', 'অর্ডার খুঁজে পাওয়া যায়নি');
  end if;
  if v_order.status in ('cancelled', 'rejected') then
    return jsonb_build_object('success', false, 'message', 'বাতিল অর্ডারে পেমেন্ট নেওয়া যায় না');
  end if;
  if v_order.payment_status <> 'unpaid' then
    return jsonb_build_object('success', false, 'message', 'এই অর্ডারের পেমেন্ট আগেই সম্পন্ন (বা ফেরত) হয়েছে');
  end if;

  v_due := greatest(coalesce(v_order.total_amount, 0) - coalesce(v_order.paid_amount, 0), 0);
  if v_due <= 0 then
    return jsonb_build_object('success', false, 'message', 'এই অর্ডারে কোনো বাকি নেই');
  end if;
  if p_amount > v_due then
    return jsonb_build_object('success', false, 'message', format('টাকা বাকির (৳%s) বেশি হতে পারে না', v_due));
  end if;

  v_new_paid := coalesce(v_order.paid_amount, 0) + p_amount;
  v_label := case p_method when 'cash' then 'নগদ' when 'bkash' then 'বিকাশ' when 'nagad' then 'নগদ(Nagad)'
                           when 'rocket' then 'রকেট' else 'অন্যান্য' end;

  -- ক্যাশ-বুক আগে (orders আপডেটের ট্রিগার যেন দ্বিতীয়বার না গোনে — সেখানে বাকি = ০ হবে)
  insert into cash_transactions (entry_date, type, category, description, amount, order_id, payment_method, source, created_by)
  values (
    (now() at time zone 'Asia/Dhaka')::date, 'income', 'অনলাইন অর্ডার',
    'অর্ডার ' || coalesce(v_order.tracking_id, v_order.id::text)
      || case when v_new_paid >= coalesce(v_order.total_amount, 0) then ' (বাকি পরিশোধ' else ' (আংশিক' end
      || ', ' || v_label || ')',
    p_amount, v_order.id, p_method, 'online_order', auth.uid()
  );

  insert into order_payments (order_id, amount, method, created_by)
  values (v_order.id, p_amount, p_method, auth.uid());

  update orders
     set paid_amount = v_new_paid,
         payment_status = case when v_new_paid >= coalesce(total_amount, 0) then 'paid' else payment_status end
   where id = v_order.id;

  return jsonb_build_object(
    'success', true,
    'collected', p_amount,
    'paid_amount', v_new_paid,
    'due_amount', greatest(coalesce(v_order.total_amount, 0) - v_new_paid, 0),
    'fully_paid', v_new_paid >= coalesce(v_order.total_amount, 0)
  );
end;
$$;

revoke execute on function record_order_payment(text, numeric, text) from public, anon;
grant execute on function record_order_payment(text, numeric, text) to authenticated;

-- ৪) ড্রপডাউনে সরাসরি "paid" করলে: শুধু আগে-না-নেওয়া বাকিটুকু ক্যাশ-বুকে ওঠে
create or replace function sync_order_payment_cashbook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_remainder numeric;
begin
  v_method := case
    when new.payment_method in ('cash', 'bkash', 'nagad', 'rocket') then new.payment_method
    when new.payment_method = 'cod' then 'cash'
    else 'other'
  end;

  -- paid হলে আয় (একই অর্ডারের জন্য কোনো টাকা দুইবার নয়)
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
    v_remainder := coalesce(new.total_amount, 0) - coalesce(new.paid_amount, 0);
    -- পুরনো নিয়ম বহাল: আগে থেকেই আয়ের এন্ট্রি আছে (paid_amount = ০) মানে আগেই গোনা হয়েছে — আবার নয়
    if v_remainder > 0
       and not (coalesce(new.paid_amount, 0) = 0
                and exists (select 1 from cash_transactions where order_id = new.id and type = 'income')) then
      insert into cash_transactions (entry_date, type, category, description, amount, order_id, payment_method, source, created_by)
      values (
        (now() at time zone 'Asia/Dhaka')::date, 'income', 'অনলাইন অর্ডার',
        'অর্ডার ' || coalesce(new.tracking_id, new.id::text), v_remainder,
        new.id, v_method, 'online_order', auth.uid()
      );
      insert into order_payments (order_id, amount, method, note, created_by)
      values (new.id, v_remainder, v_method, 'স্ট্যাটাস "পরিশোধিত" করার সময়', auth.uid());
      update orders set paid_amount = coalesce(new.total_amount, 0) where id = new.id;
    end if;
  end if;

  -- paid থেকে refunded হলে একটি ফেরত-ব্যয় (একবারই) — আগের মতো
  if tg_op = 'UPDATE' and new.payment_status = 'refunded' and old.payment_status = 'paid' then
    if exists (select 1 from cash_transactions where order_id = new.id and type = 'income')
       and not exists (select 1 from cash_transactions where order_id = new.id and type = 'expense') then
      insert into cash_transactions (entry_date, type, category, description, amount, order_id, payment_method, source, created_by)
      values (
        (now() at time zone 'Asia/Dhaka')::date, 'expense', 'অর্ডার ফেরত',
        'অর্ডার ' || coalesce(new.tracking_id, new.id::text) || ' ফেরত', new.total_amount,
        new.id, v_method, 'online_order', auth.uid()
      );
    end if;
  end if;

  return new;
end;
$$;
-- ট্রিগার আগের মতোই (trg_order_payment_cashbook) — শুধু ফাংশনের ভেতরটা বদলেছে

-- ৫) "অর্ডারের বাকি" তালিকা (বাকি আদায় ট্যাবের জন্য)
create or replace view order_dues
with (security_invoker = true) as
select
  o.id as order_id,
  o.tracking_id,
  o.customer_name,
  o.customer_phone,
  o.shop_customer_id,
  o.status,
  o.created_at,
  o.total_amount,
  o.paid_amount,
  greatest(coalesce(o.total_amount, 0) - coalesce(o.paid_amount, 0), 0) as due_amount,
  (select max(op.created_at) from order_payments op where op.order_id = o.id) as last_payment_at
from orders o
where o.payment_status = 'unpaid'
  and o.status not in ('cancelled', 'rejected')
  and (o.credit_sale or o.paid_amount > 0)
  and coalesce(o.total_amount, 0) - coalesce(o.paid_amount, 0) > 0;

grant select on order_dues to authenticated;
