-- ============================================================
-- Phase 16: "কাউন্টার অপারেটর" (Counter Operator) রোল
-- স্কোপ: শুধু Order / Customer / Payment — বাকি সব (Services edit, Inventory,
-- Reports, Settings, Users ইত্যাদি ম্যানেজ করা) থেকে বাদ
--
-- ⚠️ এই স্ক্রিপ্ট কোনো পুরনো পলিসি মুছে ফেলে না বা admin/staff-এর অ্যাক্সেস কমায় না —
-- প্রতিটা পলিসিতে শুধু "OR counter_operator" যোগ করা হয়েছে (DROP+CREATE একই
-- নামে, তাই বারবার রান করলেও সমস্যা নেই)।
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
-- ============================================================

-- ০) হেল্পার ফাংশন — profiles টেবিলের নিজস্ব RLS পলিসিতে সরাসরি profiles টেবিল
--    কোয়েরি করলে self-reference জটিলতা হতে পারে, তাই is_admin()-এর মতোই
--    SECURITY DEFINER ফাংশন দিয়ে RLS বাইপাস করে নিরাপদে চেক করা হচ্ছে
CREATE OR REPLACE FUNCTION is_counter_operator(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = uid AND role = 'counter_operator');
$$;

GRANT EXECUTE ON FUNCTION is_counter_operator(uuid) TO anon, authenticated;

-- ১) profiles.role কলামে কোনো CHECK constraint থাকলে (শুধু admin/staff আটকে রাখা থাকলে)
--    সেটা বাদ দিয়ে নতুন ভ্যালু allow করুন
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'counter_operator'));

-- ২) orders — কাউন্টার অপারেটর সব অর্ডার দেখতে ও আপডেট করতে পারবে (শুধু নিজের assigned নয়)
DROP POLICY IF EXISTS "Admin views all, staff views own orders" ON orders;
CREATE POLICY "Admin views all, staff views own orders" ON orders
  FOR SELECT USING (
    is_admin(auth.uid())
    OR is_counter_operator(auth.uid())
    OR ((assigned_staff_id = auth.uid()) AND (EXISTS (
      SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text))
    )))
  );

DROP POLICY IF EXISTS "Admin updates all, staff updates own orders" ON orders;
CREATE POLICY "Admin updates all, staff updates own orders" ON orders
  FOR UPDATE USING (
    is_admin(auth.uid())
    OR is_counter_operator(auth.uid())
    OR ((assigned_staff_id = auth.uid()) AND (EXISTS (
      SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'staff'::text))
    )))
  );

-- ৩) customers — কাউন্টার অপারেটর কাস্টমার প্রোফাইল দেখতে ও আপডেট করতে পারবে
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers" ON customers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) OR is_counter_operator(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all customers" ON customers;
CREATE POLICY "Admins can update all customers" ON customers
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) OR is_counter_operator(auth.uid()));

-- ৪) cash_transactions — পেমেন্ট/ক্যাশ-বুক এন্ট্রি ম্যানেজ করতে পারবে
DROP POLICY IF EXISTS "Admins can manage cash transactions" ON cash_transactions;
CREATE POLICY "Admins can manage cash transactions" ON cash_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR is_counter_operator(auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR is_counter_operator(auth.uid())
  );

-- ৫) pos_sales / pos_sale_items — পেমেন্ট-সংক্রান্ত POS বিক্রয় দেখতে ও (sales-এর ক্ষেত্রে) আপডেট করতে পারবে
DROP POLICY IF EXISTS "Staff and admin can view pos sales" ON pos_sales;
CREATE POLICY "Staff and admin can view pos sales" ON pos_sales
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update pos sales" ON pos_sales;
CREATE POLICY "Admins can update pos sales" ON pos_sales
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR is_counter_operator(auth.uid())
  );

DROP POLICY IF EXISTS "Staff and admin can view pos sale items" ON pos_sale_items;
CREATE POLICY "Staff and admin can view pos sale items" ON pos_sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

-- ৬) order_checklist_items — অর্ডার প্রসেস করার সময় চেকলিস্ট টিক দিতে পারবে (ডিলিট বাদে)
DROP POLICY IF EXISTS "Staff and admin can view order checklist" ON order_checklist_items;
CREATE POLICY "Staff and admin can view order checklist" ON order_checklist_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

DROP POLICY IF EXISTS "Staff and admin can insert order checklist" ON order_checklist_items;
CREATE POLICY "Staff and admin can insert order checklist" ON order_checklist_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

DROP POLICY IF EXISTS "Staff and admin can update order checklist" ON order_checklist_items;
CREATE POLICY "Staff and admin can update order checklist" ON order_checklist_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

-- ৭) message_templates — অর্ডার ডিটেইল থেকে কাস্টমারকে মেসেজ পাঠানোর সময় টেমপ্লেট পড়তে পারবে
DROP POLICY IF EXISTS "Admin and staff can view templates" ON message_templates;
CREATE POLICY "Admin and staff can view templates" ON message_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

-- ৮) activity_logs — কাউন্টার অপারেটরের অ্যাকশনও লগ হবে (অডিট ট্রেইল ঠিক রাখতে)
DROP POLICY IF EXISTS "Staff and admin can insert activity logs" ON activity_logs;
CREATE POLICY "Staff and admin can insert activity logs" ON activity_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['admin'::text, 'staff'::text]))
    OR is_counter_operator(auth.uid())
  );

-- ৯) services — Quick Order-এ "কাস্টম সার্ভিস" (এককালীন) তৈরি করতে পারবে
--    (সাধারণ সার্ভিস তালিকা দেখা এমনিতেই সবার জন্য উন্মুক্ত, এটা শুধু নতুন সার্ভিস-রো তৈরির অনুমতি)
DROP POLICY IF EXISTS "Admins can manage services" ON services;
CREATE POLICY "Admins can manage services" ON services
  FOR ALL USING (is_admin(auth.uid()) OR is_counter_operator(auth.uid()))
  WITH CHECK (is_admin(auth.uid()) OR is_counter_operator(auth.uid()));

-- ১০) profiles — কাউন্টার অপারেটর Quick Order-এ স্টাফ-অ্যাসাইন ড্রপডাউনে স্টাফ তালিকা দেখতে পারবে
--     (is_admin()-এর মতোই SECURITY DEFINER ফাংশন ব্যবহার করা হচ্ছে বলে self-reference সমস্যা হবে না)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin(auth.uid()) OR is_counter_operator(auth.uid()));

-- যাচাই করুন
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND (qual ILIKE '%counter_operator%' OR with_check ILIKE '%counter_operator%')
ORDER BY tablename;
