-- 1. Ensure daily_rate column exists in providers
ALTER TABLE providers ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2) DEFAULT 0;

-- 2. Enable RLS for providers and orders
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 3. Providers RLS Policies
DROP POLICY IF EXISTS "View Providers" ON providers;
DROP POLICY IF EXISTS "Admin Manage Providers" ON providers;
DROP POLICY IF EXISTS "All users can insert providers" ON providers;

CREATE POLICY "View Providers" ON providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert providers" ON providers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Manage Providers" ON providers FOR ALL TO authenticated USING (is_admin_or_dev());

-- 4. Orders RLS Policies
DROP POLICY IF EXISTS "View Orders" ON orders;
DROP POLICY IF EXISTS "Insert Orders" ON orders;
DROP POLICY IF EXISTS "Update Orders" ON orders;
DROP POLICY IF EXISTS "Admin Delete Orders" ON orders;

CREATE POLICY "View Orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert Orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
-- Allow users to update their own orders or admins to update any
CREATE POLICY "Update Orders" ON orders FOR UPDATE TO authenticated USING (
  requested_by_id = auth.uid() OR is_admin_or_dev()
);
CREATE POLICY "Admin Delete Orders" ON orders FOR DELETE TO authenticated USING (is_admin_or_dev());
