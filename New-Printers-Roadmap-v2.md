# 🏢 নিউ প্রিন্টার্স — আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার
## Roadmap v2 — "এক Claude অ্যাকাউন্ট = এক ফেজ" পদ্ধতি

> **এই ফাইলটি নতুন Claude অ্যাকাউন্টের প্রথম মেসেজে সংযুক্ত করুন** (সাথে নিচের "Handoff Prompt")।
> পুরো ভিশন আগের রোডম্যাপের মতোই আছে — শুধু কাজগুলো ছোট ছোট ফেজে ভাগ করা হয়েছে যেন প্রতিটি ফেজ একটি অ্যাকাউন্টের লিমিটের ভেতরে শেষ হয়।

---

## 📍 STATUS (প্রতিটি ফেজ শেষে এই অংশ আপডেট করতে হবে)

| ফেজ | বিষয় | অবস্থা |
|---|---|---|
| ০ | বর্তমান সাইটের অবস্থা (নিচে লেখা) | ✅ যাচাই হয়েছে |
| A | Unified Customer System (ফোন-ভিত্তিক) | ✅ সম্পন্ন (GitHub push হয়েছে, commit 3dab090) |
| B | Counter Sales v2 (Due/Partial Payment + Invoice No.) | ✅ সম্পন্ন (push হয়েছে, commit f8e552b; SQL রান ও লাইভে কাজ করছে — মালিক নিশ্চিত করেছেন) |
| C | Business Accounting (Due আদায়, Cashbook সংযোগ, Expense) | ✅ কোড সম্পন্ন ও push হয়েছে (SQL রান + লাইভ টেস্ট বাকি — নিচে দেখুন) |
| D | Reports (Daily/Monthly/Service/Customer/Staff) | ⬜ বাকি |
| E | Website Integration + Global Search + ব্র্যান্ডিং | ⬜ বাকি |
| F | Training Management (Attendance, Fee, Certificate) | ⬜ বাকি |
| G | Staff Permission, Security ও Mobile পালিশ | ⬜ বাকি |
| H | AI Business Assistant ও Smart Automation | ⬜ বাকি |

**বর্তমান ফেজ:** D — (ফেজ C-র SQL `supabase_phaseC_accounting_migration.sql` Supabase-এ রান করে লাইভে টেস্ট করার পর শুরু করুন)।
**রিপো:** `aminurar0010-create/service-marketplace`, branch `main`, সর্বশেষ ফেজ C commit দেখুন (git log)

**ফেজ A — স্থায়ী তথ্য (পরের ফেজগুলোর জন্য জরুরি)**
- SQL: `supabase_phaseA_shop_customers_migration.sql`; কাস্টমার টেবিল `shop_customers` (phone unique, normalized `01XXXXXXXXX`, কোড `NP-0001`)
- `orders` টেবিলে আগে থেকেই `customer_id` (অনলাইন লগইন কাস্টমার) আছে, তাই নতুন লিংক কলামের নাম **`shop_customer_id`** (orders ও pos_sales দুটোতেই)
- ট্রিগার `link_shop_customer()` নতুন অর্ডার/POS বিক্রিতে ফোন ধরে কাস্টমার অটো তৈরি/লিংক করে (→ ফেজ E1 প্রায় আগেই হয়ে গেছে)
- `shop_customer_summary` view (security_invoker) ও RPC `get_shop_customer_history()`
- VIP/ব্লক/ট্যাগ/নোট এখনো পুরনো `customer_order_summary` view ও `upsert_customer_ledger()` RPC দিয়ে চলে (এগুলোর SQL জিপে নেই, শুধু ডাটাবেসে আছে)
- `CustomerPicker` (+ `CustomerCreateForm`) `src/components/CustomerPicker.tsx`-এ; `normalizePhone` `src/lib/phone.ts`-এ

**ফেজ B — কী হয়েছে**
- SQL: `supabase_phaseB_counter_sales_v2_migration.sql` (পুরনো `create_pos_sale()` অক্ষত; নতুন ফাংশন **`create_pos_sale_v2`** — তাই রান/ডিপ্লয়ের ক্রমে POS বন্ধ হয় না)
- `pos_sales`-এ নতুন: `invoice_no` (`INV-000001` সিরিজ, পুরনো বিক্রিতেও বসানো), `paid_amount`, `due_amount` (পুরনো সব বিক্রি = পুরো পরিশোধিত)
- নতুন টেবিল `sale_payments` (sale_id, method [cash/bkash/nagad/rocket/other], amount, `kind` = `sale` | `due_collection` ← **ফেজ C-র Due আদায় এখানেই `due_collection` হিসেবে যাবে**)
- ক্যাশ-বুকে এখন শুধু **পেইড অংশ** আয় হিসেবে যায় (Due নয়); `entry_date` ঢাকা সময় অনুযায়ী
- `shop_customer_summary.total_due` এখন সত্যিকারের বকেয়া (`sum(pos_sales.due_amount)`); "মোট খরচ" এখনো বাতিল বাদে অর্ডার + সম্পন্ন POS-এর মোট (paid/due আলাদা করা ফেজ C-র কাজ)
- UI: `POSTab.tsx` (336 লাইন) ভেঙে `src/admin/pos/{CartPanel,QuickItems,posTypes}.tsx`; কাস্টমার পিকার, একাধিক পেমেন্ট মেথড, "সম্পূর্ণ বাকি", দ্রুত-যোগ বাটন (সাম্প্রতিক ১৫০ বিক্রির সবচেয়ে চলতি ৮ আইটেম), রশিদে ইনভয়েস নং/পরিশোধ/বাকি/দোকানের নাম-ঠিকানা
- `staff_id`-এর আলাদা কলাম নেওয়া হয়নি — `pos_sales.created_by` ই স্টাফ (ফেজ D Staff-wise রিপোর্টে এটাই ব্যবহার হবে)
- ⚠️ **খোলা সিদ্ধান্ত:** `create_pos_sale_v2` ও POS ট্যাব এখনো শুধু admin/staff-এর জন্য; `counter_operator` রোল POS ব্যবহার করতে পারে না (ফেজ 16-এর সিদ্ধান্ত অনুযায়ী ইনভেন্টরি তাদের জন্য বন্ধ)। মালিক চাইলে ফেজ G-তে (Permission ম্যাট্রিক্স) বা তার আগে খুলে দেওয়া যাবে।
- ফেজ C-তে করণীয় সূত্র: `sale_payments.kind='due_collection'` + `pos_sales.due_amount` কমানোর ফাংশন `collect_due()`; অনলাইন অর্ডারের Due এখনো হিসাবে নেই

**ফেজ C — কী হয়েছে**
- SQL: `supabase_phaseC_accounting_migration.sql` (আইডেম্পটেন্ট; Supabase → SQL Editor-এ রান করতে হবে)
- `cash_transactions`-এ নতুন কলাম: `payment_method` (cash/bkash/nagad/rocket/other), `source` (`manual` | `pos` | `due_collection` | `online_order`)। ট্রিগার `tag_pos_cash_source` ফেজ B-র POS এন্ট্রিতে অটো `source='pos'` বসায়।
- `customer_dues` ভিউ; `collect_due(customer_id, amount, method)` — পুরনো ইনভয়েস আগে (FIFO), `sale_payments(kind='due_collection')` + `pos_sales.paid/due` আপডেট + ক্যাশ-বুকে আয় ('বাকি আদায়')। শুধু admin/staff পারে।
- অনলাইন অর্ডার `payment_status = paid` হলে ট্রিগার `trg_order_payment_cashbook` ক্যাশ-বুকে আয় ('অনলাইন অর্ডার', `order_id` সহ) বসায়; `paid → refunded` হলে একটি 'অর্ডার ফেরত' ব্যয়। একই অর্ডারে দ্বিতীয়বার বসে না।
- `daily_closings` টেবিল, `day_summary(date)` (প্রিভিউ), `close_day(date, note)` (admin/staff)। মাধ্যমভিত্তিক আয় = `sale_payments` (POS + বাকি আদায়) + ক্যাশ-বুকের manual/online এন্ট্রি; মাধ্যম না থাকা পুরনো এন্ট্রি "অন্যান্য/অনির্দিষ্ট"-এ যায়।
- UI: নতুন `DueCollectionTab.tsx` (ট্যাব 'বাকি আদায়', admin/staff), `DailyClosePanel.tsx`; `CashBookTab.tsx` — ক্যাটাগরি ড্রপডাউন (Paper/Ink/Toner/বিদ্যুৎ/ইন্টারনেট/স্টাফ পেমেন্ট/অন্যান্য), পেমেন্ট মেথড কলাম, ঢাকা সময়ের আজকের তারিখ (আগে UTC ছিল — রাত ১২–৬টায় আগের দিন আসত), পুরনো অর্ডার-ভিত্তিক "দিন শেষের সারাংশ" সরানো হয়েছে।
- ⚠️ **পুরনো paid অনলাইন অর্ডার ব্যাকফিল করা হয়নি** (মালিক আগে ম্যানুয়ালি এন্ট্রি দিয়ে থাকলে দ্বিগুণ হয়ে যেত)। SQL-এর শেষ যাচাই-কোয়েরি `paid_orders_without_cashbook` দেখায়; সংখ্যা ০ না হলে মালিকের সিদ্ধান্ত নিয়ে ফেজ D-তে বা তার আগে ব্যাকফিল।
- ⚠️ হিসাব বন্ধের পরে ঐ তারিখে নতুন এন্ট্রি হলে সতর্কবার্তা আসে, কিন্তু আটকানো হয় না। ক্যাশ-বুকের অটো এন্ট্রি মুছলে (কনফার্ম সহ) বিক্রির হিসাবের সাথে অমিল হতে পারে।
- ⚠️ Due আদায়/হিসাব বন্ধ এখনো `counter_operator` পারে না (ফেজ G-র Permission ম্যাট্রিক্স-এর সিদ্ধান্ত)। অনলাইন অর্ডারের Due এখনো হিসাবে নেই (অর্ডার হয় paid, নয় unpaid)।
- ফেজ D-র জন্য: Daily Report-এর আয়-ব্যয় `cash_transactions` থেকে, মাধ্যমভিত্তিক ভাগ `day_summary()`-র যুক্তি অনুযায়ী; Staff-wise = `pos_sales.created_by`; Due তালিকা = `customer_dues`।

---

## 🧱 ফেজ ০ — বর্তমান সাইটে যা আগে থেকেই আছে (জিপ ফাইল দেখে যাচাই করা)

**টেক স্ট্যাক:** React 18 + Vite + TypeScript + Tailwind + Supabase + Vercel (PWA সহ)
**রিপো:** `github.com/aminurar0010-create/service-marketplace` (branch: `main`)

**কাস্টমার সাইড:** সার্ভিস ক্যাটালগ, অর্ডার ফর্ম (ডকুমেন্ট আপলোড), অর্ডার ট্র্যাকিং, কাস্টমার লগইন + ড্যাশবোর্ড, ব্লগ, Courses ও Enrollment, AI চ্যাটবট (`ChatWidget`), PWA।

**অ্যাডমিন ট্যাব (`src/admin/`):** আজকের কাজ, অর্ডার, সার্ভিস, স্টাফ, কুপন, পারফরম্যান্স, মেসেজ ও টেমপ্লেট, গ্যালারি, রিভিউ, **ক্যাশ-বুক**, **রিপোর্টস**, **ইনভেন্টরি**, **POS**, ইউজার, **কাস্টমার খাতা** (ফোন নম্বর ধরে), ওয়েবসাইট, ব্লগ, AI প্রম্পট, লিড ও প্রপোজাল, পোর্টফোলিও, **Training Courses**, **Student Enrollments**, সেটিংস।

**রোল:** `admin`, `staff`, `counter_operator` (`profiles.role`)।
**ইতিমধ্যে আছে:** Activity Log, ডাটাবেস ব্যাকআপ, থিম কাস্টমাইজেশন, রশিদ/ইনভয়েস প্রিন্ট (`src/lib/receipt.ts`, `invoice.ts`), POS থেকে স্টক ও ক্যাশ-বুক অটো আপডেট (`create_pos_sale()` ফাংশন)।

**⚠️ ফাঁক (রোডম্যাপ বনাম বর্তমান কোড):**
1. `customers` টেবিল শুধু লগইন-করা অনলাইন কাস্টমারের জন্য (`auth.users` এর সাথে বাঁধা) — দোকানে আসা walk-in কাস্টমারের কোনো কেন্দ্রীয় প্রোফাইল নেই; "কাস্টমার খাতা" ফোন নম্বর ধরে হিসাব করে।
2. POS-এ কাস্টমারের নাম/ফোন ঐচ্ছিক, কাস্টমার সিলেক্ট/সার্চ নেই, **Due/আংশিক পেমেন্ট নেই**, একটাই পেমেন্ট মেথড, Invoice Number সিরিজ নেই।
3. Due আদায় (পরে টাকা নেওয়া) এবং expense ক্যাটাগরি-ভিত্তিক হিসাব সাজানো নেই।
4. Report আছে কিন্তু Daily Close Report, Service-wise, Customer-wise, Staff-wise, প্রিন্ট/CSV সম্পূর্ণ নয়।
5. একটি Global Search Box নেই (Customer/Phone/Invoice/Order একসাথে)।
6. Training: Course ও Enrollment আছে — **Attendance, Fee/Payment, Certificate নেই**।

**❌ স্থায়ীভাবে বাদ (আগেই সিদ্ধান্ত হয়েছে, আবার করা হবে না):** SMS/Email নোটিফিকেশন, Multi-language, আলাদা পূর্ণ CRM প্যানেল।

---

## ⚙️ নিয়ম — প্রতিটি ফেজে Claude যা মানবে (টোকেন বাঁচানোর জন্য)

1. **ফেজের বাইরে কিছু করবে না।** আগে "ফেজ ০" ও এই ফেজের সেকশন পড়বে, বাকি ফাইল দরকার হলেই খুলবে।
2. **বড় ফাইল পুরো লিখবে না।** `AdminDashboard.tsx` (900+ লাইন), `ServiceFormModal.tsx` (1100+), `OrderForm.tsx` (900+), `SettingsTab.tsx` (700+) — এগুলো শুধু ছোট অংশ বদলাবে; নতুন ফিচার **নতুন ছোট ফাইলে** (≤ ৩০০ লাইন) রাখবে।
3. **শুধু বদলানো/নতুন ফাইল দেবে**, পুরো জিপ নয়। সরাসরি রিপো-অ্যাক্সেস থাকলে সরাসরি commit/push করবে।
4. **SQL আলাদা ফাইলে** (`supabase_phaseXX_*.sql`), `IF NOT EXISTS` ও idempotent করে, RLS সহ — যেন একাধিকবার রান করলেও সমস্যা না হয়।
5. **কাজ শুরুর আগে `npm run build` (tsc) পাস করছে কিনা নিশ্চিত করবে**, শেষেও আবার।
6. **শেষে রোডম্যাপ ফাইলের STATUS অংশ আপডেট করে নতুন রোডম্যাপ ফাইল দেবে** (কী হলো, কোন SQL রান করতে হবে, কোন ফাইল বদলেছে, পরের ফেজের জন্য কোনো সতর্কতা)।
7. **একটি ফেজে ৪টির বেশি "Work Unit" নয়।** লিমিট শেষ হওয়ার আগে আগের Work Unit অবশ্যই commit করা থাকবে।
8. ইউজার কোড বোঝেন না — প্রতিটি ধাপ বাংলায়, কপি-পেস্ট করার মতো করে বলবে।

---

# 🅰️ ফেজ A — Unified Customer System (ফোন-ভিত্তিক)

**লক্ষ্য:** একটি কেন্দ্রীয় Customer ডাটাবেস — ফোন নম্বর হবে মূল চাবি। অনলাইন ও walk-in সবাই একই জায়গায়।

**Work Units**
- **A1 — SQL:** নতুন টেবিল `shop_customers` (id, customer_code যেমন `NP-0001`, name, phone **unique**, address, customer_type [`regular/vip/student/business`], notes, `auth_user_id` nullable, created_at)। সাথে একটি migration যা পুরনো `orders` ও `pos_sales` থেকে ফোন নম্বর ধরে customer তৈরি করবে (backfill) এবং দুই টেবিলে `customer_id` কলাম যোগ করবে। RLS: admin/staff/counter_operator দেখতে ও যোগ করতে পারবে।
- **A2 — Customer Picker কম্পোনেন্ট:** `src/components/CustomerPicker.tsx` — ফোন নম্বর লিখলেই খুঁজবে; পেলে "Existing Customer" দেখাবে, না পেলে "Create Customer" ফর্ম।
- **A3 — Customer 360° প্রোফাইল:** `src/admin/CustomerProfileModal.tsx` — নাম/মোবাইল/ঠিকানা, মোট ভিজিট, মোট কাজ, মোট খরচ, মোট বকেয়া, Service History (অর্ডার + POS একসাথে)।
- **A4 — "কাস্টমার খাতা" ট্যাব আপগ্রেড:** বর্তমান `CustomerLedgerTab.tsx` কে নতুন `shop_customers` এর সাথে যুক্ত করা; ফোন/নাম/Customer Code দিয়ে সার্চ।

**বদলাতে পারে:** `supabase.ts` (টাইপ), `CustomerLedgerTab.tsx`, `AdminDashboard.tsx` (শুধু import/ট্যাব লাইন)
**ফেজ A শেষের চেকলিস্ট:** ☐ নতুন walk-in কাস্টমার তৈরি হয় ☐ পুরনো ফোন নম্বর দিয়ে সার্চ করলে প্রোফাইল আসে ☐ backfill-এ ডুপ্লিকেট ফোন নেই ☐ build পাস

---

# 🅱️ ফেজ B — Counter Sales v2

**লক্ষ্য:** **Phone → Customer → Service → Amount → Payment → Save** (রোডম্যাপের §৭) এক স্ক্রিনে, দ্রুত।

**Work Units**
- **B1 — SQL:** `pos_sales`-এ যোগ: `customer_id`, `invoice_no` (সিরিজ, যেমন `NP-250001`), `paid_amount`, `due_amount`, `staff_id`। নতুন টেবিল `sale_payments` (sale_id, method [cash/bkash/nagad/rocket/other], amount) যেন একটি বিক্রিতে একাধিক মেথডে পেমেন্ট নেওয়া যায়। `create_pos_sale()` ফাংশন আপডেট (due হিসাব সহ; ক্যাশ-বুকে শুধু **পেইড অংশ** আয় হিসেবে যাবে)।
- **B2 — POS UI আপগ্রেড:** `POSTab.tsx` (482 লাইন) ভাঙা — কার্ট অংশ `src/admin/pos/CartPanel.tsx` এ সরিয়ে `CustomerPicker` বসানো, Paid/Due ইনপুট, Payment মেথড "Other" সহ।
- **B3 — রশিদ আপগ্রেড:** `receipt.ts` — হেডারে "নিউ প্রিন্টার্স / আইটি সলিউশন এ্যান্ড ট্রেনিং সেন্টার", Invoice No., Customer, Phone, Qty, Price, Discount, Total, Paid, Due, Payment Method।
- **B4 — দ্রুত এন্ট্রি:** ঘন ঘন ব্যবহৃত সার্ভিসের "Quick Buttons" (Print, Photocopy, Photo, Lamination, ID Card…) ও কীবোর্ড-ফ্রেন্ডলি ফ্লো।

**ফেজ B শেষের চেকলিস্ট:** ☐ নতুন কাস্টমার সহ বিক্রি হয় ☐ আংশিক পেমেন্টে Due জমা হয় ☐ রশিদে সব তথ্য আসে ☐ স্টক ও ক্যাশ-বুক ঠিকমতো আপডেট হয়

---

# 🅲 ফেজ C — Business Accounting

**লক্ষ্য:** Sales, Due, Payment, Cashbook, Expense — সব একসূত্রে।

**Work Units**
- **C1 — SQL:** `customer_dues` ভিউ/ফাংশন; `collect_due(customer_id, amount, method)` ফাংশন (পুরনো বিক্রির Due থেকে FIFO কমাবে + ক্যাশ-বুকে আয় যোগ করবে)।
- **C2 — Due আদায় UI:** `src/admin/DueCollectionTab.tsx` (বা কাস্টমার প্রোফাইলে বাটন) — "আজকের বকেয়া কাস্টমার", আদায়ের ফর্ম, Payment History।
- **C3 — Cashbook সংযোগ:** `CashBookTab.tsx` এ Income (Service/Product/Other) ও Expense ক্যাটাগরি ড্রপডাউন (Paper, Ink, Toner, Electricity, Internet, Staff Payment, অন্যান্য)। অনলাইন অর্ডারের পেমেন্ট `paid` হলে ক্যাশ-বুকে যাচ্ছে কিনা যাচাই ও ঠিক করা।
- **C4 — Daily Close:** দিনের শেষে "আজকের হিসাব বন্ধ করুন" — Cash/bKash/Nagad/Rocket আলাদা যোগফল, Expense, Net Result।

**ফেজ C শেষের চেকলিস্ট:** ☐ Due আদায় করলে খাতা ও ক্যাশ-বুক দুটোই বদলায় ☐ Payment breakdown মেলে ☐ Expense ক্যাটাগরি কাজ করে

---

# 🅳 ফেজ D — Reports

**লক্ষ্য:** রোডম্যাপের §৯–১১ ও Phase 4 রিপোর্ট।

**Work Units**
- **D1 — Daily Report:** `src/admin/reports/DailyReport.tsx` — নতুন/পুরনো/মোট কাস্টমার, Sale, Collection, Due, Cash/bKash/Nagad/Rocket, Expense, Net Result; **প্রিন্ট** বাটন।
- **D2 — Service-wise Report:** Quantity ও Revenue (বার চার্টসহ), সময়সীমা বাছাই (আজ/সপ্তাহ/মাস)।
- **D3 — Customer-wise ও Staff-wise Report:** শীর্ষ কাস্টমার, কার কাছে কত বকেয়া, স্টাফ-ভিত্তিক বিক্রি।
- **D4 — Monthly Report + CSV Export।**

বর্তমান `ReportsTab.tsx` (~৩০০ লাইনের কম) শুধু ট্যাব-সুইচার হিসেবে রেখে নতুন রিপোর্ট আলাদা ফাইলে যোগ হবে।

**ফেজ D শেষের চেকলিস্ট:** ☐ Daily Report-এর যোগফল ক্যাশ-বুকের সাথে মেলে ☐ প্রিন্ট/CSV কাজ করে

---

# 🅴 ফেজ E — Website Integration + Global Search + ব্র্যান্ডিং

**লক্ষ্য:** অনলাইন ও walk-in সব এক Database-এ; এক সার্চ বক্সে সব খোঁজা (§১৩); সাইটে ৪টি বিভাগ ও নতুন ব্র্যান্ড পজিশনিং।

**Work Units**
- **E1 — অনলাইন অর্ডার ↔ shop_customers:** অর্ডার ফর্মে ফোন দিলে `shop_customers` এ আপসার্ট (নতুন হলে তৈরি, পুরনো হলে লিংক)।
- **E2 — Global Search:** অ্যাডমিন টপবারে একটি সার্চ বক্স — Customer Name/Phone/Code, Order No., Invoice No. (ফোন নম্বর দিলে সরাসরি প্রোফাইল)।
- **E3 — হোমপেজ ব্র্যান্ডিং:** ৪ বিভাগ (Digital Services / Printing & Design / IT Solution / Training Center) ও Brand Promise "ডিজিটাল সেবা, প্রিন্টিং, আইটি সমাধান ও প্রশিক্ষণ—সবকিছু এক ঠিকানায়।"
- **E4 — কাস্টমার ড্যাশবোর্ডে** নিজের আগের কাজ ও Due দেখা।

**ফেজ E শেষের চেকলিস্ট:** ☐ একই ফোন নম্বর অনলাইন ও দোকান — একই প্রোফাইল ☐ Search কাজ করে

---

# 🅵 ফেজ F — Training Management

**লক্ষ্য:** বর্তমান Course + Enrollment-এর উপর পুরো Student ম্যানেজমেন্ট (৩/৬ মাস কোর্স)।

**Work Units**
- **F1 — SQL:** `student_attendance` (enrollment_id, date, status), `student_payments` (enrollment_id, amount, method, date), `certificates` (enrollment_id, certificate_no, issue_date)। Student ও `shop_customers` লিংক।
- **F2 — Attendance UI:** `src/admin/AttendanceTab.tsx` — ব্যাচ/কোর্স ধরে দৈনিক হাজিরা।
- **F3 — Course Fee ও Due:** কিস্তিতে ফি নেওয়া, Student-wise Due (ক্যাশ-বুকে আয় যাবে)।
- **F4 — Certificate:** প্রিন্টযোগ্য সার্টিফিকেট (নাম, কোর্স, সময়কাল, নম্বর) + Course Completion Record।

**ফেজ F শেষের চেকলিস্ট:** ☐ হাজিরা সেভ হয় ☐ ফি/Due ঠিক হিসাব হয় ☐ Certificate প্রিন্ট হয়

---

# 🅶 ফেজ G — Staff Permission, Security ও Mobile

**Work Units**
- **G1 — Permission ম্যাট্রিক্স:** রোল অনুযায়ী কোন ট্যাব/অ্যাকশন (যেমন Expense ডিলিট শুধু admin) — `counterOperatorAllowedTabs` কে ডাটা-চালিত করা।
- **G2 — Staff-wise Activity ও Login Activity:** বর্তমান `activity_logs` এর উপর ফিল্টার ও লগইন লগ।
- **G3 — Customer Data Protection:** RLS রিভিউ (সব নতুন টেবিল), স্টাফ কাকে কতটুকু দেখে তা যাচাই।
- **G4 — Mobile পালিশ:** POS, Customer Entry, Due, Stock, Report মোবাইলে ব্যবহারযোগ্য কিনা পরীক্ষা ও ঠিক।

---

# 🅷 ফেজ H — AI Business Assistant ও Smart Automation

**Work Units**
- **H1 — বর্তমান `SmartAssistant.tsx` (admin) আপগ্রেড:** প্রশ্ন — "আজকে কত বিক্রি?", "এই মাসে সেরা সার্ভিস?", "রহিম গত ৩ মাসে কত খরচ করেছে?", "আজকের বকেয়া কাস্টমার", "Low Stock পণ্য" — সরাসরি Supabase ডাটা থেকে উত্তর।
- **H2 — Safe Query Layer:** AI সরাসরি SQL চালাবে না; নির্দিষ্ট কিছু read-only RPC ফাংশন (আজকের সেল, Due তালিকা, Low Stock…) কল করবে।
- **H3 — Auto Workflow যাচাই:** Sale → Customer History → Payment → Cashbook → Dashboard → Receipt → Reports পুরো চেইন একবার পরীক্ষা করে ফাঁক বন্ধ।
- **H4 — Low Stock / Due অ্যালার্ট** অ্যাডমিন "আজকের কাজ" এ।

---

## 🧾 কপি-পেস্ট: নতুন অ্যাকাউন্টে প্রথম মেসেজ (Handoff Prompt)

```
আমি মোঃ মিনহাজুল আবেদীন, "নিউ প্রিন্টার্স" এর মালিক। আমি কোড বুঝি না — সব ধাপ বাংলায় সহজ করে বলবে।
সংযুক্ত: (১) New-Printers-Roadmap-v2.md  (২) প্রজেক্ট জিপ / GitHub টোকেন
কাজ: রোডম্যাপের STATUS অংশে যে "বর্তমান ফেজ" লেখা আছে, শুধু সেই ফেজটি করো।
নিয়ম: রোডম্যাপের "নিয়ম" সেকশন মানবে। শুধু বদলানো/নতুন ফাইল দেবে (বা সরাসরি commit করবে)।
বড় ফাইল পুরো লিখবে না। শেষে আপডেট করা রোডম্যাপ (STATUS সহ) দেবে।
শুরুতে ২-৩ লাইনে বলো ফেজটিতে কী কী করবে, তারপর কাজ শুরু করো।
```

---

## 🔑 টোকেন/জিপ কীভাবে দেবেন (সবচেয়ে কম টোকেন লাগার উপায়)

**বিকল্প ১ — জিপ (সবচেয়ে নিরাপদ, টোকেন বিপদ নেই):**
- জিপ থেকে `node_modules`, `package-lock.json`, `.git`, `dist`, `src/assets/gallery/*.jpg`, `public/*.png` **বাদ দিন** — এগুলো কোড নয়, শুধু সাইজ বাড়ায়।
- ফেজ অনুযায়ী ছোট জিপও দেওয়া যায় (যেমন ফেজ B-এর জন্য শুধু `src/admin/POSTab.tsx`, `src/lib/`, `src/components/`, `supabase_*.sql` ও `package.json`)।

**বিকল্প ২ — GitHub টোকেন (Claude সরাসরি পড়বে ও push করবে):**
- GitHub → Settings → Developer settings → **Fine-grained personal access token**
- **শুধু একটি রিপো** (`service-marketplace`) সিলেক্ট করুন, Permission: **Contents → Read and write**, মেয়াদ **৭ দিন**
- টোকেন দিলে Claude-কে বলুন "শুধু যে ফাইল লাগে সেটা পড়ো, পুরো রিপো নামিও না" — এতে টোকেন কম লাগে
- **ফেজ শেষ হলেই টোকেন Revoke করুন।** (আগের চ্যাটে শেয়ার হওয়া পুরনো টোকেন অবশ্যই Revoke করে ফেলুন।)

**Supabase:** SQL ফাইল Claude দেবে, আপনি Supabase → SQL Editor এ পেস্ট করে Run করবেন। `service_role` key কখনো চ্যাটে দেবেন না।

---

## ✅ প্রতিটি ফেজ শেষের চূড়ান্ত চেক

1. Supabase-এ নতুন SQL রান হয়েছে
2. `npm run build` পাস
3. GitHub-এ push (Vercel অটো ডিপ্লয়)
4. লাইভ সাইটে ১টি আসল টেস্ট (একটা বিক্রি/একটা কাস্টমার)
5. এই ফাইলের STATUS আপডেট করে সংরক্ষণ

---

## 🏁 FINAL VISION

> Customer: **Service নেবে → Payment করবে → Receipt পাবে → তথ্য সংরক্ষিত থাকবে → আবার এলে আগের History পাওয়া যাবে।**
> Owner: **কত Customer → কী Service → কত Sales → কত Payment → কত Due → কত Expense → ব্যবসার সামগ্রিক অবস্থা।**

**Brand Promise:** *“ডিজিটাল সেবা, প্রিন্টিং, আইটি সমাধান ও প্রশিক্ষণ—সবকিছু এক ঠিকানায়।”*
