-- ============================================================
-- Phase 9: Order Status আপগ্রেড + Priority + Checklist সিস্টেম
-- এই পুরো স্ক্রিপ্টটি Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
-- (একবারই রান করবেন — দ্বিতীয়বার রান করলে ডুপ্লিকেট এড়াতে IF NOT EXISTS/DO ব্লক ব্যবহার করা হয়েছে)
-- ============================================================

-- ১) orders.status এর পুরনো CHECK constraint (যেটার নাম যাই হোক) খুঁজে বের করে বাদ দিন,
--    তারপর নতুন ৯-ধাপের status list দিয়ে নতুন constraint বসান
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%pending%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'documents_pending', 'ready', 'processing', 'waiting',
    'quality_check', 'completed', 'delivered', 'cancelled', 'rejected', 'on_hold'
  ));

-- ২) Priority কলাম যোগ করুন
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_priority_check
    CHECK (priority IN ('low', 'normal', 'important', 'urgent'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ৩) সার্ভিস চেকলিস্ট টেমপ্লেট টেবিল (Admin > Service এডিট করার সময় বসানো হয়)
CREATE TABLE IF NOT EXISTS service_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  label text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_checklist_items_service_idx ON service_checklist_items (service_id);

ALTER TABLE service_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view service checklist" ON service_checklist_items;
CREATE POLICY "Anyone can view service checklist" ON service_checklist_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage service checklist" ON service_checklist_items;
CREATE POLICY "Admins can manage service checklist" ON service_checklist_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

-- ৪) প্রতিটি অর্ডারের নিজস্ব চেকলিস্ট প্রোগ্রেস (সার্ভিস টেমপ্লেট থেকে প্রথমবার কপি হয়,
--    তারপর স্বাধীনভাবে থাকে — টেমপ্লেট পরে বদলালেও পুরনো অর্ডারের প্রোগ্রেস অক্ষত থাকবে)
CREATE TABLE IF NOT EXISTS order_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  checked_at timestamptz,
  checked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_checklist_items_order_idx ON order_checklist_items (order_id);

ALTER TABLE order_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff and admin can view order checklist" ON order_checklist_items;
CREATE POLICY "Staff and admin can view order checklist" ON order_checklist_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

DROP POLICY IF EXISTS "Staff and admin can insert order checklist" ON order_checklist_items;
CREATE POLICY "Staff and admin can insert order checklist" ON order_checklist_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

DROP POLICY IF EXISTS "Staff and admin can update order checklist" ON order_checklist_items;
CREATE POLICY "Staff and admin can update order checklist" ON order_checklist_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

DROP POLICY IF EXISTS "Admins can delete order checklist" ON order_checklist_items;
CREATE POLICY "Admins can delete order checklist" ON order_checklist_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ৫) যাচাই করুন সব ঠিকমতো তৈরি হয়েছে কিনা
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('status', 'priority');
