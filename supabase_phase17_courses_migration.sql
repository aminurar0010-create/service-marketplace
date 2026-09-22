-- ============================================================================
-- ফেজ ১৭ মাইগ্রেশন — ট্রেনিং কোর্স ও স্টুডেন্ট ভর্তি (Training Courses & Enrollments)
-- Supabase Dashboard → SQL Editor -এ পুরোটা কপি-পেস্ট করে Run করুন
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ১. courses টেবিল
-- ----------------------------------------------------------------------------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  duration_label text,            -- যেমন: "৩ মাস", "৬ মাস"
  fee numeric(10, 2) not null default 0,
  cover_image_url text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_slug_idx on courses (slug);
create index if not exists courses_active_order_idx on courses (is_active, display_order);

alter table courses enable row level security;

drop policy if exists "Anyone can view active courses" on courses;
create policy "Anyone can view active courses" on courses
  for select using (is_active = true);

drop policy if exists "Admins can manage courses" on courses;
create policy "Admins can manage courses" on courses
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ----------------------------------------------------------------------------
-- ২. course_modules টেবিল — প্রতিটি কোর্সের সিলেবাস/মডিউল তালিকা
-- ----------------------------------------------------------------------------
create table if not exists course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  description text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists course_modules_course_id_idx on course_modules (course_id, display_order);

alter table course_modules enable row level security;

drop policy if exists "Anyone can view modules of active courses" on course_modules;
create policy "Anyone can view modules of active courses" on course_modules
  for select using (exists (
    select 1 from courses c where c.id = course_modules.course_id and c.is_active = true
  ));

drop policy if exists "Admins can manage course modules" on course_modules;
create policy "Admins can manage course modules" on course_modules
  for all using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ----------------------------------------------------------------------------
-- ৩. enrollments টেবিল — স্টুডেন্ট ভর্তির আবেদন
-- ----------------------------------------------------------------------------
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  address text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists enrollments_course_id_idx on enrollments (course_id, created_at desc);
create index if not exists enrollments_status_idx on enrollments (status);

alter table enrollments enable row level security;

-- যে কেউ (লগইন ছাড়াই) ভর্তির আবেদন সাবমিট করতে পারবে
drop policy if exists "Anyone can submit an enrollment" on enrollments;
create policy "Anyone can submit an enrollment" on enrollments
  for insert with check (true);

drop policy if exists "Admins can view all enrollments" on enrollments;
create policy "Admins can view all enrollments" on enrollments
  for select using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins can update enrollments" on enrollments;
create policy "Admins can update enrollments" on enrollments
  for update using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins can delete enrollments" on enrollments;
create policy "Admins can delete enrollments" on enrollments
  for delete using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ----------------------------------------------------------------------------
-- ৪. ৫টি স্টার্টার কোর্স ও তাদের মডিউল — চাইলে অ্যাডমিন প্যানেল থেকে এডিট/ডিলিট করুন
-- ----------------------------------------------------------------------------
insert into courses (title, slug, summary, duration_label, fee, display_order, is_active) values
  ('Computer Office Application', 'computer-office-application', 'MS Office, ইন্টারনেট ব্রাউজিং ও বেসিক ট্রাবলশুটিং শিখুন', '৩ মাস', 3000, 1, true),
  ('Professional Graphic Design', 'professional-graphic-design', 'Photoshop, Illustrator ও ফ্রিল্যান্সিং শিখে ক্যারিয়ার শুরু করুন', '৪ মাস', 5000, 2, true),
  ('Web Design & Development', 'web-design-development', 'HTML, CSS, JavaScript থেকে React/Next.js পর্যন্ত সম্পূর্ণ কোর্স', '৬ মাস', 8000, 3, true),
  ('Digital Marketing', 'digital-marketing', 'SEO, ফেসবুক-গুগল অ্যাডস ও সোশ্যাল মিডিয়া মার্কেটিং', '৩ মাস', 4000, 4, true),
  ('Computer Hardware & Networking', 'computer-hardware-networking', 'পিসি অ্যাসেম্বলিং, উইন্ডোজ ইনস্টল ও নেটওয়ার্ক সেটআপ', '৩ মাস', 3500, 5, true)
on conflict (slug) do nothing;

insert into course_modules (course_id, title, display_order)
select c.id, m.title, m.ord
from courses c
join (values
  ('computer-office-application', 'MS Word', 1),
  ('computer-office-application', 'MS Excel', 2),
  ('computer-office-application', 'MS PowerPoint', 3),
  ('computer-office-application', 'MS Access', 4),
  ('computer-office-application', 'Internet Browsing', 5),
  ('computer-office-application', 'Basic Troubleshooting', 6),

  ('professional-graphic-design', 'Adobe Photoshop', 1),
  ('professional-graphic-design', 'Adobe Illustrator', 2),
  ('professional-graphic-design', 'UI/UX Basics', 3),
  ('professional-graphic-design', 'Freelancing Guidelines', 4),

  ('web-design-development', 'HTML', 1),
  ('web-design-development', 'CSS', 2),
  ('web-design-development', 'JavaScript', 3),
  ('web-design-development', 'React / Next.js', 4),
  ('web-design-development', 'Tailwind CSS', 5),
  ('web-design-development', 'Git / GitHub', 6),

  ('digital-marketing', 'SEO', 1),
  ('digital-marketing', 'Facebook Ads', 2),
  ('digital-marketing', 'Google Ads', 3),
  ('digital-marketing', 'Social Media Management', 4),
  ('digital-marketing', 'Content Marketing', 5),

  ('computer-hardware-networking', 'PC Assembling', 1),
  ('computer-hardware-networking', 'Windows Installation', 2),
  ('computer-hardware-networking', 'Network Setup', 3),
  ('computer-hardware-networking', 'Router Configuration', 4)
) as m(slug, title, ord) on m.slug = c.slug
where not exists (
  select 1 from course_modules cm where cm.course_id = c.id and cm.title = m.title
);
