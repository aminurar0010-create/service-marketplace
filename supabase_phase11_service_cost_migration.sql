-- ============================================================
-- Phase 11: Service Cost/Profit ফিল্ড
-- Supabase Dashboard > SQL Editor এ পেস্ট করে Run করুন
-- ============================================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS internal_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS material_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS other_cost numeric NOT NULL DEFAULT 0;

-- যাচাই করুন
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'services' AND column_name IN ('internal_cost', 'material_cost', 'other_cost');
