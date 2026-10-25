-- ফেজ M (রাতের সারাংশ ও Telegram বট) বাতিল — ডাটাবেস পরিষ্কার
-- নিরাপদ: `if exists` তাই আগে রান না করা থাকলেও ভুল হবে না; একাধিকবার রান করা যায়।
-- কিছুই মুছে যায় না যা ওয়েবসাইট/অ্যাডমিন ব্যবহার করে — শুধু ফেজ M-এর নিজস্ব ফাংশন ও গোপন-কোড টেবিল।

drop function if exists owner_digest(text, date);
drop function if exists owner_query(text, text, date, date);
drop function if exists _owner_methods(date, date);
drop function if exists _owner_tickets(date);
drop function if exists _owner_bot_guard(text);
drop table if exists owner_bot_config;
