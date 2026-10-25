-- পরীক্ষা (সবসময় নিজে থেকে বাতিল হয়, কোনো অর্ডার থেকে যায় না):
-- আশা: ফলের লেখায় "success": false এবং "দাম মিলছে না" আসবে।
do $$
declare r jsonb;
begin
  set local role anon;
  r := public.create_order(
    (select id from public.services where is_active and price > 10 limit 1),
    'টেস্ট', '01700000000', null::text, 'cash', '[]'::jsonb, 1::numeric, null::text, false, '[]'::jsonb);
  raise exception 'ফল: %', r;
end $$;
