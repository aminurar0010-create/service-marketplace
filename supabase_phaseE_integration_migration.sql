-- ============================================================
-- ফেজ E — Website Integration (অনলাইন অর্ডার ↔ shop_customers, কাস্টমার পোর্টাল)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন।
-- ⚠️ আগে ফেজ A, B, C-র SQL রান করা থাকতে হবে। একাধিকবার রান করলেও সমস্যা নেই।
--
-- কী হবে:
--   ১) অর্ডারের ফোন নম্বর পরে বদলালে (অ্যাডমিন এডিট) কাস্টমার-লিংকও অটো ঠিক হবে
--   ২) পুরনো যেসব অর্ডার/বিক্রি এখনো কাস্টমারের সাথে লিংক হয়নি, তাদের লিংক করা (একবার)
--   ৩) কাস্টমার পোর্টাল: অনলাইন অ্যাকাউন্টধারী নিজের দোকানের (POS) হিসাব ও বকেয়া দেখতে পারবে
--      নিজের প্রোফাইল দাবি (claim) করতে হয় ইনভয়েস নম্বর + মোট অঙ্ক (রশিদ থেকে) + অ্যাকাউন্টের ফোন মিলিয়ে
--      ভুল চেষ্টা সীমিত: ১ ঘণ্টায় ৫টির বেশি ভুল হলে আটকে যায়
-- ============================================================

-- ১) ফোন বদলালে রিলিংক
create or replace function relink_shop_customer_on_phone_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id uuid;
begin
  if normalize_phone(new.customer_phone) is not distinct from normalize_phone(old.customer_phone) then
    return new;
  end if;
  v_phone := normalize_phone(new.customer_phone);
  if v_phone is null or length(v_phone) < 10 then
    return new;
  end if;
  begin
    insert into shop_customers (name, phone)
    values (coalesce(nullif(trim(new.customer_name), ''), 'নামহীন'), v_phone)
    on conflict (phone) do nothing;
    select id into v_id from shop_customers where phone = v_phone;
    new.shop_customer_id := v_id;
  exception when others then
    null; -- আপডেট যেন কখনো আটকে না যায়
  end;
  return new;
end;
$$;

drop trigger if exists trg_orders_relink_shop_customer on orders;
create trigger trg_orders_relink_shop_customer
  before update of customer_phone on orders
  for each row execute function relink_shop_customer_on_phone_change();

drop trigger if exists trg_pos_sales_relink_shop_customer on pos_sales;
create trigger trg_pos_sales_relink_shop_customer
  before update of customer_phone on pos_sales
  for each row execute function relink_shop_customer_on_phone_change();

-- ২) এখনো লিংক হয়নি এমন পুরনো সারি
insert into shop_customers (name, phone)
select distinct on (t.p) coalesce(t.n, 'নামহীন'), t.p
from (
  select normalize_phone(customer_phone) as p, nullif(trim(customer_name), '') as n, created_at as at
    from orders where shop_customer_id is null
  union all
  select normalize_phone(customer_phone), nullif(trim(customer_name), ''), created_at
    from pos_sales where shop_customer_id is null
) t
where t.p is not null and length(t.p) >= 10
order by t.p, (t.n is null), t.at desc
on conflict (phone) do nothing;

update orders o set shop_customer_id = sc.id
from shop_customers sc
where o.shop_customer_id is null and normalize_phone(o.customer_phone) = sc.phone;

update pos_sales s set shop_customer_id = sc.id
from shop_customers sc
where s.shop_customer_id is null and normalize_phone(s.customer_phone) = sc.phone;

-- ৩) কাস্টমার পোর্টাল
create table if not exists shop_claim_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shop_claim_attempts_idx on shop_claim_attempts (user_id, created_at);
alter table shop_claim_attempts enable row level security;
-- কোনো পলিসি নেই: শুধু নিচের SECURITY DEFINER ফাংশন লিখতে/পড়তে পারে

create or replace function claim_shop_profile(p_invoice_no text, p_total numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_my_phone text;
  v_sc_id uuid;
  v_owner uuid;
  v_fails int;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'আগে লগইন করুন');
  end if;

  select count(*) into v_fails from shop_claim_attempts
   where user_id = v_uid and success = false and created_at > now() - interval '1 hour';
  if v_fails >= 5 then
    return jsonb_build_object('success', false, 'message', 'অনেকবার ভুল চেষ্টা হয়েছে। ১ ঘণ্টা পরে আবার চেষ্টা করুন বা দোকানে যোগাযোগ করুন');
  end if;

  select normalize_phone(phone) into v_my_phone from customers where id = v_uid;
  if v_my_phone is null or length(v_my_phone) < 10 then
    return jsonb_build_object('success', false, 'message', 'আগে প্রোফাইলে আপনার সঠিক ফোন নম্বর সেভ করুন');
  end if;

  select sc.id, sc.auth_user_id into v_sc_id, v_owner
    from pos_sales s
    join shop_customers sc on sc.id = s.shop_customer_id
   where upper(trim(s.invoice_no)) = upper(trim(p_invoice_no))
     and s.total_amount = p_total
     and sc.phone = v_my_phone
   limit 1;

  if v_sc_id is null then
    insert into shop_claim_attempts (user_id, success) values (v_uid, false);
    return jsonb_build_object('success', false, 'message', 'তথ্য মেলেনি। রশিদের ইনভয়েস নম্বর, মোট অঙ্ক ও আপনার প্রোফাইলের ফোন নম্বর মিলিয়ে দেখুন');
  end if;

  if v_owner is not null and v_owner <> v_uid then
    insert into shop_claim_attempts (user_id, success) values (v_uid, false);
    return jsonb_build_object('success', false, 'message', 'এই হিসাব অন্য অ্যাকাউন্টের সাথে যুক্ত — দোকানে যোগাযোগ করুন');
  end if;

  update shop_customers set auth_user_id = v_uid where id = v_sc_id and auth_user_id is null;
  insert into shop_claim_attempts (user_id, success) values (v_uid, true);
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function claim_shop_profile(text, numeric) to authenticated;

create or replace function get_my_shop_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sc shop_customers;
begin
  if v_uid is null then
    return jsonb_build_object('linked', false);
  end if;
  select * into v_sc from shop_customers where auth_user_id = v_uid limit 1;
  if v_sc.id is null then
    return jsonb_build_object('linked', false);
  end if;

  return jsonb_build_object(
    'linked', true,
    'customer_code', v_sc.customer_code,
    'name', v_sc.name,
    'total_due', coalesce((select sum(due_amount) from pos_sales where shop_customer_id = v_sc.id and status = 'completed'), 0),
    'sales', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
          'invoice_no', s.invoice_no, 'created_at', s.created_at,
          'total', s.total_amount, 'paid', s.paid_amount, 'due', s.due_amount,
          'items', coalesce((select string_agg(i.item_name, ', ') from pos_sale_items i where i.sale_id = s.id), '')
        ) as x
        from pos_sales s
        where s.shop_customer_id = v_sc.id and s.status = 'completed'
        order by s.created_at desc limit 100
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function get_my_shop_account() to authenticated;

-- যাচাই
select
  (select count(*) from orders where shop_customer_id is null and length(coalesce(normalize_phone(customer_phone), '')) >= 10) as orders_unlinked,
  (select count(*) from pos_sales where shop_customer_id is null and length(coalesce(normalize_phone(customer_phone), '')) >= 10) as pos_unlinked,
  (select count(*) from (select phone from shop_customers group by phone having count(*) > 1) d) as duplicate_phones;
