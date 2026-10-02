-- ============================================================
-- ফেজ C — Business Accounting (Due আদায়, Cashbook সংযোগ, Expense, Daily Close)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- ⚠️ আগে ফেজ A ও B-র SQL রান করা থাকতে হবে। একাধিকবার রান করলেও সমস্যা নেই।
--
-- কী হবে:
--   ১) cash_transactions-এ নতুন কলাম: payment_method (কোন মাধ্যমে), source (এন্ট্রি কোথা থেকে এলো)
--   ২) customer_dues ভিউ — কার কত বকেয়া
--   ৩) collect_due() — বকেয়া আদায় (পুরনো বিক্রি আগে, FIFO), ক্যাশ-বুকে আয় যোগ
--   ৪) অনলাইন অর্ডার "paid" হলে ক্যাশ-বুকে অটো আয় (ফেরত হলে অটো ব্যয়)
--   ৫) daily_closings + close_day() — দিনের হিসাব বন্ধ করা
-- ============================================================

-- ১) cash_transactions — মাধ্যম ও উৎস
alter table cash_transactions add column if not exists payment_method text;
alter table cash_transactions add column if not exists source text not null default 'manual';

alter table cash_transactions drop constraint if exists cash_transactions_payment_method_chk;
alter table cash_transactions add constraint cash_transactions_payment_method_chk
  check (payment_method is null or payment_method in ('cash', 'bkash', 'nagad', 'rocket', 'other'));

alter table cash_transactions drop constraint if exists cash_transactions_source_chk;
alter table cash_transactions add constraint cash_transactions_source_chk
  check (source in ('manual', 'pos', 'due_collection', 'online_order'));

-- পুরনো POS এন্ট্রি চিহ্নিত করা (ডেইলি ক্লোজে দুইবার গোনা এড়াতে)
update cash_transactions set source = 'pos'
where source = 'manual' and category = 'POS বিক্রয়';

-- create_pos_sale_v2() (ফেজ B) এন্ট্রি দেয় source ছাড়া — তাই ট্রিগার দিয়ে অটো 'pos' বসানো হয়
create or replace function tag_pos_cash_source()
returns trigger
language plpgsql
as $$
begin
  if new.source = 'manual' and new.category = 'POS বিক্রয়' then
    new.source := 'pos';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tag_pos_cash_source on cash_transactions;
create trigger trg_tag_pos_cash_source
  before insert on cash_transactions
  for each row execute function tag_pos_cash_source();

create index if not exists cash_transactions_date_idx on cash_transactions (entry_date);

-- ২) customer_dues ভিউ
create or replace view customer_dues
with (security_invoker = true) as
select
  sc.id as customer_id,
  sc.customer_code,
  sc.name,
  sc.phone,
  sum(s.due_amount)::numeric as total_due,
  count(*)::int as due_sales_count,
  min(s.created_at) as oldest_due_at,
  (select max(sp.created_at)
     from sale_payments sp join pos_sales ps on ps.id = sp.sale_id
    where ps.shop_customer_id = sc.id and sp.kind = 'due_collection') as last_collection_at
from shop_customers sc
join pos_sales s on s.shop_customer_id = sc.id
where s.due_amount > 0 and s.status = 'completed'
group by sc.id, sc.customer_code, sc.name, sc.phone;

grant select on customer_dues to authenticated;

-- ৩) collect_due() — বকেয়া আদায়
create or replace function collect_due(
  p_customer_id uuid,
  p_amount numeric,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_total_due numeric;
  v_left numeric;
  v_take numeric;
  v_sale record;
  v_name text;
  v_invoices text := '';
  v_label text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'staff') then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  if p_method is null or p_method not in ('cash', 'bkash', 'nagad', 'rocket', 'other') then
    return jsonb_build_object('success', false, 'message', 'পেমেন্ট মেথড সঠিক নয়');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'আদায়ের পরিমাণ সঠিক নয়');
  end if;

  select name into v_name from shop_customers where id = p_customer_id;
  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'কাস্টমার খুঁজে পাওয়া যায়নি');
  end if;

  -- একই কাস্টমারের দুইটি আদায় একসাথে চললে যেন গোলমাল না হয়: বিক্রির সারি লক করা
  perform 1 from pos_sales
   where shop_customer_id = p_customer_id and due_amount > 0 and status = 'completed'
   for update;

  select coalesce(sum(due_amount), 0) into v_total_due
    from pos_sales
   where shop_customer_id = p_customer_id and due_amount > 0 and status = 'completed';

  if v_total_due <= 0 then
    return jsonb_build_object('success', false, 'message', 'এই কাস্টমারের কোনো বকেয়া নেই');
  end if;
  if p_amount > v_total_due then
    return jsonb_build_object('success', false,
      'message', format('আদায়ের পরিমাণ মোট বকেয়ার (৳%s) বেশি হতে পারে না', v_total_due));
  end if;

  v_left := p_amount;
  for v_sale in
    select id, invoice_no, due_amount
      from pos_sales
     where shop_customer_id = p_customer_id and due_amount > 0 and status = 'completed'
     order by created_at asc, id asc
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_sale.due_amount);

    update pos_sales
       set paid_amount = paid_amount + v_take,
           due_amount = due_amount - v_take
     where id = v_sale.id;

    insert into sale_payments (sale_id, method, amount, kind, created_by)
    values (v_sale.id, p_method, v_take, 'due_collection', auth.uid());

    v_invoices := v_invoices || case when v_invoices = '' then '' else ', ' end || v_sale.invoice_no;
    v_left := v_left - v_take;
  end loop;

  v_label := case p_method when 'cash' then 'নগদ' when 'bkash' then 'বিকাশ' when 'nagad' then 'নগদ(Nagad)'
                           when 'rocket' then 'রকেট' else 'অন্যান্য' end;

  insert into cash_transactions (entry_date, type, category, description, amount, payment_method, source, created_by)
  values (
    (now() at time zone 'Asia/Dhaka')::date, 'income', 'বাকি আদায়',
    v_name || ' — ' || v_invoices || ' (' || v_label || ')',
    p_amount, p_method, 'due_collection', auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'collected', p_amount,
    'remaining_due', v_total_due - p_amount,
    'invoices', v_invoices
  );
end;
$$;

grant execute on function collect_due(uuid, numeric, text) to authenticated;

-- ৪) অনলাইন অর্ডারের পেমেন্ট → ক্যাশ-বুক
create or replace function sync_order_payment_cashbook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
begin
  v_method := case
    when new.payment_method in ('cash', 'bkash', 'nagad', 'rocket') then new.payment_method
    when new.payment_method = 'cod' then 'cash'
    else 'other'
  end;

  -- paid হলে আয় (একই অর্ডারের জন্য একবারই)
  if new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
    if coalesce(new.total_amount, 0) > 0
       and not exists (select 1 from cash_transactions where order_id = new.id and type = 'income') then
      insert into cash_transactions (entry_date, type, category, description, amount, order_id, payment_method, source, created_by)
      values (
        (now() at time zone 'Asia/Dhaka')::date, 'income', 'অনলাইন অর্ডার',
        'অর্ডার ' || coalesce(new.tracking_id, new.id::text), new.total_amount,
        new.id, v_method, 'online_order', auth.uid()
      );
    end if;
  end if;

  -- paid থেকে refunded হলে একটি ফেরত-ব্যয় (একবারই)
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

drop trigger if exists trg_order_payment_cashbook on orders;
create trigger trg_order_payment_cashbook
  after insert or update of payment_status on orders
  for each row execute function sync_order_payment_cashbook();

-- ৫) Daily Close
create table if not exists daily_closings (
  id uuid primary key default gen_random_uuid(),
  close_date date not null unique,
  sales_total numeric(12,2) not null default 0,   -- সেদিনের POS বিক্রির মোট
  new_due numeric(12,2) not null default 0,       -- সেদিনের নতুন বকেয়া
  income_total numeric(12,2) not null default 0,  -- ক্যাশ-বুকের মোট আয়
  expense_total numeric(12,2) not null default 0, -- ক্যাশ-বুকের মোট ব্যয়
  net_result numeric(12,2) not null default 0,
  by_method jsonb not null default '{}'::jsonb,   -- {cash:{income,expense,net}, bkash:{...}, ...}
  note text,
  closed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table daily_closings enable row level security;

drop policy if exists "Shop staff can view daily closings" on daily_closings;
create policy "Shop staff can view daily closings" on daily_closings
  for select using (is_shop_staff(auth.uid()));

drop policy if exists "Admins can delete daily closings" on daily_closings;
create policy "Admins can delete daily closings" on daily_closings
  for delete using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- ইনসার্ট শুধু close_day() (SECURITY DEFINER) দিয়ে হয়

-- হিসাব শুধু দেখার জন্য (বন্ধ না করে) — UI এটা দিয়ে প্রিভিউ দেখায়
create or replace function day_summary(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sales numeric;
  v_new_due numeric;
  v_income numeric;
  v_expense numeric;
  v_methods jsonb := '{}'::jsonb;
  m text;
  v_in numeric;
  v_out numeric;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'staff', 'counter_operator') then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  select coalesce(sum(total_amount), 0) into v_sales
    from pos_sales
   where status = 'completed' and (created_at at time zone 'Asia/Dhaka')::date = p_date;

  select coalesce(sum(s.total_amount), 0)
         - coalesce((select sum(sp.amount) from sale_payments sp
                      join pos_sales s2 on s2.id = sp.sale_id
                     where sp.kind = 'sale' and s2.status = 'completed'
                       and (s2.created_at at time zone 'Asia/Dhaka')::date = p_date), 0)
    into v_new_due
    from pos_sales s
   where s.status = 'completed' and (s.created_at at time zone 'Asia/Dhaka')::date = p_date;

  select coalesce(sum(amount) filter (where type = 'income'), 0),
         coalesce(sum(amount) filter (where type = 'expense'), 0)
    into v_income, v_expense
    from cash_transactions where entry_date = p_date;

  foreach m in array array['cash', 'bkash', 'nagad', 'rocket', 'other']
  loop
    -- আয়: POS/বাকি আদায় আসে sale_payments থেকে; বাকি সব ক্যাশ-বুক থেকে (মাধ্যম না থাকলে "other")
    select
      coalesce((select sum(sp.amount) from sale_payments sp
                 where sp.method = m and (sp.created_at at time zone 'Asia/Dhaka')::date = p_date), 0)
      + coalesce((select sum(ct.amount) from cash_transactions ct
                   where ct.entry_date = p_date and ct.type = 'income'
                     and ct.source in ('manual', 'online_order')
                     and coalesce(ct.payment_method, 'other') = m), 0)
    into v_in;

    select coalesce(sum(ct.amount), 0) into v_out
      from cash_transactions ct
     where ct.entry_date = p_date and ct.type = 'expense'
       and coalesce(ct.payment_method, 'other') = m;

    v_methods := v_methods || jsonb_build_object(m,
      jsonb_build_object('income', v_in, 'expense', v_out, 'net', v_in - v_out));
  end loop;

  return jsonb_build_object(
    'success', true,
    'close_date', p_date,
    'sales_total', v_sales,
    'new_due', v_new_due,
    'income_total', v_income,
    'expense_total', v_expense,
    'net_result', v_income - v_expense,
    'by_method', v_methods
  );
end;
$$;

grant execute on function day_summary(date) to authenticated;

create or replace function close_day(p_date date, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_sum jsonb;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'staff') then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  if p_date > (now() at time zone 'Asia/Dhaka')::date then
    return jsonb_build_object('success', false, 'message', 'ভবিষ্যতের তারিখের হিসাব বন্ধ করা যায় না');
  end if;

  if exists (select 1 from daily_closings where close_date = p_date) then
    return jsonb_build_object('success', false, 'message', 'এই তারিখের হিসাব আগেই বন্ধ করা হয়েছে');
  end if;

  v_sum := day_summary(p_date);
  if not coalesce((v_sum->>'success')::boolean, false) then
    return v_sum;
  end if;

  insert into daily_closings (close_date, sales_total, new_due, income_total, expense_total, net_result, by_method, note, closed_by)
  values (
    p_date,
    (v_sum->>'sales_total')::numeric, (v_sum->>'new_due')::numeric,
    (v_sum->>'income_total')::numeric, (v_sum->>'expense_total')::numeric,
    (v_sum->>'net_result')::numeric, v_sum->'by_method',
    nullif(trim(p_note), ''), auth.uid()
  );

  return v_sum;
end;
$$;

grant execute on function close_day(date, text) to authenticated;

-- যাচাই: ক) মোট বকেয়া  খ) অনলাইন অর্ডার paid কিন্তু ক্যাশ-বুকে আয় নেই (পুরনো অর্ডার)
select
  (select coalesce(sum(due_amount), 0) from pos_sales where status = 'completed') as total_due,
  (select count(*) from orders o
    where o.payment_status = 'paid' and coalesce(o.total_amount, 0) > 0
      and not exists (select 1 from cash_transactions c where c.order_id = o.id and c.type = 'income')) as paid_orders_without_cashbook,
  (select coalesce(sum(o.total_amount), 0) from orders o
    where o.payment_status = 'paid' and coalesce(o.total_amount, 0) > 0
      and not exists (select 1 from cash_transactions c where c.order_id = o.id and c.type = 'income')) as paid_orders_amount_missing;
