-- ============================================================
-- ফেজ F — Training Management (হাজিরা, কোর্স ফি/Due, সার্টিফিকেট)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- ⚠️ আগে ফেজ 17 (courses/enrollments), A, C-র SQL রান করা থাকতে হবে। একাধিকবার রান করলেও সমস্যা নেই।
--
-- কী হবে:
--   ১) enrollments-এ নতুন কলাম: ব্যাচ, শুরুর তারিখ, মোট ফি, ডিসকাউন্ট, ট্রেনিং স্ট্যাটাস, shop_customer_id
--      ভর্তি "নিশ্চিত" (confirmed) হলে স্টুডেন্ট অটো shop_customers-এ যুক্ত হয় (type = student) ও কোর্সের ফি বসে
--   ২) student_attendance, student_payments, certificates টেবিল (শুধু অ্যাডমিন দেখতে/করতে পারবে)
--   ৩) collect_student_fee() — কিস্তিতে ফি আদায়, ক্যাশ-বুকে আয় ('কোর্স ফি'); void_student_payment() — ভুল এন্ট্রি বাতিল
--   ৪) issue_certificate() — ক্রমিক নম্বরসহ সার্টিফিকেট ইস্যু, কোর্স "সম্পন্ন" চিহ্নিত
--   ৫) student_overview ভিউ — ফি, পেইড, Due, হাজিরা একসাথে
--   ৬) day_summary() হালনাগাদ — কোর্স ফি মাধ্যমভিত্তিক আয়ে ধরা হবে; কাস্টমার ইতিহাসে ভর্তিও দেখা যাবে
-- ============================================================

-- ১) enrollments — নতুন কলাম
alter table enrollments add column if not exists shop_customer_id uuid references shop_customers(id) on delete set null;
alter table enrollments add column if not exists batch_name text;
alter table enrollments add column if not exists start_date date;
alter table enrollments add column if not exists fee_total numeric(10,2);
alter table enrollments add column if not exists discount numeric(10,2) not null default 0;
alter table enrollments add column if not exists training_status text not null default 'running';
alter table enrollments add column if not exists completed_at timestamptz;

alter table enrollments drop constraint if exists enrollments_training_status_chk;
alter table enrollments add constraint enrollments_training_status_chk
  check (training_status in ('running', 'completed', 'dropped'));
alter table enrollments drop constraint if exists enrollments_discount_chk;
alter table enrollments add constraint enrollments_discount_chk check (discount >= 0);

create index if not exists enrollments_shop_customer_idx on enrollments (shop_customer_id);
create index if not exists enrollments_batch_idx on enrollments (course_id, batch_name);

-- ভর্তি নিশ্চিত হলে: কাস্টমার প্রোফাইলে যুক্ত + ফি বসানো (আবেদন জমা দেওয়া কখনো আটকাবে না)
create or replace function enrollment_confirm_hook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id uuid;
  v_fee numeric;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  if new.fee_total is null then
    select fee into v_fee from courses where id = new.course_id;
    new.fee_total := coalesce(v_fee, 0);
  end if;

  v_phone := normalize_phone(new.phone);
  if v_phone is not null and length(v_phone) >= 10 then
    begin
      insert into shop_customers (name, phone, customer_type)
      values (coalesce(nullif(trim(new.full_name), ''), 'নামহীন'), v_phone, 'student')
      on conflict (phone) do nothing;
      select id into v_id from shop_customers where phone = v_phone;
      new.shop_customer_id := v_id;
      update shop_customers set customer_type = 'student' where id = v_id and customer_type = 'regular';
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enrollment_confirm_hook on enrollments;
create trigger trg_enrollment_confirm_hook
  before insert or update of status, phone on enrollments
  for each row execute function enrollment_confirm_hook();

-- আগে থেকে confirmed ভর্তিগুলো (একবারের ব্যাকফিল) — ট্রিগার চালু করতে status নিজের মানেই আপডেট
update enrollments set status = 'confirmed' where status = 'confirmed' and (fee_total is null or shop_customer_id is null);

-- ২) হাজিরা
create table if not exists student_attendance (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'leave')),
  note text,
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (enrollment_id, attendance_date)
);
create index if not exists student_attendance_date_idx on student_attendance (attendance_date);

-- ৩) ফি আদায়
create table if not exists student_payments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  method text not null check (method in ('cash', 'bkash', 'nagad', 'rocket', 'other')),
  payment_date date not null default ((now() at time zone 'Asia/Dhaka')::date),
  note text,
  cash_transaction_id uuid references cash_transactions(id) on delete set null,
  received_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists student_payments_enrollment_idx on student_payments (enrollment_id, created_at desc);

-- ৪) সার্টিফিকেট
create sequence if not exists certificate_no_seq;
create table if not exists certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references enrollments(id) on delete cascade,
  certificate_no text not null unique,
  issue_date date not null default ((now() at time zone 'Asia/Dhaka')::date),
  result text,
  issued_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- RLS: শুধু অ্যাডমিন (enrollments-এর বর্তমান নিয়মের সাথে মিল রেখে)
alter table student_attendance enable row level security;
alter table student_payments enable row level security;
alter table certificates enable row level security;

drop policy if exists "Admins manage attendance" on student_attendance;
create policy "Admins manage attendance" on student_attendance
  for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins view student payments" on student_payments;
create policy "Admins view student payments" on student_payments
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- ইনসার্ট/ডিলিট শুধু collect_student_fee() / void_student_payment() দিয়ে

drop policy if exists "Admins view certificates" on certificates;
create policy "Admins view certificates" on certificates
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- ইস্যু শুধু issue_certificate() দিয়ে

-- cash_transactions — নতুন উৎস 'course_fee'
alter table cash_transactions drop constraint if exists cash_transactions_source_chk;
alter table cash_transactions add constraint cash_transactions_source_chk
  check (source in ('manual', 'pos', 'due_collection', 'online_order', 'course_fee'));

-- ৫) ফি আদায়
create or replace function collect_student_fee(
  p_enrollment_id uuid,
  p_amount numeric,
  p_method text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_e enrollments;
  v_course text;
  v_net numeric;
  v_paid numeric;
  v_ct uuid;
  v_label text;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  if p_method is null or p_method not in ('cash', 'bkash', 'nagad', 'rocket', 'other') then
    return jsonb_build_object('success', false, 'message', 'পেমেন্ট মেথড সঠিক নয়');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'পরিমাণ সঠিক নয়');
  end if;

  select * into v_e from enrollments where id = p_enrollment_id for update;
  if v_e.id is null then
    return jsonb_build_object('success', false, 'message', 'স্টুডেন্ট খুঁজে পাওয়া যায়নি');
  end if;
  if v_e.status <> 'confirmed' then
    return jsonb_build_object('success', false, 'message', 'আগে ভর্তি নিশ্চিত করুন');
  end if;

  v_net := greatest(coalesce(v_e.fee_total, 0) - v_e.discount, 0);
  select coalesce(sum(amount), 0) into v_paid from student_payments where enrollment_id = p_enrollment_id;
  if p_amount > v_net - v_paid then
    return jsonb_build_object('success', false,
      'message', format('বাকি আছে মাত্র ৳%s — এর বেশি নেওয়া যাবে না', v_net - v_paid));
  end if;

  select title into v_course from courses where id = v_e.course_id;
  v_label := case p_method when 'cash' then 'নগদ' when 'bkash' then 'বিকাশ' when 'nagad' then 'নগদ(Nagad)'
                           when 'rocket' then 'রকেট' else 'অন্যান্য' end;

  insert into cash_transactions (entry_date, type, category, description, amount, payment_method, source, created_by)
  values (
    (now() at time zone 'Asia/Dhaka')::date, 'income', 'কোর্স ফি',
    v_e.full_name || ' — ' || coalesce(v_course, 'কোর্স') || ' (' || v_label || ')',
    p_amount, p_method, 'course_fee', auth.uid()
  )
  returning id into v_ct;

  insert into student_payments (enrollment_id, amount, method, note, cash_transaction_id, received_by)
  values (p_enrollment_id, p_amount, p_method, nullif(trim(p_note), ''), v_ct, auth.uid());

  return jsonb_build_object('success', true, 'paid', v_paid + p_amount, 'remaining_due', v_net - v_paid - p_amount);
end;
$$;

grant execute on function collect_student_fee(uuid, numeric, text, text) to authenticated;

create or replace function void_student_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_p student_payments;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  select * into v_p from student_payments where id = p_payment_id;
  if v_p.id is null then
    return jsonb_build_object('success', false, 'message', 'এন্ট্রি পাওয়া যায়নি');
  end if;
  delete from student_payments where id = p_payment_id;
  if v_p.cash_transaction_id is not null then
    delete from cash_transactions where id = v_p.cash_transaction_id;
  end if;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function void_student_payment(uuid) to authenticated;

-- ৬) সার্টিফিকেট ইস্যু (আগে ইস্যু হয়ে থাকলে একই নম্বর ফেরত দেয়)
create or replace function issue_certificate(p_enrollment_id uuid, p_result text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_e enrollments;
  v_c certificates;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;

  select * into v_e from enrollments where id = p_enrollment_id for update;
  if v_e.id is null or v_e.status <> 'confirmed' then
    return jsonb_build_object('success', false, 'message', 'শুধু নিশ্চিত ভর্তির স্টুডেন্টকে সার্টিফিকেট দেওয়া যায়');
  end if;

  select * into v_c from certificates where enrollment_id = p_enrollment_id;
  if v_c.id is null then
    insert into certificates (enrollment_id, certificate_no, result, issued_by)
    values (
      p_enrollment_id,
      'NP-' || to_char((now() at time zone 'Asia/Dhaka'), 'YYYY') || '-' || lpad(nextval('certificate_no_seq')::text, 4, '0'),
      nullif(trim(p_result), ''),
      auth.uid()
    )
    returning * into v_c;
  end if;

  update enrollments
     set training_status = 'completed', completed_at = coalesce(completed_at, now())
   where id = p_enrollment_id;

  return jsonb_build_object('success', true, 'certificate_no', v_c.certificate_no, 'issue_date', v_c.issue_date, 'result', v_c.result);
end;
$$;

grant execute on function issue_certificate(uuid, text) to authenticated;

-- ৭) স্টুডেন্ট ওভারভিউ
create or replace view student_overview
with (security_invoker = true) as
select
  e.id,
  e.course_id,
  c.title as course_title,
  c.duration_label,
  e.full_name,
  e.phone,
  e.batch_name,
  e.start_date,
  e.status,
  e.training_status,
  e.shop_customer_id,
  coalesce(e.fee_total, 0) as fee_total,
  e.discount,
  greatest(coalesce(e.fee_total, 0) - e.discount, 0) as net_fee,
  coalesce(p.paid, 0) as paid,
  greatest(coalesce(e.fee_total, 0) - e.discount, 0) - coalesce(p.paid, 0) as due,
  coalesce(a.present, 0)::int as present_count,
  coalesce(a.absent, 0)::int as absent_count,
  coalesce(a.late, 0)::int as late_count,
  coalesce(a.leave, 0)::int as leave_count,
  coalesce(a.total, 0)::int as total_classes,
  cert.certificate_no,
  cert.issue_date as certificate_date
from enrollments e
join courses c on c.id = e.course_id
left join lateral (select sum(amount) as paid from student_payments where enrollment_id = e.id) p on true
left join lateral (
  select count(*) filter (where status = 'present') as present,
         count(*) filter (where status = 'absent') as absent,
         count(*) filter (where status = 'late') as late,
         count(*) filter (where status = 'leave') as leave,
         count(*) as total
  from student_attendance where enrollment_id = e.id
) a on true
left join certificates cert on cert.enrollment_id = e.id
where e.status = 'confirmed';

grant select on student_overview to authenticated;

-- ৮) day_summary — কোর্স ফিও মাধ্যমভিত্তিক আয়ে (POS ও বাকি আদায় বাদে সব ক্যাশ-বুক আয় এখানে গোনা হয়)
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
                     and ct.source not in ('pos', 'due_collection')
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

-- ৯) কাস্টমার ইতিহাসে ভর্তিও দেখা যাবে
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
  union all
  select 'enrollment'::text, 'ভর্তি'::text, ('কোর্স: ' || c.title)::text,
         greatest(coalesce(e.fee_total, 0) - e.discount, 0)::numeric, e.training_status::text, e.created_at
  from enrollments e
  join courses c on c.id = e.course_id
  where e.shop_customer_id = p_customer_id and e.status = 'confirmed'
  order by created_at desc
  limit 200;
$$;

grant execute on function get_shop_customer_history(uuid) to authenticated;

-- যাচাই: ভর্তি নিশ্চিত স্টুডেন্ট, কতজনের ফি বসেছে, কতজন কাস্টমারের সাথে যুক্ত
select
  (select count(*) from enrollments where status = 'confirmed') as confirmed_students,
  (select count(*) from enrollments where status = 'confirmed' and fee_total is null) as without_fee,
  (select count(*) from enrollments where status = 'confirmed' and shop_customer_id is null) as unlinked_students;
