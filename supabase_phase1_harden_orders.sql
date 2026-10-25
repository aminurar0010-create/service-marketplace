-- ফেজ ১.৪ (ক্রমানুযায়ী পরবর্তী ধাপ) — অর্ডার ফাংশনের নিরাপত্তা কড়া করা
-- সমস্যা (আসল ফাংশনের কোড দেখে পাওয়া):
--   ১) create_order গ্রাহকের পাঠানো দাম (p_total_amount) অন্ধভাবে বিশ্বাস করে — কেউ ৳১ বসিয়ে অর্ডার দিতে পারত।
--   ২) পুরনো ৭- ও ৮-প্যারামিটারের create_order এখনো লগইন ছাড়া ডাকা যেত — নতুনটা কড়া করলেও ওগুলো দিয়ে এড়ানো যেত।
--   ৩) save_order_variants যে কেউ যেকোনো অর্ডারে (ট্র্যাকিং নম্বর আন্দাজ করে) ভ্যারিয়েন্ট বদলাতে পারত।
--   ৪) security definer ফাংশনগুলোতে search_path বাঁধা ছিল না।
-- নিরাপদ: `create or replace` / `if exists`; একাধিকবার রান করা যায়; গ্রাহকের ফর্ম ও অ্যাডমিন কুইক-অর্ডারের কাজ অপরিবর্তিত।
-- স্টাফ (admin/staff/counter_operator) কুইক-অর্ডারে ইচ্ছামতো দাম বসাতে পারবেন — বাধা শুধু লগইন-ছাড়া/সাধারণ গ্রাহকের জন্য।

-- ১) create_order (যেটা সাইট ও কুইক-অর্ডার ব্যবহার করে): ন্যূনতম দাম যাচাই
create or replace function public.create_order(
  p_service_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_payment_method text, p_documents jsonb, p_total_amount numeric, p_coupon_code text,
  p_is_urgent boolean default false, p_custom_field_responses jsonb default '[]'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_tracking_id text;
  v_order_id uuid;
  v_discount numeric := 0;
  v_final_amount numeric := p_total_amount;
  v_validation jsonb;
  v_coupon_id uuid;
  v_urgent_type text;
  v_urgent_value numeric;
  v_urgent_hours integer;
  v_urgent_fee numeric := 0;
  v_deadline timestamptz := null;
  v_service_price numeric;
  v_min_delta numeric;
  v_is_staff boolean;
begin
  -- ★ নতুন: দাম যাচাই (শুধু স্টাফ নন এমন কলারের জন্য)
  v_is_staff := exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'staff', 'counter_operator')
  );

  if not v_is_staff then
    select coalesce(price, 0) into v_service_price from services where id = p_service_id;
    if not found then
      return jsonb_build_object('success', false, 'message', 'সার্ভিসটি পাওয়া যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
    end if;

    -- সবচেয়ে কম সম্ভাব্য ভ্যারিয়েন্ট-ছাড় (কোনো গ্রুপে ঋণাত্মক পার্থক্য থাকলে সেটা ধরা হয়)।
    -- ভ্যারিয়েন্ট টেবিল/কলামে সমস্যা থাকলেও অর্ডার আটকাবে না — তখন শুধু সার্ভিসের দাম ধরা হয়।
    begin
      select coalesce(sum(least(0, g.min_delta)), 0) into v_min_delta
        from (select min(price_delta) as min_delta
                from product_variants
               where service_id = p_service_id
               group by variant_group) g;
    exception when undefined_column or undefined_table then
      v_min_delta := 0;
    end;

    if p_total_amount is null or p_total_amount < (v_service_price + v_min_delta) - 0.5 then
      return jsonb_build_object('success', false, 'message', 'দাম মিলছে না। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।');
    end if;
  end if;

  -- ↓↓ এখান থেকে আগের ফাংশনের হুবহু কোড ↓↓
  if p_coupon_code is not null and p_coupon_code != '' then
    v_validation := validate_coupon(p_coupon_code, p_service_id, p_total_amount, p_customer_phone);

    if (v_validation->>'valid')::boolean = false then
      return jsonb_build_object('success', false, 'message', v_validation->>'message');
    end if;

    v_discount := (v_validation->>'discount_amount')::numeric;
    v_final_amount := (v_validation->>'final_amount')::numeric;

    select id into v_coupon_id from coupons where code = upper(p_coupon_code);
  end if;

  select urgent_fee_type, urgent_fee_value, urgent_delivery_hours
    into v_urgent_type, v_urgent_value, v_urgent_hours
    from services where id = p_service_id;

  if p_is_urgent and v_urgent_type is not null and v_urgent_value is not null then
    if v_urgent_type = 'percentage' then
      v_urgent_fee := round(p_total_amount * v_urgent_value / 100, 2);
    else
      v_urgent_fee := v_urgent_value;
    end if;
    v_final_amount := v_final_amount + v_urgent_fee;
  end if;

  if p_is_urgent and v_urgent_hours is not null then
    v_deadline := now() + (v_urgent_hours || ' hours')::interval;
  end if;

  v_tracking_id := 'TRK' || to_char(now(), 'YYYYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');

  insert into orders (
    tracking_id, service_id, customer_name, customer_phone, customer_email,
    documents, status, payment_method, payment_status, total_amount,
    coupon_code, discount_amount, is_urgent, urgent_fee, custom_field_responses, deadline_at
  ) values (
    v_tracking_id, p_service_id, p_customer_name, p_customer_phone, p_customer_email,
    p_documents, 'pending', p_payment_method, 'unpaid', v_final_amount,
    p_coupon_code, v_discount, p_is_urgent, v_urgent_fee, p_custom_field_responses, v_deadline
  )
  returning id into v_order_id;

  if v_coupon_id is not null then
    insert into coupon_usages (coupon_id, order_id, customer_phone, discount_amount)
    values (v_coupon_id, v_order_id, p_customer_phone, v_discount);

    update coupons set used_count = used_count + 1 where id = v_coupon_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'tracking_id', v_tracking_id,
    'discount_amount', v_discount,
    'urgent_fee', v_urgent_fee,
    'final_amount', v_final_amount
  );
end;
$function$;

-- ২) পুরনো ৭- ও ৮-প্যারামিটারের create_order বন্ধ (দাম-যাচাই এড়ানোর পথ)।
--    মোছা হচ্ছে না — শুধু কল করার অনুমতি তোলা; ফেরাতে নিচে "ফেরানো" অংশ দেখুন।
do $$
begin
  if to_regprocedure('public.create_order(uuid,text,text,text,text,jsonb,numeric)') is not null then
    revoke execute on function public.create_order(uuid,text,text,text,text,jsonb,numeric) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.create_order(uuid,text,text,text,text,jsonb,numeric,text)') is not null then
    revoke execute on function public.create_order(uuid,text,text,text,text,jsonb,numeric,text) from public, anon, authenticated;
  end if;
end $$;

-- ৩) save_order_variants: শুধু নতুন অর্ডারে (২ ঘণ্টার মধ্যে) এবং ভ্যারিয়েন্ট এখনো ফাঁকা থাকলে
create or replace function public.save_order_variants(p_tracking_id text, p_selected_variants jsonb)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
begin
  update orders
     set selected_variants = coalesce(p_selected_variants, '[]'::jsonb)
   where tracking_id = p_tracking_id
     and (selected_variants is null or selected_variants = '[]'::jsonb)
     and created_at > now() - interval '2 hours';
end;
$function$;

-- ৪) search_path বাঁধা (বাকি security definer ফাংশনে)
alter function public.get_customer_order_history(text) set search_path = public;
alter function public.get_order_status(text)           set search_path = public;
alter function public.link_order_to_customer(text)     set search_path = public;
alter function public.auto_assign_order(uuid)          set search_path = public;

-- ─────────────────────────────────────────────────────────────
-- ফেরানো (কিছু ভাঙলে, শুধু দরকারি অংশটুকু):
--   grant execute on function public.create_order(uuid,text,text,text,text,jsonb,numeric) to anon, authenticated;
--   grant execute on function public.create_order(uuid,text,text,text,text,jsonb,numeric,text) to anon, authenticated;
-- ─────────────────────────────────────────────────────────────
