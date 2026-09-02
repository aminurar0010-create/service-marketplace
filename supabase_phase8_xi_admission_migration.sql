-- ============================================================
-- Phase 8: বিকাশ-অনলি পেমেন্ট + "একাদশ শ্রেণিতে ভর্তি" সার্ভিস
-- এই পুরো স্ক্রিপ্টটি Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
-- ============================================================

-- ১) services টেবিলে নতুন কলাম: এই কলামে নম্বর সেট থাকলে ওই সার্ভিসে
--    অর্ডার ফর্মে শুধু বিকাশ (পার্সোনাল) দেখাবে ও ট্রানজেকশন আইডি বাধ্যতামূলক হবে
ALTER TABLE services ADD COLUMN IF NOT EXISTS payment_bkash_number text;

-- ২) orders টেবিলে নতুন কলাম: গ্রাহকের দেওয়া বিকাশ ট্রানজেকশন আইডি জমা রাখতে
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id text;

-- ৩) অর্ডার তৈরি হওয়ার পর ট্রানজেকশন আইডি সেভ করার ফাংশন
--    (বিদ্যমান create_order ফাংশন স্পর্শ না করেই, অর্ডার তৈরির পর কল করা হবে —
--     ঠিক যেভাবে save_order_variants / link_order_to_customer কাজ করে)
CREATE OR REPLACE FUNCTION set_order_transaction_id(p_tracking_id text, p_transaction_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE orders SET transaction_id = p_transaction_id WHERE tracking_id = p_tracking_id;
$$;

GRANT EXECUTE ON FUNCTION set_order_transaction_id(text, text) TO anon, authenticated;

-- ৪) নতুন সার্ভিস তৈরি: "একাদশ শ্রেণিতে ভর্তির অনলাইন আবেদন"
--    দাম আপাতত ৳100 রাখা হলো — Admin > Services থেকে যেকোনো সময় বদলে নিতে পারবেন
WITH new_service AS (
  INSERT INTO services (
    name, description, price, category, is_active, payment_bkash_number, estimated_hours
  )
  VALUES (
    'একাদশ শ্রেণিতে ভর্তির অনলাইন আবেদন',
    'SSC পাশ শিক্ষার্থীদের জন্য একাদশ শ্রেণি/কলেজ ভর্তির কলেজ চয়েস দিয়ে অনলাইন আবেদন সম্পন্ন করে দেওয়া হয়',
    100,
    'ই-সার্ভিস ও অনলাইন কাজ',
    true,
    '01968673241',
    24
  )
  RETURNING id
)
INSERT INTO service_custom_fields (service_id, field_label, field_type, is_required, display_order)
SELECT id, label, 'text', true, ord
FROM new_service, (VALUES
  ('এসএসসি রোল নম্বর', 0),
  ('এসএসসি রেজিস্ট্রেশন নম্বর', 1),
  ('মোবাইল নম্বর (আবেদনের জন্য)', 2)
) AS fields(label, ord);

-- ৫) নতুন সার্ভিসের ID দেখতে এই কোয়েরিটি রান করুন —
--    এই id দিয়েই Facebook পোস্টের লিংক বানাবেন
SELECT id, name, price, payment_bkash_number
FROM services
WHERE name = 'একাদশ শ্রেণিতে ভর্তির অনলাইন আবেদন';
