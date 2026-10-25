-- জরুরি প্যাচ: create_order-এর দাম-যাচাইয়ে product_variants.is_active কলাম আসল ডাটাবেসে নেই — তাই অর্ডার ব্যর্থ হচ্ছিল।
-- এই ফাইলটি শুধু সেই ফাংশনটি ঠিক করে (বাকি অংশ আগেই রান হয়ে গেছে)। একাধিকবার রান করা যায়।

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

