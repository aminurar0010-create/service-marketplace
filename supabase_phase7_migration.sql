-- ============================================================================
-- ফেজ ৭ মাইগ্রেশন — ইউজার অ্যাকাউন্ট ও কনটেন্ট ম্যানেজমেন্ট
-- Supabase Dashboard → SQL Editor -এ পুরোটা কপি-পেস্ট করে Run করুন
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ১. customers টেবিল — রেজিস্টার্ড কাস্টমার প্রোফাইল (auth.users এর সাথে লিংকড)
-- ----------------------------------------------------------------------------
create table if not exists customers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table customers enable row level security;

drop policy if exists "Customers can view own profile" on customers;
create policy "Customers can view own profile" on customers
  for select using (auth.uid() = id);

drop policy if exists "Customers can update own profile" on customers;
create policy "Customers can update own profile" on customers
  for update using (auth.uid() = id and is_blocked = false);

drop policy if exists "Customers can insert own profile" on customers;
create policy "Customers can insert own profile" on customers
  for insert with check (auth.uid() = id);

drop policy if exists "Admins can view all customers" on customers;
create policy "Admins can view all customers" on customers
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins can update all customers" on customers;
create policy "Admins can update all customers" on customers
  for update using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ----------------------------------------------------------------------------
-- ২. orders টেবিলে customer_id যোগ — লগইন করা কাস্টমারের অর্ডার হিস্ট্রির জন্য
-- ----------------------------------------------------------------------------
alter table orders add column if not exists customer_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_id_idx on orders (customer_id);

drop policy if exists "Customers can view own orders" on orders;
create policy "Customers can view own orders" on orders
  for select using (auth.uid() = customer_id);

-- ----------------------------------------------------------------------------
-- ৩. blog_posts টেবিল
-- ----------------------------------------------------------------------------
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  cover_image_url text,
  author_name text default 'অ্যাডমিন',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_slug_idx on blog_posts (slug);
create index if not exists blog_posts_published_idx on blog_posts (is_published, created_at desc);

alter table blog_posts enable row level security;

drop policy if exists "Anyone can view published posts" on blog_posts;
create policy "Anyone can view published posts" on blog_posts
  for select using (is_published = true);

drop policy if exists "Admins can manage blog posts" on blog_posts;
create policy "Admins can manage blog posts" on blog_posts
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ----------------------------------------------------------------------------
-- ৪. ai_prompts টেবিল — AI প্রম্পট লাইব্রেরি
-- ----------------------------------------------------------------------------
create table if not exists ai_prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'সাধারণ',
  description text,
  prompt_text text not null,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_prompts_active_idx on ai_prompts (is_active, display_order);

alter table ai_prompts enable row level security;

drop policy if exists "Anyone can view active prompts" on ai_prompts;
create policy "Anyone can view active prompts" on ai_prompts
  for select using (is_active = true);

drop policy if exists "Admins can manage prompts" on ai_prompts;
create policy "Admins can manage prompts" on ai_prompts
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ----------------------------------------------------------------------------
-- ৫. site_settings-এ ওয়েবসাইট কন্টেন্ট কলাম যোগ (ব্যানার, নোটিশ, যোগাযোগ তথ্য)
-- ----------------------------------------------------------------------------
alter table site_settings add column if not exists banner_enabled boolean not null default false;
alter table site_settings add column if not exists banner_text text;
alter table site_settings add column if not exists banner_link text;
alter table site_settings add column if not exists notice_enabled boolean not null default false;
alter table site_settings add column if not exists notice_text text;
alter table site_settings add column if not exists contact_phone text;
alter table site_settings add column if not exists contact_whatsapp text;
alter table site_settings add column if not exists contact_email text;
alter table site_settings add column if not exists contact_address text;
alter table site_settings add column if not exists contact_facebook text;
alter table site_settings add column if not exists contact_map_embed_url text;

-- ----------------------------------------------------------------------------
-- ৬. লগইন করা কাস্টমার অর্ডার করলে সেটি তার অ্যাকাউন্টের সাথে লিংক করার ফাংশন
--    (বিদ্যমান create_order ফাংশন স্পর্শ না করেই, অর্ডার তৈরির পর কল করা হবে)
-- ----------------------------------------------------------------------------
create or replace function link_order_to_customer(p_tracking_id text)
returns void
language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update orders
  set customer_id = auth.uid()
  where tracking_id = p_tracking_id
    and customer_id is null;
end;
$$;

-- ----------------------------------------------------------------------------
-- ৭. গ্রাহক নিজের অর্ডার হিস্ট্রি + ইনভয়েসের জন্য সার্ভিস নাম সহ ভিউ
-- ----------------------------------------------------------------------------
create or replace view my_orders_view
  with (security_invoker = true) as
select o.*, s.name as service_name, s.category as service_category
from orders o
left join services s on s.id = o.service_id
where o.customer_id = auth.uid();

-- ============================================================================
-- সম্পন্ন — এই ব্লকটি একসাথে রান করলে ফেজ ৭-এর সব টেবিল, কলাম ও পলিসি তৈরি হয়ে যাবে
-- ============================================================================
