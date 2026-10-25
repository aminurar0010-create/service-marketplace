-- শুধু দেখার জন্য (কিছু বদলায় না) — নিরাপত্তা যাচাই। Supabase → SQL Editor-এ পুরোটা Run করুন।
-- প্রতিটি সারি একটি চেক। ফলটা আমাকে পাঠান।

-- ১) RLS বন্ধ থাকা টেবিল (ফাঁকা/"নেই" হওয়া উচিত)
select '১) RLS বন্ধ থাকা টেবিল' as check_name,
       coalesce(string_agg(c.relname, ', ' order by c.relname), 'নেই ✅') as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
-- ২) লগইন ছাড়া (anon) চালানো যায় এমন ফাংশন — সব ইচ্ছাকৃত কি না দেখতে
select '২) লগইন ছাড়া চালানো যায় এমন ফাংশন',
       coalesce(string_agg(p.proname || case when p.prosecdef then ' [security definer]' else '' end, ', ' order by p.proname), 'নেই ✅')
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and has_function_privilege('anon', p.oid, 'execute')

union all
-- ৩) লগইন ছাড়া ডাটা লেখা/বদলানো/মোছার পলিসি
select '৩) anon/public-এর লেখার পলিসি',
       coalesce(string_agg(tablename || ': ' || policyname || ' [' || cmd || ']', '; ' order by tablename), 'নেই ✅')
  from pg_policies
 where schemaname = 'public'
   and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   and (roles && array['anon'::name, 'public'::name])

union all
-- ৪) যেসব পলিসিতে শর্ত নেই (using true) — লেখার ধরনগুলো বিশেষভাবে দেখতে
select '৪) শর্তহীন (true) লেখার পলিসি',
       coalesce(string_agg(tablename || ': ' || policyname || ' [' || cmd || ']', '; ' order by tablename), 'নেই ✅')
  from pg_policies
 where schemaname = 'public'
   and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
   and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true');
