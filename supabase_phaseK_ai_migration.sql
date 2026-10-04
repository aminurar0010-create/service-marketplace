-- ============================================================
-- ফেজ K — AI গেটওয়ের ব্যবহার-সীমা (Gemini ফ্রি টিয়ারের সীমা পেরিয়ে না যেতে)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন। একাধিকবার রান করলেও সমস্যা নেই।
-- ⚠️ আগে ফেজ A–J রান করা থাকতে হবে।
--
-- কীভাবে কাজ করে:
--   • সার্ভার-ফাংশন (/api/ai) প্রতিবার Gemini-কে ডাকার আগে এই ফাংশন ডাকে
--   • ফাংশন রোল দেখে (ড্যাশবোর্ড-প্রশ্ন: শুধু অ্যাডমিন; খসড়া: অ্যাডমিন + কাউন্টার অপারেটর)
--   • একজন ইউজার দিনে সর্বোচ্চ ১২০টি, পুরো দোকান মিলিয়ে ৪০০টি (ঢাকা সময়ে দিন) — সংখ্যা নিচে বদলানো যায়
--   • কোনো লেখার বিষয়বস্তু এখানে জমানো হয় না — শুধু কে, কখন, কোন ধরনের
-- ============================================================

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('assist', 'draft')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_day_idx on ai_usage (created_at);
create index if not exists ai_usage_user_idx on ai_usage (user_id, created_at);

alter table ai_usage enable row level security;
-- কোনো পলিসি নেই: শুধু নিচের SECURITY DEFINER ফাংশন লিখতে/পড়তে পারে

create or replace function ai_use_quota(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_user_limit constant int := 120;
  c_global_limit constant int := 400;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_counter boolean;
  v_start timestamptz := ((now() at time zone 'Asia/Dhaka')::date::timestamp at time zone 'Asia/Dhaka');
  v_user_used int;
  v_global_used int;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'login');
  end if;
  if p_kind not in ('assist', 'draft') then
    return jsonb_build_object('allowed', false, 'reason', 'kind');
  end if;

  v_admin := is_admin(v_uid);
  v_counter := is_counter_operator(v_uid);
  if not (v_admin or (v_counter and p_kind = 'draft')) then
    return jsonb_build_object('allowed', false, 'reason', 'permission');
  end if;

  select count(*) into v_user_used from ai_usage where user_id = v_uid and created_at >= v_start;
  select count(*) into v_global_used from ai_usage where created_at >= v_start;
  if v_user_used >= c_user_limit then
    return jsonb_build_object('allowed', false, 'reason', 'user_limit', 'used', v_user_used, 'limit', c_user_limit);
  end if;
  if v_global_used >= c_global_limit then
    return jsonb_build_object('allowed', false, 'reason', 'global_limit', 'used', v_global_used, 'limit', c_global_limit);
  end if;

  insert into ai_usage (user_id, kind) values (v_uid, p_kind);
  return jsonb_build_object('allowed', true, 'used', v_user_used + 1, 'limit', c_user_limit);
end;
$$;

-- আজকের ব্যবহার দেখা (শুধু অ্যাডমিন)
create or replace function ai_usage_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz := ((now() at time zone 'Asia/Dhaka')::date::timestamp at time zone 'Asia/Dhaka');
begin
  if not is_admin(auth.uid()) then
    return jsonb_build_object('error', 'শুধু অ্যাডমিন');
  end if;
  return jsonb_build_object(
    'today', (select count(*) from ai_usage where created_at >= v_start),
    'assist', (select count(*) from ai_usage where created_at >= v_start and kind = 'assist'),
    'draft', (select count(*) from ai_usage where created_at >= v_start and kind = 'draft'),
    'last_7_days', (select count(*) from ai_usage where created_at >= v_start - interval '6 days')
  );
end;
$$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname in ('ai_use_quota', 'ai_usage_today')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- যাচাই
select p.proname as function_name, has_function_privilege('anon', p.oid, 'execute') as anon_can_run
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname in ('ai_use_quota', 'ai_usage_today')
 order by 1;
