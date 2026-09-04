-- ============================================================
-- Phase 10: রেডিমেড মেসেজ টেমপ্লেট সিস্টেম
-- এই পুরো স্ক্রিপ্টটি Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
-- ============================================================

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and staff can view templates" ON message_templates;
CREATE POLICY "Admin and staff can view templates" ON message_templates
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

DROP POLICY IF EXISTS "Admins can manage templates" ON message_templates;
CREATE POLICY "Admins can manage templates" ON message_templates
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

-- ডিফল্ট ৬টা টেমপ্লেট বসিয়ে দিন (আগে থেকে থাকলে স্কিপ হবে, ডুপ্লিকেট হবে না)
INSERT INTO message_templates (key, title, body) VALUES
  ('order_received', 'অর্ডার গৃহীত', 'প্রিয় {customer_name}, আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে। ট্র্যাকিং আইডি: {tracking_id}। ধন্যবাদ — New Printers'),
  ('documents_missing', 'ডকুমেন্ট বাকি', 'প্রিয় {customer_name}, আপনার {service_name} অর্ডার (ট্র্যাকিং: {tracking_id}) সম্পন্ন করতে নিচের তথ্য/ডকুমেন্ট প্রয়োজনঃ {missing_docs}। দয়া করে দ্রুত পাঠিয়ে দিন। — New Printers'),
  ('processing', 'প্রক্রিয়াধীন', 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) বর্তমানে প্রক্রিয়াধীন রয়েছে। সম্পন্ন হলে জানিয়ে দেওয়া হবে। — New Printers'),
  ('completed', 'সম্পন্ন', 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) সম্পন্ন হয়েছে। ধন্যবাদ — New Printers'),
  ('payment_due', 'পেমেন্ট বাকি', 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) অর্ডারের ৳{amount} টাকা বাকি রয়েছে। দয়া করে পরিশোধ করুন। — New Printers'),
  ('ready_for_collection', 'সংগ্রহের জন্য প্রস্তুত', 'প্রিয় {customer_name}, আপনার {service_name} (ট্র্যাকিং: {tracking_id}) প্রস্তুত। অনুগ্রহ করে দোকান থেকে সংগ্রহ করুন। — New Printers')
ON CONFLICT (key) DO NOTHING;

-- যাচাই করুন
SELECT key, title FROM message_templates ORDER BY key;
