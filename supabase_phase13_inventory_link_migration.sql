-- ============================================================
-- Phase 13: Inventory–Service Link (Kanban Board-এর জন্য কোনো SQL লাগে না,
-- সেটা সম্পূর্ণ ক্লায়েন্ট-সাইড ফিচার — শুধু এই ইনভেন্টরি লিংক অংশের জন্য SQL দরকার)
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
-- ============================================================

-- ১) orders টেবিলে ফ্ল্যাগ — একই অর্ডারের জন্য একাধিকবার স্টক যেন না কমে
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT false;

-- ২) সার্ভিস–ইনভেন্টরি লিংক টেমপ্লেট (Admin > Service এডিট করার সময় বসানো হয়)
CREATE TABLE IF NOT EXISTS service_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_inventory_items_service_idx ON service_inventory_items (service_id);

ALTER TABLE service_inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and staff can view service inventory link" ON service_inventory_items;
CREATE POLICY "Admin and staff can view service inventory link" ON service_inventory_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

DROP POLICY IF EXISTS "Admins can manage service inventory link" ON service_inventory_items;
CREATE POLICY "Admins can manage service inventory link" ON service_inventory_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'staff')
  ));

-- যাচাই করুন
SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'inventory_deducted';
