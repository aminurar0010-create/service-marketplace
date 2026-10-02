-- ============================================================
-- ফেজ G — নিরাপত্তা শক্তিশালী করা (Permission ও Customer Data Protection)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- ⚠️ আগে ফেজ 16, A–F-র SQL রান করা থাকতে হবে। একাধিকবার রান করলেও সমস্যা নেই।
--
-- কী ঠিক হবে (রিভিউয়ে পাওয়া ঝুঁকি):
--   ১) কাউন্টার অপারেটর ক্যাশ-বুকের এন্ট্রি মুছতে/বদলাতে পারত  → এখন শুধু দেখা ও নতুন (হাতে লেখা) এন্ট্রি যোগ; মোছা/এডিট শুধু অ্যাডমিন
--   ২) কাউন্টার অপারেটর যেকোনো সার্ভিসের দাম বদলাতে/মুছতে পারত → এখন শুধু দেখা ও Quick Order-এর "কাস্টম/এককালীন" নিষ্ক্রিয় সার্ভিস যোগ
--   ৩) কাউন্টার অপারেটর API দিয়ে POS বিক্রির টাকা (paid/due) বদলাতে পারত → pos_sales আপডেট এখন শুধু অ্যাডমিন
--   ৪) অ্যাক্টিভিটি লগে অন্যের নামে লগ বানানো যেত → এখন actor_id নিজের হতে হবে
--   ৫) যে কেউ ভর্তির আবেদনে status='confirmed' বসিয়ে কাস্টমার প্রোফাইল বানাতে পারত → এখন শুধু সাধারণ "pending" আবেদন চলবে
--   ৬) যে কেউ ট্র্যাকিং নম্বর জেনে যেকোনো অর্ডারের ট্রানজেকশন আইডি বদলে দিতে পারত → এখন শুধু একবার, অর্ডারের ২ ঘণ্টার মধ্যে
--   ৭) সংবেদনশীল ফাংশন লগইন ছাড়া (anon) কল করার অনুমতি তুলে নেওয়া
-- ============================================================

-- সাহায্যকারী: একটি টেবিলের নির্দিষ্ট ধরনের (cmd) সব পলিসি সরানো, যাতে পুরনো ঢিলা পলিসি লুকিয়ে না থাকে
create or replace function _g_drop_policies(p_table text, p_cmds text[])
returns void
language plpgsql
as $$
declare
  r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = p_table and cmd = any(p_cmds)
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, p_table);
  end loop;
end;
$$;

-- ১) cash_transactions
select _g_drop_policies('cash_transactions', array['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE']);

create policy "Admin and counter view cash transactions" on cash_transactions
  for select using (is_admin(auth.uid()) or is_counter_operator(auth.uid()));

create policy "Admin and counter add manual cash entries" on cash_transactions
  for insert with check (
    is_admin(auth.uid())
    or (is_counter_operator(auth.uid()) and source = 'manual')
  );

create policy "Admins update cash transactions" on cash_transactions
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "Admins delete cash transactions" on cash_transactions
  for delete using (is_admin(auth.uid()));

-- ২) services
select _g_drop_policies('services', array['ALL', 'INSERT', 'UPDATE', 'DELETE']);
-- (সবার জন্য "সক্রিয় সার্ভিস দেখা"র পলিসি SELECT-এ অক্ষত থাকে)

create policy "Admins can manage services" on services
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists "Counter operators can view services" on services;
create policy "Counter operators can view services" on services
  for select using (is_counter_operator(auth.uid()));

drop policy if exists "Counter operators can add custom services" on services;
create policy "Counter operators can add custom services" on services
  for insert with check (
    is_counter_operator(auth.uid())
    and is_active = false
    and category = 'কাস্টম/এককালীন'
  );

-- ৩) pos_sales — আপডেট শুধু অ্যাডমিন (বিক্রি তৈরি হয় create_pos_sale_v2 দিয়ে)
select _g_drop_policies('pos_sales', array['UPDATE', 'DELETE']);
create policy "Admins can update pos sales" on pos_sales
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ৪) activity_logs — নিজের নামেই লগ
select _g_drop_policies('activity_logs', array['INSERT']);
create policy "Dashboard users insert own activity logs" on activity_logs
  for insert with check (actor_id = auth.uid() and is_shop_staff(auth.uid()));

-- ৫) enrollments — পাবলিক আবেদন শুধু সাধারণ "pending" আকারে
select _g_drop_policies('enrollments', array['INSERT']);
create policy "Anyone can submit an enrollment" on enrollments
  for insert with check (
    status = 'pending'
    and training_status = 'running'
    and fee_total is null
    and discount = 0
    and shop_customer_id is null
    and batch_name is null
    and start_date is null
    and completed_at is null
    and length(trim(full_name)) between 2 and 100
    and length(trim(phone)) between 6 and 20
  );

-- ৬) অর্ডারের ট্রানজেকশন আইডি — একবার বসানো যায়, অর্ডারের ২ ঘণ্টার মধ্যে
create or replace function set_order_transaction_id(p_tracking_id text, p_transaction_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update orders
     set transaction_id = left(trim(p_transaction_id), 64)
   where tracking_id = p_tracking_id
     and (transaction_id is null or transaction_id = '')
     and created_at > now() - interval '2 hours';
$$;

grant execute on function set_order_transaction_id(text, text) to anon, authenticated;

-- ৭) সংবেদনশীল ফাংশন — লগইন ছাড়া কল বন্ধ (ভেতরে রোল-চেক থাকলেও দরজাটা আগেই বন্ধ)
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname = any (array[
         'collect_due', 'close_day', 'day_summary', 'collect_student_fee', 'void_student_payment',
         'issue_certificate', 'claim_shop_profile', 'get_my_shop_account', 'create_pos_sale_v2',
         'create_pos_sale', 'adjust_stock', 'export_full_backup', 'cleanup_old_data',
         'get_shop_customer_history'
       ])
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

drop function if exists _g_drop_policies(text, text[]);

-- যাচাই (একটাই ফলাফল-টেবিল): প্রতিটি সারি একটি চেক
select 'RLS বন্ধ থাকা টেবিল (ফাঁকা হওয়া উচিত)' as check_name,
       coalesce(string_agg(c.relname, ', '), 'নেই ✅') as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'cash_transactions পলিসি', string_agg(policyname || ' [' || cmd || ']', '; ')
  from pg_policies where schemaname = 'public' and tablename = 'cash_transactions'
union all
select 'services পলিসি', string_agg(policyname || ' [' || cmd || ']', '; ')
  from pg_policies where schemaname = 'public' and tablename = 'services'
union all
select 'pos_sales আপডেট পলিসি', coalesce(string_agg(policyname, '; '), 'নেই')
  from pg_policies where schemaname = 'public' and tablename = 'pos_sales' and cmd = 'UPDATE'
union all
select 'anon যে সংবেদনশীল ফাংশন চালাতে পারে (ফাঁকা হওয়া উচিত)',
       coalesce(string_agg(p.proname, ', '), 'নেই ✅')
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname = any (array['collect_due','close_day','day_summary','collect_student_fee','void_student_payment','issue_certificate','claim_shop_profile','get_my_shop_account','create_pos_sale_v2','export_full_backup'])
   and has_function_privilege('anon', p.oid, 'execute');
