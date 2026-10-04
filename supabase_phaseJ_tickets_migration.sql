-- ============================================================
-- ফেজ J — টিকিট রিকোয়েস্ট ডেস্ক (বাস / ট্রেন / বিমান)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন। একাধিকবার রান করলেও সমস্যা নেই।
-- ⚠️ আগে ফেজ A–I রান করা থাকতে হবে।
--
-- ধারণা: কাস্টমার অনুরোধ জানায় → আপনি নিজের এজেন্ট একাউন্টে বুক করেন → এখানে নম্বর/দাম বসান।
--   • বিক্রি একটা সাধারণ POS বিক্রি হয়ে যায় (ভাড়া + সার্ভিস চার্জ দুই লাইন) → বকেয়া, মাধ্যম, ক্যাশ-বুক, রিপোর্ট আগের নিয়মে
--   • আপনি প্ল্যাটফর্মকে যা দিলেন (কেনা দাম) ক্যাশ-বুকে ব্যয় 'টিকিট ক্রয়'
--   • লাভ = বিক্রির দাম − কেনা দাম
--   • যাত্রীর শুধু নাম রাখা হয় (NID/পাসপোর্ট নম্বর নয়)
-- ============================================================

create sequence if not exists ticket_no_seq;

create table if not exists ticket_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  ticket_type text not null check (ticket_type in ('bus', 'train', 'air')),
  from_place text not null check (length(trim(from_place)) between 1 and 80),
  to_place text not null check (length(trim(to_place)) between 1 and 80),
  travel_date date not null,
  travel_time text,
  passengers text,
  passenger_count int not null default 1 check (passenger_count between 1 and 20),
  shop_customer_id uuid references shop_customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  note text,
  source text not null default 'counter' check (source in ('counter', 'web')),
  status text not null default 'requested' check (status in ('requested', 'booked', 'delivered', 'cancelled')),
  platform text,
  ticket_ref text,
  fare numeric(12,2),
  service_charge numeric(12,2),
  sell_price numeric(12,2),
  cost_price numeric(12,2),
  platform_refund numeric(12,2) not null default 0,
  sale_id uuid references pos_sales(id) on delete set null,
  cost_cash_id uuid references cash_transactions(id) on delete set null,
  cancel_reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  booked_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz
);
create index if not exists ticket_requests_status_idx on ticket_requests (status, travel_date);
create index if not exists ticket_requests_customer_idx on ticket_requests (shop_customer_id);

alter table ticket_requests enable row level security;
drop policy if exists "Admin and counter view tickets" on ticket_requests;
create policy "Admin and counter view tickets" on ticket_requests
  for select using (is_admin(auth.uid()) or is_counter_operator(auth.uid()));
-- লেখা শুধু নিচের ফাংশন দিয়ে

-- cash_transactions — নতুন উৎস 'ticket_cost'
alter table cash_transactions drop constraint if exists cash_transactions_source_chk;
alter table cash_transactions add constraint cash_transactions_source_chk
  check (source in ('manual', 'pos', 'due_collection', 'online_order', 'course_fee', 'pos_refund', 'ticket_cost'));

-- ১) কাউন্টার থেকে অনুরোধ নথিভুক্ত (অ্যাডমিন + কাউন্টার অপারেটর)
create or replace function create_ticket_request(
  p_customer_id uuid, p_customer_name text, p_customer_phone text,
  p_type text, p_from text, p_to text, p_date date, p_time text,
  p_passengers text, p_passenger_count int, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_customer_name), '');
  v_phone text := nullif(trim(p_customer_phone), '');
  v_no text;
  v_id uuid;
begin
  if not (is_admin(auth.uid()) or is_counter_operator(auth.uid())) then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  if p_type not in ('bus', 'train', 'air') or coalesce(trim(p_from), '') = '' or coalesce(trim(p_to), '') = '' or p_date is null then
    return jsonb_build_object('success', false, 'message', 'ধরন, রুট ও যাত্রার তারিখ দিন');
  end if;
  if p_customer_id is not null then
    select name, phone into v_name, v_phone from shop_customers where id = p_customer_id;
    if v_name is null then
      return jsonb_build_object('success', false, 'message', 'কাস্টমার খুঁজে পাওয়া যায়নি');
    end if;
  end if;
  if v_name is null then
    return jsonb_build_object('success', false, 'message', 'কাস্টমারের নাম দিন');
  end if;

  v_no := 'TK-' || lpad(nextval('ticket_no_seq')::text, 6, '0');
  insert into ticket_requests (request_no, ticket_type, from_place, to_place, travel_date, travel_time, passengers, passenger_count,
                               shop_customer_id, customer_name, customer_phone, note, source, created_by)
  values (v_no, p_type, trim(p_from), trim(p_to), p_date, nullif(trim(p_time), ''), nullif(trim(p_passengers), ''),
          least(greatest(coalesce(p_passenger_count, 1), 1), 20), p_customer_id, v_name, v_phone, nullif(trim(p_note), ''), 'counter', auth.uid())
  returning id into v_id;
  return jsonb_build_object('success', true, 'id', v_id, 'request_no', v_no);
end;
$$;

-- ২) ওয়েবসাইট ফর্ম (লগইন ছাড়া) — স্প্যাম ঠেকাতে সীমা
create or replace function submit_ticket_request(
  p_name text, p_phone text, p_type text, p_from text, p_to text, p_date date,
  p_passengers text, p_passenger_count int, p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := normalize_phone(p_phone);
  v_no text;
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) > 80 or v_phone is null or length(v_phone) < 10 then
    return jsonb_build_object('success', false, 'message', 'নাম ও সঠিক মোবাইল নম্বর দিন');
  end if;
  if p_type not in ('bus', 'train', 'air') or coalesce(trim(p_from), '') = '' or coalesce(trim(p_to), '') = '' or p_date is null then
    return jsonb_build_object('success', false, 'message', 'ধরন, রুট ও যাত্রার তারিখ দিন');
  end if;
  if p_date < (now() at time zone 'Asia/Dhaka')::date or p_date > (now() at time zone 'Asia/Dhaka')::date + 365 then
    return jsonb_build_object('success', false, 'message', 'যাত্রার তারিখ সঠিক নয়');
  end if;
  if length(coalesce(p_passengers, '')) > 600 or length(coalesce(p_note, '')) > 600 or length(trim(p_from)) > 80 or length(trim(p_to)) > 80 then
    return jsonb_build_object('success', false, 'message', 'লেখা অনেক বড়');
  end if;
  -- সীমা: একই নম্বর থেকে ঘণ্টায় ৩টি, মোট ঘণ্টায় ৪০টি ওয়েব-অনুরোধ
  if (select count(*) from ticket_requests where source = 'web' and customer_phone = v_phone and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from ticket_requests where source = 'web' and created_at > now() - interval '1 hour') >= 40 then
    return jsonb_build_object('success', false, 'message', 'অনেক অনুরোধ হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন বা ফোন করুন');
  end if;

  v_no := 'TK-' || lpad(nextval('ticket_no_seq')::text, 6, '0');
  insert into ticket_requests (request_no, ticket_type, from_place, to_place, travel_date, passengers, passenger_count,
                               customer_name, customer_phone, note, source)
  values (v_no, p_type, trim(p_from), trim(p_to), p_date, nullif(trim(p_passengers), ''),
          least(greatest(coalesce(p_passenger_count, 1), 1), 20), trim(p_name), v_phone, nullif(trim(p_note), ''), 'web');
  return jsonb_build_object('success', true, 'request_no', v_no);
end;
$$;

-- ৩) বুকিং নিশ্চিত: বিক্রি তৈরি + কেনার ব্যয় + লাভ (শুধু অ্যাডমিন)
create or replace function confirm_ticket_booking(
  p_request_id uuid, p_platform text, p_ticket_ref text,
  p_fare numeric, p_service_charge numeric, p_cost numeric, p_cost_method text,
  p_payments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r ticket_requests;
  v_fare numeric := coalesce(p_fare, 0);
  v_sc numeric := coalesce(p_service_charge, 0);
  v_cost numeric := coalesce(p_cost, 0);
  v_phone text;
  v_cid uuid;
  v_items jsonb := '[]'::jsonb;
  v_label text;
  v_sale jsonb;
  v_ct uuid;
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('success', false, 'message', 'শুধু অ্যাডমিন বুকিং নিশ্চিত করতে পারেন');
  end if;
  select * into v_r from ticket_requests where id = p_request_id for update;
  if v_r.id is null then
    return jsonb_build_object('success', false, 'message', 'অনুরোধ পাওয়া যায়নি');
  end if;
  if v_r.status <> 'requested' then
    return jsonb_build_object('success', false, 'message', 'এই অনুরোধ আগেই প্রক্রিয়া হয়েছে');
  end if;
  if v_fare < 0 or v_sc < 0 or v_cost < 0 or v_fare + v_sc <= 0 then
    return jsonb_build_object('success', false, 'message', 'ভাড়া/চার্জ/কেনা দাম সঠিক নয়');
  end if;
  if v_cost > 0 and (p_cost_method is null or p_cost_method not in ('cash', 'bkash', 'nagad', 'rocket', 'other')) then
    return jsonb_build_object('success', false, 'message', 'কেনার পেমেন্ট মাধ্যম বাছুন');
  end if;
  if coalesce(trim(p_ticket_ref), '') = '' then
    return jsonb_build_object('success', false, 'message', 'টিকিট/PNR নম্বর দিন');
  end if;

  -- কাস্টমার প্রোফাইল (যাচাই-করা অ্যাডমিনের হাতে বলে এখানেই তৈরি হয়, ওয়েব-স্প্যামে নয়)
  v_cid := v_r.shop_customer_id;
  if v_cid is null then
    v_phone := normalize_phone(v_r.customer_phone);
    if v_phone is not null and length(v_phone) >= 10 then
      insert into shop_customers (name, phone) values (coalesce(nullif(trim(v_r.customer_name), ''), 'নামহীন'), v_phone)
      on conflict (phone) do nothing;
      select id into v_cid from shop_customers where phone = v_phone;
    end if;
  end if;

  v_label := case v_r.ticket_type when 'bus' then 'বাস' when 'train' then 'ট্রেন' else 'বিমান' end;
  if v_fare > 0 then
    v_items := v_items || jsonb_build_object('item_type', 'custom', 'item_ref_id', '',
      'item_name', format('%s টিকিট — %s → %s (%s)', v_label, v_r.from_place, v_r.to_place, to_char(v_r.travel_date, 'DD/MM/YYYY')),
      'quantity', 1, 'unit_price', v_fare);
  end if;
  if v_sc > 0 then
    v_items := v_items || jsonb_build_object('item_type', 'custom', 'item_ref_id', '',
      'item_name', 'টিকিট সার্ভিস চার্জ (' || v_r.request_no || ')', 'quantity', 1, 'unit_price', v_sc);
  end if;

  -- বিক্রি তৈরি (ব্যর্থ হলে এখানেই ফিরে যায়, কিছু লেখা হয়নি)
  v_sale := create_pos_sale_v2(v_items, v_cid, v_r.customer_name, v_r.customer_phone, 0, coalesce(p_payments, '[]'::jsonb));
  if not coalesce((v_sale->>'success')::boolean, false) then
    return v_sale;
  end if;

  if v_cost > 0 then
    insert into cash_transactions (entry_date, type, category, description, amount, payment_method, source, created_by)
    values ((now() at time zone 'Asia/Dhaka')::date, 'expense', 'টিকিট ক্রয',
            v_r.request_no || ' — ' || v_r.from_place || ' → ' || v_r.to_place || coalesce(' (' || nullif(trim(p_platform), '') || ')', ''),
            v_cost, p_cost_method, 'ticket_cost', auth.uid())
    returning id into v_ct;
  end if;

  update ticket_requests
     set status = 'booked', booked_at = now(), shop_customer_id = v_cid,
         platform = nullif(trim(p_platform), ''), ticket_ref = trim(p_ticket_ref),
         fare = v_fare, service_charge = v_sc, sell_price = v_fare + v_sc, cost_price = v_cost,
         sale_id = (v_sale->>'sale_id')::uuid, cost_cash_id = v_ct
   where id = p_request_id;

  return jsonb_build_object('success', true, 'invoice_no', v_sale->>'invoice_no', 'sell_price', v_fare + v_sc,
                            'profit', v_fare + v_sc - v_cost, 'due', (v_sale->>'due_amount')::numeric);
end;
$$;

-- ৪) ডেলিভারি হয়েছে (অ্যাডমিন + কাউন্টার অপারেটর)
create or replace function mark_ticket_delivered(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin(auth.uid()) or is_counter_operator(auth.uid())) then
    return jsonb_build_object('success', false, 'message', 'অনুমতি নেই');
  end if;
  update ticket_requests set status = 'delivered', delivered_at = now() where id = p_request_id and status = 'booked';
  if not found then
    return jsonb_build_object('success', false, 'message', 'শুধু "বুক হয়েছে" টিকিট ডেলিভারি করা যায়');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

-- ৫) বাতিল / ফেরত (শুধু অ্যাডমিন): কাস্টমারকে ফেরত (POS ফেরত) + প্ল্যাটফর্ম থেকে যা ফেরত পেলেন সেটা আয়
create or replace function cancel_ticket(p_request_id uuid, p_platform_refund numeric, p_refund_method text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r ticket_requests;
  v_refund numeric := coalesce(p_platform_refund, 0);
  v_res jsonb;
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('success', false, 'message', 'শুধু অ্যাডমিন বাতিল করতে পারেন');
  end if;
  select * into v_r from ticket_requests where id = p_request_id for update;
  if v_r.id is null or v_r.status = 'cancelled' then
    return jsonb_build_object('success', false, 'message', 'অনুরোধ নেই বা আগেই বাতিল');
  end if;
  if v_refund < 0 or (v_refund > 0 and (p_refund_method is null or p_refund_method not in ('cash', 'bkash', 'nagad', 'rocket', 'other'))) then
    return jsonb_build_object('success', false, 'message', 'ফেরতের পরিমাণ/মাধ্যম সঠিক নয়');
  end if;
  if v_refund > coalesce(v_r.cost_price, 0) then
    return jsonb_build_object('success', false, 'message', 'প্ল্যাটফর্মের ফেরত কেনা দামের বেশি হতে পারে না');
  end if;

  if v_r.sale_id is not null then
    v_res := refund_pos_sale(v_r.sale_id, 'টিকিট বাতিল ' || v_r.request_no || coalesce(' — ' || nullif(trim(p_reason), ''), ''));
    if not coalesce((v_res->>'success')::boolean, false) then
      return v_res;
    end if;
  end if;

  if v_refund > 0 then
    insert into cash_transactions (entry_date, type, category, description, amount, payment_method, source, created_by)
    values ((now() at time zone 'Asia/Dhaka')::date, 'income', 'টিকিট ক্রয় ফেরত', v_r.request_no || ' — প্ল্যাটফর্ম থেকে ফেরত',
            v_refund, p_refund_method, 'ticket_cost', auth.uid());
  end if;

  update ticket_requests
     set status = 'cancelled', cancelled_at = now(), cancel_reason = nullif(trim(p_reason), ''), platform_refund = v_refund
   where id = p_request_id;
  return jsonb_build_object('success', true);
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('create_ticket_request', 'submit_ticket_request', 'confirm_ticket_booking', 'mark_ticket_delivered', 'cancel_ticket')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.proname = 'submit_ticket_request' then
      execute format('grant execute on function %s to anon, authenticated', r.sig);   -- ওয়েব ফর্ম
    else
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- যাচাই
select p.proname as function_name, has_function_privilege('anon', p.oid, 'execute') as anon_can_run
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('create_ticket_request', 'submit_ticket_request', 'confirm_ticket_booking', 'mark_ticket_delivered', 'cancel_ticket')
 order by 1;
