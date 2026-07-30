-- =========================================================================
-- ফেজ ৪ মাইগ্রেশন — সিকিউরিটি ও সিস্টেম সেটিংস
-- Supabase Dashboard → SQL Editor → এই পুরো ফাইলটি পেস্ট করে Run করুন
-- (Bolt দিয়ে এই SQL চালাবেন না — টোকেন বাঁচবে)
-- =========================================================================

-- -------------------------------------------------------------------------
-- ১. site_settings টেবিল — লাইভ থিম/কালার ও ডেটা রিটেনশন কনফিগ
-- (সবসময় একটি মাত্র রো থাকবে, id = 1)
-- -------------------------------------------------------------------------
create table if not exists site_settings (
  id int primary key default 1,
  site_name text not null default 'সার্ভিস মার্কেটপ্লেস',

  -- থিম কালার (hex কোড, যেমন #1F4D3D)
  color_primary text not null default '#1F4D3D',
  color_secondary text not null default '#9A2B25',
  color_accent text not null default '#C08A28',
  color_background text not null default '#F7F3E8',

  -- ডেটা রিটেনশন পলিসি
  retention_completed_days int not null default 365,
  retention_cancelled_days int not null default 90,
  retention_documents_days int not null default 180,
  auto_purge_enabled boolean not null default false,
  last_purge_at timestamptz,
  last_purge_summary jsonb,

  -- ব্যাকআপ ট্র্যাকিং
  last_backup_at timestamptz,
  last_backup_by uuid references profiles(id),

  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),

  constraint single_row check (id = 1)
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;

drop policy if exists "Anyone can view site settings" on site_settings;
create policy "Anyone can view site settings" on site_settings
  for select using (true);

drop policy if exists "Admins can update site settings" on site_settings;
create policy "Admins can update site settings" on site_settings
  for update using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- -------------------------------------------------------------------------
-- ২. activity_logs টেবিল — অ্যাডমিন/স্টাফ অ্যাক্টিভিটি লগ
-- -------------------------------------------------------------------------
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  action text not null,
  entity_type text,
  entity_label text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on activity_logs (created_at desc);
create index if not exists activity_logs_actor_idx on activity_logs (actor_id);

alter table activity_logs enable row level security;

drop policy if exists "Staff and admin can insert activity logs" on activity_logs;
create policy "Staff and admin can insert activity logs" on activity_logs
  for insert with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','staff')
  ));

drop policy if exists "Admins can view activity logs" on activity_logs;
create policy "Admins can view activity logs" on activity_logs
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins can delete old activity logs" on activity_logs;
create policy "Admins can delete old activity logs" on activity_logs
  for delete using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- -------------------------------------------------------------------------
-- ৩. পূর্ণ ডেটা ব্যাকআপ ফাংশন (JSON এক্সপোর্ট) — শুধু অ্যাডমিন কল করতে পারবে
-- ফ্রন্টএন্ডের "এখনই ব্যাকআপ নাও" বাটন এই ফাংশন কল করে
-- -------------------------------------------------------------------------
create or replace function export_full_backup()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'শুধুমাত্র অ্যাডমিন ব্যাকআপ নিতে পারবেন';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profiles', (select coalesce(jsonb_agg(t), '[]'::jsonb) from profiles t),
    'services', (select coalesce(jsonb_agg(t), '[]'::jsonb) from services t),
    'orders', (select coalesce(jsonb_agg(t), '[]'::jsonb) from orders t),
    'coupons', (select coalesce(jsonb_agg(t), '[]'::jsonb) from coupons t
                where exists (select 1 from information_schema.tables where table_name = 'coupons')),
    'gallery_photos', (select coalesce(jsonb_agg(t), '[]'::jsonb) from gallery_photos t
                where exists (select 1 from information_schema.tables where table_name = 'gallery_photos')),
    'reviews', (select coalesce(jsonb_agg(t), '[]'::jsonb) from reviews t
                where exists (select 1 from information_schema.tables where table_name = 'reviews')),
    'cash_transactions', (select coalesce(jsonb_agg(t), '[]'::jsonb) from cash_transactions t
                where exists (select 1 from information_schema.tables where table_name = 'cash_transactions')),
    'site_settings', (select coalesce(jsonb_agg(t), '[]'::jsonb) from site_settings t)
  ) into result;

  update site_settings set last_backup_at = now(), last_backup_by = auth.uid() where id = 1;

  return result;
end;
$$;

-- -------------------------------------------------------------------------
-- ৪. ডেটা রিটেনশন পলিসি — পুরনো ডেটা মুছে ফেলার ফাংশন
-- retention_*_days সেটিংস অনুযায়ী পুরনো cancelled/completed অর্ডারের
-- ডকুমেন্ট রেফারেন্স (documents jsonb) সাফ করে ও অনেক পুরনো cancelled
-- অর্ডার স্থায়ীভাবে মুছে দেয়। p_dry_run = true দিলে শুধু প্রিভিউ
-- (কতগুলো প্রভাবিত হবে) দেখাবে, কিছু মুছবে না।
-- -------------------------------------------------------------------------
create or replace function cleanup_old_data(p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
as $$
declare
  settings site_settings%rowtype;
  v_docs_cleared int := 0;
  v_cancelled_deleted int := 0;
  v_completed_flagged int := 0;
  result jsonb;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'শুধুমাত্র অ্যাডমিন ডেটা রিটেনশন চালাতে পারবেন';
  end if;

  select * into settings from site_settings where id = 1;

  -- কতগুলো পুরনো ডকুমেন্ট-যুক্ত অর্ডার আছে (completed) যাদের ডকুমেন্ট মুছার সময় হয়েছে
  select count(*) into v_docs_cleared
  from orders
  where status = 'completed'
    and documents is not null and documents != '[]'::jsonb
    and updated_at < now() - (settings.retention_documents_days || ' days')::interval;

  -- কতগুলো পুরনো cancelled অর্ডার মুছে ফেলার যোগ্য
  select count(*) into v_cancelled_deleted
  from orders
  where status = 'cancelled'
    and updated_at < now() - (settings.retention_cancelled_days || ' days')::interval;

  -- কতগুলো পুরনো completed অর্ডার আর্কাইভ-যোগ্য (শুধু গণনা, মুছি না — আর্থিক রেকর্ড)
  select count(*) into v_completed_flagged
  from orders
  where status = 'completed'
    and updated_at < now() - (settings.retention_completed_days || ' days')::interval;

  if not p_dry_run then
    update orders
    set documents = '[]'::jsonb
    where status = 'completed'
      and documents is not null and documents != '[]'::jsonb
      and updated_at < now() - (settings.retention_documents_days || ' days')::interval;

    delete from orders
    where status = 'cancelled'
      and updated_at < now() - (settings.retention_cancelled_days || ' days')::interval;

    update site_settings
    set last_purge_at = now(),
        last_purge_summary = jsonb_build_object(
          'documents_cleared', v_docs_cleared,
          'cancelled_deleted', v_cancelled_deleted,
          'completed_flagged', v_completed_flagged
        )
    where id = 1;

    insert into activity_logs (actor_id, actor_name, action, entity_type, entity_label, details)
    values (
      auth.uid(),
      (select full_name from profiles where id = auth.uid()),
      'ডেটা রিটেনশন পার্জ চালানো হয়েছে',
      'system',
      'data_retention',
      jsonb_build_object(
        'documents_cleared', v_docs_cleared,
        'cancelled_deleted', v_cancelled_deleted,
        'completed_flagged', v_completed_flagged
      )
    );
  end if;

  result := jsonb_build_object(
    'dry_run', p_dry_run,
    'documents_cleared', v_docs_cleared,
    'cancelled_deleted', v_cancelled_deleted,
    'completed_flagged', v_completed_flagged
  );

  return result;
end;
$$;

-- -------------------------------------------------------------------------
-- ৫. (ঐচ্ছিক) সত্যিকারের অটোমেটেড শিডিউল — pg_cron এক্সটেনশন লাগবে
-- Supabase-এর কিছু প্ল্যানে এটি ডিফল্টভাবে এনাবল থাকে না।
-- Dashboard → Database → Extensions গিয়ে "pg_cron" এনাবল করুন,
-- তারপর নিচের কমান্ড রান করুন (একবারই যথেষ্ট):
--
--   select cron.schedule(
--     'daily-data-retention-cleanup',
--     '0 3 * * *',  -- প্রতিদিন রাত ৩টায়
--     $$ select cleanup_old_data(false) where (select auto_purge_enabled from site_settings where id = 1) $$
--   );
--
-- সিডিউল বাতিল করতে: select cron.unschedule('daily-data-retention-cleanup');
--
-- সত্যিকারের ফাইল-লেভেল ডাটাবেস ব্যাকআপ (pg_dump/PITR) Supabase-এর
-- Dashboard → Database → Backups থেকে Pro প্ল্যানে অটোমেটিক পাওয়া যায়।
-- এই মাইগ্রেশনের export_full_backup() অ্যাপ থেকে যেকোনো সময় ম্যানুয়াল
-- JSON ব্যাকআপ ডাউনলোডের জন্য, এবং pg_cron শিডিউল করা থাকলে
-- এটিকেও প্রতিদিন Storage বাকেটে সেভ করার জন্য একটি Edge Function
-- দিয়ে র‍্যাপ করা যায় (ঐচ্ছিক, README-এ বিস্তারিত)।
-- -------------------------------------------------------------------------
