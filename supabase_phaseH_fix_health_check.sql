-- ফেজ H ছোট সংশোধন: সিস্টেম হেলথ চেকের "মাধ্যমহীন আয়" গণনা থেকে POS এন্ট্রি বাদ (ভুল সতর্কতা কমানো)
-- Supabase SQL Editor-এ পেস্ট করে Run করুন। একাধিকবার চালালেও সমস্যা নেই।

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
  -- POS এন্ট্রির মাধ্যম sale_payments-এ থাকে (একাধিক মাধ্যম হতে পারে), তাই এখানে POS বাদ
  select count(*) into v_n from cash_transactions
   where type = 'income' and payment_method is null and source <> 'pos'
     and entry_date >= (now() at time zone 'Asia/Dhaka')::date - 30;
  v_checks := v_checks || jsonb_build_object('key', 'no_method', 'label', 'হাতে-লেখা আয়ে পেমেন্ট মাধ্যম নেই (গত ৩০ দিন)', 'count', v_n, 'hint', 'তথ্যমূলক — নতুন এন্ট্রিতে মাধ্যম বাছুন');

  return jsonb_build_object('checks', v_checks);
end;
$$;

revoke execute on function workflow_health() from public, anon;
grant execute on function workflow_health() to authenticated;
