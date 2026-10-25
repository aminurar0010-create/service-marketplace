-- ফেজ ১.৩ — পূর্ণ ব্যাকআপ (v2)
-- সমস্যা: আগের export_full_backup() শুধু ৮টি টেবিল নিত (অর্ডার, সার্ভিস, ক্যাশ ইত্যাদি)।
--         POS বিক্রি, বাকি/পেমেন্ট, কাস্টমার খাতা, ইনভেন্টরি, কোটেশন, টিকিট, ট্রেনিং/ফি, ডে-ক্লোজ — এগুলো ব্যাকআপে ছিল না।
-- সমাধান: ফাংশনের নাম ও ব্যবহার একই (সেটিংস → ব্যাকআপ বোতাম অপরিবর্তিত), কিন্তু এখন public স্কিমার
--         সব টেবিল নিজে থেকে নেয়; ভবিষ্যতে নতুন টেবিল যোগ হলেও আপনা-আপনি ঢুকবে।
-- নিরাপদ: `create or replace` — একাধিকবার রান করা যায়। শুধু অ্যাডমিন চালাতে পারে (ভেতরে রোল-চেক)।
-- ফাইল/ছবি (Supabase Storage) এই JSON-এ নেই — সেগুলোর কথা BACKUP.md-এ।

create or replace function export_full_backup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := jsonb_build_object('exported_at', now());
  r record;
  v jsonb;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'শুধুমাত্র অ্যাডমিন ব্যাকআপ নিতে পারবেন';
  end if;

  for r in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
     order by c.relname
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', r.relname)
       into v;
    result := result || jsonb_build_object(r.relname, v);
  end loop;

  update site_settings set last_backup_at = now(), last_backup_by = auth.uid() where id = 1;

  return result;
end;
$$;

-- আগের নিয়ম বহাল: লগইন ছাড়া কল বন্ধ, লগইন করা অ্যাডমিন চালাতে পারবে
revoke execute on function export_full_backup() from public, anon;
grant execute on function export_full_backup() to authenticated;
