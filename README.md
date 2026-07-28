# Service Marketplace - সেবা মার্কেটপ্লেস

একটি সম্পূর্ণ সেবা বিক্রয় প্ল্যাটফর্ম যা অর্ডার ম্যানেজমেন্ট, পেমেন্ট ইন্টিগ্রেশন এবং রিয়েল-টাইম ট্র্যাকিং সমর্থন করে।

## 🚀 বৈশিষ্ট্যসমূহ

### গ্রাহক দিক
- ✅ ডায়নামিক সার্ভিস ক্যাটালগ
- ✅ সহজ অর্ডার ফর্ম
- ✅ ডকুমেন্ট আপলোড সাপোর্ট
- ✅ একাধিক পেমেন্ট পদ্ধতি (বিকাশ, নগদ, রকেট)
- ✅ রিয়েল-টাইম অর্ডার ট্র্যাকিং

### অ্যাডমিন দিক
- ✅ অ্যাডমিন লগইন (Supabase Auth)
- ✅ সম্পূর্ণ অর্ডার ম্যানেজমেন্ট
- ✅ অর্ডার স্ট্যাটাস আপডেট
- ✅ বিক্রয় ড্যাশবোর্ড ও পরিসংখ্যান
- ✅ রিয়েল-টাইম অর্ডার আপডেট

## 📋 প্রযুক্তি স্ট্যাক

- **ফ্রন্টএন্ড**: React 18 + Vite + TypeScript + Tailwind CSS
- **ব্যাকএন্ড**: Supabase (PostgreSQL + Auth)
- **স্টোরেজ**: Supabase Storage (ডকুমেন্ট)
- **হোস্টিং**: Vercel (অটো-ডিপ্লয়)

## 🔧 সেটআপ গাইড

### ধাপ ১: প্রয়োজনীয় অ্যাকাউন্ট তৈরি করুন

1. **Supabase Account**
   - [supabase.com](https://supabase.com) -এ সাইন আপ করুন
   - নতুন প্রজেক্ট তৈরি করুন
   - অঞ্চল: Singapore (এশিয়ায় দ্রুত গতি)

2. **GitHub Account**
   - [github.com](https://github.com) -এ সাইন আপ করুন
   - এই রিপোজিটরি ফর্ক করুন

3. **Vercel Account**
   - [vercel.com](https://vercel.com) -এ সাইন আপ করুন
   - GitHub অ্যাকাউন্ট দিয়ে কানেক্ট করুন

### ধাপ ২: Supabase ডাটাবেস সেটআপ করুন

1. Supabase ড্যাশবোর্ড খুলুন
2. SQL Editor → নতুন কোয়েরি তৈরি করুন
3. এই SQL কোড পেস্ট করুন:

```sql
-- ১. profiles টেবিল (অ্যাডমিন/স্টাফ)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile" on profiles
for select using (auth.uid() = id);

-- ২. services টেবিল
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  category text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table services enable row level security;

create policy "Anyone can view active services" on services
for select using (is_active = true);

-- ৩. orders টেবিল
create table orders (
  id uuid primary key default gen_random_uuid(),
  tracking_id text unique not null default substr(replace(gen_random_uuid()::text,'-',''),1,10),
  service_id uuid references services(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  documents jsonb default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled')),
  payment_method text,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  total_amount numeric(10,2) not null default 0,
  assigned_staff_id uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table orders enable row level security;

create policy "Anyone can create an order" on orders
for insert with check (true);

-- ৪. Storage বাকেট
insert into storage.buckets (id, name, public)
values ('order-documents', 'order-documents', false)
on conflict do nothing;

create policy "Anyone can upload documents" on storage.objects
for insert with check (bucket_id = 'order-documents');
```

### ধাপ ৩: স্টার্টার ডেটা যোগ করুন

```sql
-- সার্ভিস যোগ করুন
INSERT INTO services (name, description, price, category) VALUES
('প্যাসপোর্ট ভিসা প্রসেসিং', 'ভারত ভ্রমণ ভিসার জন্য আবেদন ও ডকুমেন্ট প্রসেসিং', 5000, 'ভিসা'),
('বাড়ি মেরামত', 'ঘর রং করা ও মেরামত সেবা', 3000, 'বিল্ডিং'),
('ওয়েবসাইট ডিজাইন', 'আধুনিক এবং দ্রুত ওয়েবসাইট তৈরি', 15000, 'আইটি'),
('গ্রাফিক ডিজাইন', 'লোগো, ব্যানার এবং ডিজাইন সেবা', 8000, 'ডিজাইন'),
('কন্টেন্ট রাইটিং', 'ব্লগ পোস্ট, SEO লেখা এবং বিষয়বস্তু', 2000, 'মার্কেটিং');
```

### ধাপ ৪: পরিবেশ ভেরিয়েবল সেট করুন

`.env` ফাইল তৈরি করুন:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

আপনার Supabase URL এবং Anon Key খুঁজে পেতে:
- Settings → API → URL এবং anon key

### ধাপ ৫: স্থানীয়ভাবে চালান

```bash
# প্যাকেজ ইনস্টল করুন
npm install

# উন্নয়ন সার্ভার চালান
npm run dev

# ব্রাউজারে খুলুন
open http://localhost:5173
```

### ধাপ ৬: অ্যাডমিন অ্যাকাউন্ট তৈরি করুন

1. Supabase Authentication → Users → Add user
2. ইমেইল এবং পাসওয়ার্ড দিন
3. এই ইউজার আইডি দিয়ে profiles টেবিলে রেকর্ড তৈরি করুন:

```sql
INSERT INTO profiles (id, full_name, phone, role) 
VALUES ('user-uuid-here', 'Admin Name', '01700000000', 'admin');
```

### ধাপ ৭: GitHub এবং Vercel-এ ডিপ্লয় করুন

1. GitHub-এ নতুন রিপোজিটরি তৈরি করুন
2. কোড পুশ করুন:
```bash
git add .
git commit -m "Initial commit - Service Marketplace Phase 1"
git push origin main
```

3. Vercel-এ লগইন করুন
4. "New Project" → GitHub রিপোজিটরি নির্বাচন করুন
5. Environment Variables যোগ করুন:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy করুন

## 📱 ব্যবহার

### গ্রাহক
1. হোম পেজে সার্ভিস ব্রাউজ করুন
2. সেবা নির্বাচন করে "অর্ডার করুন" ক্লিক করুন
3. ফর্ম পূরণ করুন এবং ডকুমেন্ট আপলোড করুন
4. সাবমিট করলে ট্র্যাকিং আইডি পাবেন
5. "ট্র্যাক করুন" পেজে ট্র্যাকিং আইডি দিয়ে স্ট্যাটাস দেখুন

### অ্যাডমিন
1. অ্যাডমিন লগইন পেজে যান
2. ইমেইল এবং পাসওয়ার্ড দিয়ে লগইন করুন
3. ড্যাশবোর্ডে সকল অর্ডার দেখুন
4. অর্ডার স্ট্যাটাস আপডেট করুন

## 🎯 পরবর্তী ফেজের পরিকল্পনা

### ফেজ ২: অটোমেশন
- অটোমেটিক টাস্ক অ্যাসাইনমেন্ট
- স্টাফ পারফরম্যান্স ট্র্যাকিং
- ইন্টারনাল মেসেজিং

### ফেজ ৩: CRM ও ফিন্যান্স
- কুপন সিস্টেম
- লয়ালটি পয়েন্ট
- মান্থলি রিপোর্ট

### ফেজ ৪-৬
- সিকিউরিটি আপগ্রেড
- মাল্টি-ল্যাঙ্গুয়েজ
- এআই ইন্টিগ্রেশন

## 📞 সাপোর্ট

সমস্যা হলে:
1. GitHub Issues এ রিপোর্ট করুন
2. Supabase ডকুমেন্টেশন দেখুন
3. আপনার Supabase লগ চেক করুন

## 📄 লাইসেন্স

MIT License - মুক্তভাবে ব্যবহার করুন

---

**দ্রুত শুরু করুন!** এই স্টার্টার কোড দিয়ে আপনার সার্ভিস মার্কেটপ্লেস চালু করতে পারবেন।
