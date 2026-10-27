-- ফেজ ৪-গ — "জনপ্রিয় সেবা" চিহ্ন
-- হোমের সার্ভিস তালিকায় যেসব সেবা অ্যাডমিন "জনপ্রিয়" টিক দেবেন, সেগুলো সবার উপরে আলাদা অংশে দেখাবে।
-- নিরাপদ: `if not exists`; একাধিকবার রান করা যায়; আগের কোনো সারি বদলায় না; RLS অপরিবর্তিত।
alter table services add column if not exists is_popular boolean not null default false;
