-- ============================================================
-- Phase 18: প্রতিটি সার্ভিসের জন্য প্রয়োজনীয় ডকুমেন্ট + কাস্টম রিকোয়ারমেন্ট ফিল্ড
-- এই স্ক্রিপ্টটি Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
--
-- এটা কীভাবে কাজ করে:
--   - সার্ভিসের নামের সাথে মিল রেখে (ILIKE কী-ওয়ার্ড দিয়ে) প্রতিটা সার্ভিসের জন্য
--     সাধারণত যেসব ডকুমেন্ট/তথ্য লাগে সেগুলো বসানো হয়েছে।
--   - NOT EXISTS চেক থাকায় এটা নিরাপদ — যে সার্ভিসে ইতিমধ্যে ডকুমেন্ট/ফিল্ড সেট করা আছে
--     (Admin থেকে ম্যানুয়ালি বা আগে থেকে), সেটা এই স্ক্রিপ্ট স্পর্শ করবে না। শুধু খালি
--     থাকা সার্ভিসগুলোতেই বসবে। তাই এটা একাধিকবার রান করলেও সমস্যা নেই।
--   - আপনার সার্ভিসের নাম এখানে যা ধরা হয়েছে তার সাথে হুবহু না মিললে সেই সার্ভিসে কিছু
--     বসবে না — সেক্ষেত্রে Admin > সার্ভিস ম্যানেজমেন্ট থেকে ম্যানুয়ালি এডিট করে যোগ করুন,
--     অথবা নিচের কী-ওয়ার্ড (ILIKE '%...%') অংশটা আপনার সার্ভিসের নামের সাথে মিলিয়ে বদলে নিন।
-- ============================================================

-- ছোট্ট হেল্পার ফাংশন: একটা কী-ওয়ার্ড প্যাটার্নের সব সার্ভিসে প্রয়োজনীয় ডকুমেন্ট বসায়
-- (শুধু যেসব সার্ভিসে এখনো কোনো ডকুমেন্ট তালিকা নেই)
CREATE OR REPLACE FUNCTION _seed_required_docs(p_name_pattern text, p_labels text[])
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO service_required_documents (service_id, label, display_order)
  SELECT s.id, lbl, ord - 1
  FROM services s
  CROSS JOIN LATERAL unnest(p_labels) WITH ORDINALITY AS t(lbl, ord)
  WHERE s.name ILIKE p_name_pattern
    AND NOT EXISTS (
      SELECT 1 FROM service_required_documents rd WHERE rd.service_id = s.id
    );
END;
$$;

-- ছোট্ট হেল্পার ফাংশন: একটা কী-ওয়ার্ড প্যাটার্নের সব সার্ভিসে কাস্টম রিকোয়ারমেন্ট ফিল্ড বসায়
-- (শুধু যেসব সার্ভিসে এখনো কোনো কাস্টম ফিল্ড নেই)
CREATE OR REPLACE FUNCTION _seed_custom_fields(p_name_pattern text, p_fields jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO service_custom_fields (service_id, field_label, field_type, options, is_required, display_order)
  SELECT
    s.id,
    f->>'label',
    f->>'type',
    CASE WHEN f ? 'options' THEN
      ARRAY(SELECT jsonb_array_elements_text(f->'options'))
    ELSE NULL END,
    (f->>'required')::boolean,
    (f->>'ord')::int
  FROM services s
  CROSS JOIN LATERAL jsonb_array_elements(p_fields) AS f
  WHERE s.name ILIKE p_name_pattern
    AND NOT EXISTS (
      SELECT 1 FROM service_custom_fields cf WHERE cf.service_id = s.id
    );
END;
$$;

-- ============================================================
-- ১) পাসপোর্ট আবেদন/রিনিউ
-- ============================================================
SELECT _seed_required_docs('%পাসপোর্ট%', ARRAY[
  'জাতীয় পরিচয়পত্র (NID) / জন্ম নিবন্ধনের কপি',
  'সত্যায়িত ছবি (৩ কপি)',
  'পুরাতন পাসপোর্টের কপি (রিনিউর ক্ষেত্রে)',
  'ঠিকানার প্রমাণপত্র (বিদ্যুৎ বিল/হোল্ডিং ট্যাক্স)'
]);
SELECT _seed_custom_fields('%পাসপোর্ট%', '[
  {"label":"পাসপোর্টের ধরন (নতুন/রিনিউ)","type":"select","options":["নতুন","রিনিউ"],"required":true,"ord":0},
  {"label":"মেয়াদ","type":"select","options":["৫ বছর","১০ বছর"],"required":true,"ord":1},
  {"label":"ডেলিভারি টাইপ","type":"select","options":["রেগুলার","এক্সপ্রেস","সুপার এক্সপ্রেস"],"required":true,"ord":2}
]'::jsonb);

-- ২) জন্ম নিবন্ধন সনদ (নতুন/সংশোধন)
SELECT _seed_required_docs('%জন্ম নিবন্ধন%', ARRAY[
  'পিতা-মাতার জাতীয় পরিচয়পত্রের কপি',
  'হাসপাতাল/ইপিআই টিকা কার্ডের কপি (নতুন নিবন্ধনের ক্ষেত্রে)',
  'পুরাতন জন্ম নিবন্ধন সনদের কপি (সংশোধনের ক্ষেত্রে)'
]);
SELECT _seed_custom_fields('%জন্ম নিবন্ধন%', '[
  {"label":"আবেদনের ধরন","type":"select","options":["নতুন নিবন্ধন","তথ্য সংশোধন"],"required":true,"ord":0},
  {"label":"শিশু/আবেদনকারীর পূর্ণ নাম","type":"text","required":true,"ord":1},
  {"label":"জন্ম তারিখ","type":"text","required":true,"ord":2}
]'::jsonb);

-- ৩) ড্রাইভিং লাইসেন্স
SELECT _seed_required_docs('%ড্রাইভিং%', ARRAY[
  'জাতীয় পরিচয়পত্র (NID) কপি',
  'মেডিকেল সার্টিফিকেট',
  'সত্যায়িত ছবি (২ কপি)',
  'রক্তের গ্রুপ রিপোর্ট'
]);
SELECT _seed_custom_fields('%ড্রাইভিং%', '[
  {"label":"লাইসেন্সের ধরন","type":"select","options":["লার্নার","প্রফেশনাল","নবায়ন"],"required":true,"ord":0},
  {"label":"গাড়ির ক্যাটাগরি","type":"select","options":["মোটরসাইকেল","কার/জিপ","হালকা যান","ভারী যান"],"required":true,"ord":1}
]'::jsonb);

-- ৪) পুলিশ ক্লিয়ারেন্স সার্টিফিকেট
SELECT _seed_required_docs('%পুলিশ ক্লিয়ারেন্স%', ARRAY[
  'জাতীয় পরিচয়পত্র (NID) কপি',
  'পাসপোর্টের কপি',
  'সত্যায়িত ছবি (২ কপি)',
  'ঠিকানার প্রমাণপত্র'
]);
SELECT _seed_custom_fields('%পুলিশ ক্লিয়ারেন্স%', '[
  {"label":"ক্লিয়ারেন্সের উদ্দেশ্য (ভিসা/চাকরি/অন্যান্য)","type":"text","required":true,"ord":0}
]'::jsonb);

-- ৫) চাকরির আবেদন
SELECT _seed_required_docs('%চাকরির আবেদন%', ARRAY[
  'সিভি/জীবন বৃত্তান্ত',
  'জাতীয় পরিচয়পত্র/জন্ম নিবন্ধনের কপি',
  'পাসপোর্ট সাইজ ছবি',
  'শিক্ষাগত সনদের কপি'
]);
SELECT _seed_custom_fields('%চাকরির আবেদন%', '[
  {"label":"পদের নাম","type":"text","required":true,"ord":0},
  {"label":"প্রতিষ্ঠানের নাম","type":"text","required":false,"ord":1}
]'::jsonb);

-- ৬) মোবাইল নাম্বার ট্র্যাকিং (কোনো ডকুমেন্ট লাগে না, শুধু তথ্য)
SELECT _seed_custom_fields('%নাম্বার ট্র্যাকিং%', '[
  {"label":"যে নাম্বার ট্র্যাক করতে হবে","type":"text","required":true,"ord":0},
  {"label":"ট্র্যাকিংয়ের কারণ","type":"text","required":false,"ord":1}
]'::jsonb);

-- ৭) লোগো ও গ্রাফিক্স ডিজাইন
SELECT _seed_custom_fields('%গ্রাফিক্স ডিজাইন%', '[
  {"label":"ব্যবসা/প্রতিষ্ঠানের নাম","type":"text","required":true,"ord":0},
  {"label":"ডিজাইনের ধরন (লোগো/পোস্টার/ব্যানার/কার্ড)","type":"text","required":true,"ord":1},
  {"label":"পছন্দের রং/স্টাইল","type":"text","required":false,"ord":2}
]'::jsonb);
SELECT _seed_custom_fields('%লোগো%', '[
  {"label":"ব্যবসা/প্রতিষ্ঠানের নাম","type":"text","required":true,"ord":0},
  {"label":"পছন্দের রং/স্টাইল","type":"text","required":false,"ord":1}
]'::jsonb);

-- ৮) বায়োমেট্রিক যাচাই
SELECT _seed_required_docs('%বায়োমেট্রিক%', ARRAY[
  'জাতীয় পরিচয়পত্র (NID) কপি'
]);
SELECT _seed_custom_fields('%বায়োমেট্রিক%', '[
  {"label":"যাচাইয়ের উদ্দেশ্য","type":"text","required":false,"ord":0}
]'::jsonb);

-- ৯) ওয়েবসাইট তৈরি / ওয়েব ডেভেলপমেন্ট
SELECT _seed_custom_fields('%ওয়েব%', '[
  {"label":"ওয়েবসাইটের ধরন (বিজনেস/ই-কমার্স/পোর্টফোলিও)","type":"text","required":true,"ord":0},
  {"label":"ডোমেইন নাম (থাকলে)","type":"text","required":false,"ord":1},
  {"label":"রেফারেন্স ওয়েবসাইট লিংক (থাকলে)","type":"text","required":false,"ord":2}
]'::jsonb);

-- ১০) মোবাইল অ্যাপ তৈরি
SELECT _seed_custom_fields('%মোবাইল অ্যাপ%', '[
  {"label":"অ্যাপের প্ল্যাটফর্ম","type":"select","options":["Android","iOS","উভয়"],"required":true,"ord":0},
  {"label":"প্রধান ফিচারসমূহ","type":"text","required":true,"ord":1}
]'::jsonb);

-- ১১) ডিজিটাল মার্কেটিং
SELECT _seed_custom_fields('%ডিজিটাল মার্কেটিং%', '[
  {"label":"ফেসবুক/ওয়েবসাইট পেজ লিংক","type":"text","required":true,"ord":0},
  {"label":"মাসিক বাজেট","type":"text","required":true,"ord":1},
  {"label":"টার্গেট গ্রাহক/এলাকা","type":"text","required":false,"ord":2}
]'::jsonb);

-- ১২) এআই অটোমেশন
SELECT _seed_custom_fields('%এআই অটোমেশন%', '[
  {"label":"ব্যবসার ধরন","type":"text","required":true,"ord":0},
  {"label":"কোন প্ল্যাটফর্মে চ্যাটবট (Facebook/WhatsApp/Website)","type":"text","required":true,"ord":1}
]'::jsonb);

-- ১৩) পেইড সাবস্ক্রিপশন
SELECT _seed_custom_fields('%সাবস্ক্রিপশন%', '[
  {"label":"কোন সাবস্ক্রিপশন (Netflix/Canva/ChatGPT ইত্যাদি)","type":"text","required":true,"ord":0},
  {"label":"সময়কাল (মাস)","type":"text","required":true,"ord":1},
  {"label":"অ্যাকাউন্ট ইমেইল","type":"text","required":true,"ord":2}
]'::jsonb);

-- ১৪) মিউটেশন (নামজারি)
SELECT _seed_required_docs('%মিউটেশন%', ARRAY[
  'জমির দলিলের কপি',
  'পূর্বের খতিয়ানের কপি',
  'জাতীয় পরিচয়পত্র (NID) কপি',
  'ওয়ারিশ সনদ (প্রযোজ্য ক্ষেত্রে)',
  'হোল্ডিং ট্যাক্স রশিদ'
]);
SELECT _seed_custom_fields('%মিউটেশন%', '[
  {"label":"জেলা/উপজেলা/মৌজা","type":"text","required":true,"ord":0},
  {"label":"দাগ নম্বর ও খতিয়ান নম্বর","type":"text","required":true,"ord":1}
]'::jsonb);
SELECT _seed_required_docs('%নামজারি%', ARRAY[
  'জমির দলিলের কপি',
  'পূর্বের খতিয়ানের কপি',
  'জাতীয় পরিচয়পত্র (NID) কপি',
  'ওয়ারিশ সনদ (প্রযোজ্য ক্ষেত্রে)',
  'হোল্ডিং ট্যাক্স রশিদ'
]);
SELECT _seed_custom_fields('%নামজারি%', '[
  {"label":"জেলা/উপজেলা/মৌজা","type":"text","required":true,"ord":0},
  {"label":"দাগ নম্বর ও খতিয়ান নম্বর","type":"text","required":true,"ord":1}
]'::jsonb);

-- ১৫) এনআইডি / NID সংশোধন
SELECT _seed_required_docs('%NID%', ARRAY[
  'বর্তমান এনআইডি কার্ডের কপি',
  'সংশোধনের সপক্ষে প্রমাণপত্র (জন্ম সনদ/সার্টিফিকেট/ইউটিলিটি বিল)'
]);
SELECT _seed_custom_fields('%NID%', '[
  {"label":"কোন তথ্য সংশোধন করতে হবে (নাম/জন্ম তারিখ/ঠিকানা ইত্যাদি)","type":"text","required":true,"ord":0}
]'::jsonb);

-- ব্যবহার শেষে হেল্পার ফাংশন দুটো মুছে ফেলা হলো — এগুলো শুধু এই সিডিং-এর জন্য দরকার ছিল
DROP FUNCTION IF EXISTS _seed_required_docs(text, text[]);
DROP FUNCTION IF EXISTS _seed_custom_fields(text, jsonb);

-- ============================================================
-- যাচাই করতে: কোন কোন সার্ভিসে এখনো কোনো ডকুমেন্ট/ফিল্ড নেই তা দেখতে এই কোয়েরি চালান
-- ============================================================
-- SELECT s.name, s.category
-- FROM services s
-- WHERE NOT EXISTS (SELECT 1 FROM service_required_documents rd WHERE rd.service_id = s.id)
--   AND NOT EXISTS (SELECT 1 FROM service_custom_fields cf WHERE cf.service_id = s.id)
-- ORDER BY s.category, s.name;
