-- SQL Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (Employees)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('DEV', 'ADMIN', 'FOREMAN', 'USER')) NOT NULL DEFAULT 'USER',
  full_name TEXT,
  position TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  password_record TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_record TEXT;

-- 2. MATERIALS
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  provider TEXT,
  stock_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Remove cost column as it's no longer used in the app
-- ALTER TABLE materials DROP COLUMN IF EXISTS cost;

-- 3. MOVEMENTS
CREATE TABLE IF NOT EXISTS movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  type TEXT CHECK (type IN ('IN', 'OUT')) NOT NULL,
  area TEXT,
  project TEXT,
  apartment TEXT,
  service_description TEXT,
  responsible TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE movements ADD COLUMN IF NOT EXISTS apartment TEXT;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS service_description TEXT;

-- 4. PROVIDERS
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  service_type TEXT NOT NULL,
  area TEXT NOT NULL,
  daily_rate DECIMAL(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE providers ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 5. SERVICE RECORDS
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policies for projects
CREATE POLICY "Everyone can view projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Admins and Devs can manage projects" ON projects FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('ADMIN', 'DEV')
  )
);

CREATE TABLE IF NOT EXISTS service_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  project TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  description TEXT,
  details JSONB DEFAULT '[]'::jsonb,
  descriptions JSONB DEFAULT '[]'::jsonb,
  service_value DECIMAL(10,2) DEFAULT 0,
  created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_records ADD COLUMN IF NOT EXISTS quantity DECIMAL(3,1) NOT NULL DEFAULT 1.0;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS descriptions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS service_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
-- Remove daily_rate as it's no longer used
-- ALTER TABLE service_records DROP COLUMN IF EXISTS daily_rate;

-- 6. EQUIPMENT
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  category TEXT,
  status TEXT CHECK (status IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'LOST')) NOT NULL DEFAULT 'AVAILABLE',
  current_responsible TEXT,
  current_project TEXT,
  last_revision DATE,
  revisions JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. EQUIPMENT MOVEMENTS
CREATE TABLE IF NOT EXISTS equipment_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  from_responsible TEXT,
  to_responsible TEXT NOT NULL,
  to_responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_project TEXT,
  to_project TEXT NOT NULL,
  notes TEXT,
  status TEXT CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE equipment_movements ADD COLUMN IF NOT EXISTS to_responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE equipment_movements ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING';
ALTER TABLE equipment_movements ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 8. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  original_quantity DECIMAL(10,2),
  quantity_justification TEXT,
  status TEXT CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_PICKUP', 'RECEIVED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
  requested_by TEXT NOT NULL,
  requested_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  use_date DATE,
  service_description TEXT,
  project TEXT,
  apartment TEXT,
  observation TEXT,
  delivery_type TEXT CHECK (delivery_type IN ('DELIVERY', 'PICKUP')),
  pickup_info TEXT,
  pickup_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pickup_by_name TEXT,
  supplier TEXT,
  expected_delivery DATE,
  received_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_quantity DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity_justification TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS use_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_description TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS project TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS apartment TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS observation TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_info TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_by_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS received_by TEXT;

-- Update status constraint to use APPROVED and AWAITING_PICKUP
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_PICKUP', 'RECEIVED', 'CANCELLED'));

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "View profiles" ON profiles;
DROP POLICY IF EXISTS "Manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Insert profile" ON profiles;

-- Profiles Policies
CREATE POLICY "View profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Dev update profiles" ON profiles FOR UPDATE TO authenticated USING (is_admin_or_dev());
CREATE POLICY "Dev only delete profiles" ON profiles FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'DEV'
  )
);
CREATE POLICY "Insert profile" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

-- Materials Policies
DROP POLICY IF EXISTS "View Materials" ON materials;
DROP POLICY IF EXISTS "Admin Manage Materials" ON materials;
CREATE POLICY "View Materials" ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage Materials" ON materials FOR ALL TO authenticated USING (is_admin_or_dev());

-- Movements Policies
DROP POLICY IF EXISTS "View Movements" ON movements;
DROP POLICY IF EXISTS "Insert Movements" ON movements;
DROP POLICY IF EXISTS "Admin Delete Movements" ON movements;
CREATE POLICY "View Movements" ON movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert Movements" ON movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Delete Movements" ON movements FOR DELETE TO authenticated USING (is_admin_or_dev());

-- Orders Policies
DROP POLICY IF EXISTS "View Orders" ON orders;
DROP POLICY IF EXISTS "Insert Orders" ON orders;
DROP POLICY IF EXISTS "Update Orders" ON orders;
DROP POLICY IF EXISTS "Admin Delete Orders" ON orders;
CREATE POLICY "View Orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert Orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update Orders" ON orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin Delete Orders" ON orders FOR DELETE TO authenticated USING (is_admin_or_dev());

-- Equipment Policies
DROP POLICY IF EXISTS "View Equipment" ON equipment;
DROP POLICY IF EXISTS "Update Equipment" ON equipment;
DROP POLICY IF EXISTS "Admin Manage Equipment" ON equipment;
CREATE POLICY "View Equipment" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can update equipment" ON equipment FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin/Dev manage equipment" ON equipment FOR ALL TO authenticated USING (is_admin_or_dev());

-- Equipment Movements Policies
DROP POLICY IF EXISTS "View Equipment Movements" ON equipment_movements;
DROP POLICY IF EXISTS "Insert Equipment Movements" ON equipment_movements;
CREATE POLICY "View Equipment Movements" ON equipment_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert Equipment Movements" ON equipment_movements FOR INSERT TO authenticated WITH CHECK (true);

-- Providers Policies
DROP POLICY IF EXISTS "View Providers" ON providers;
DROP POLICY IF EXISTS "Admin Manage Providers" ON providers;
DROP POLICY IF EXISTS "All users can insert providers" ON providers;
CREATE POLICY "View Providers" ON providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert providers" ON providers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin Manage Providers" ON providers FOR ALL TO authenticated USING (is_admin_or_dev());

-- Service Records Policies
DROP POLICY IF EXISTS "View Service Records" ON service_records;
DROP POLICY IF EXISTS "Admin Manage Service Records" ON service_records;
DROP POLICY IF EXISTS "All users can insert service records" ON service_records;
DROP POLICY IF EXISTS "Users can update own service records" ON service_records;
DROP POLICY IF EXISTS "Users can delete own service records" ON service_records;
CREATE POLICY "View Service Records" ON service_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "All users can insert service records" ON service_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own service records" ON service_records FOR UPDATE TO authenticated USING (
  auth.uid() = created_by_id OR is_admin_or_dev()
);
CREATE POLICY "Users can delete own service records" ON service_records FOR DELETE TO authenticated USING (
  auth.uid() = created_by_id OR is_admin_or_dev()
);

-- ==========================================
-- FUNCTIONS AND TRIGGERS
-- ==========================================

-- 0. Helper function to avoid infinite recursion in RLS
CREATE OR REPLACE FUNCTION is_admin_or_dev()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('ADMIN', 'DEV')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Update stock_quantity in materials when a movement is inserted
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
DECLARE
  current_stock DECIMAL(10,2);
BEGIN
  SELECT stock_quantity INTO current_stock FROM materials WHERE id = NEW.material_id;

  IF (NEW.type = 'IN') THEN
    UPDATE materials 
    SET stock_quantity = stock_quantity + NEW.quantity
    WHERE id = NEW.material_id;
  ELSIF (NEW.type = 'OUT') THEN
    IF (current_stock - NEW.quantity < 0) THEN
      RAISE EXCEPTION 'Estoque insuficiente para esta saída. Disponível: %, Solicitado: %', current_stock, NEW.quantity;
    END IF;

    UPDATE materials 
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_on_movement ON movements;
CREATE TRIGGER trg_update_stock_on_movement
AFTER INSERT ON movements
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_movement();

-- 2. Update equipment status and location when an equipment movement is CONFIRMED
CREATE OR REPLACE FUNCTION update_equipment_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'CONFIRMED' AND (OLD IS NULL OR OLD.status != 'CONFIRMED')) THEN
    UPDATE equipment
    SET 
      current_responsible = NEW.to_responsible,
      current_project = NEW.to_project,
      status = 'IN_USE'
    WHERE id = NEW.equipment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_equipment_on_movement ON equipment_movements;
CREATE TRIGGER trg_update_equipment_on_movement
AFTER INSERT OR UPDATE ON equipment_movements
FOR EACH ROW
EXECUTE FUNCTION update_equipment_on_movement();

-- 3. Automatically create a movement when an order is marked as RECEIVED
CREATE OR REPLACE FUNCTION handle_order_received()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'RECEIVED' AND OLD.status != 'RECEIVED') THEN
    INSERT INTO movements (material_id, quantity, type, responsible, area, project)
    VALUES (NEW.material_id, NEW.quantity, 'IN', 'Sistema (Pedido Recebido)', 'Estoque', NEW.project);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handle_order_received ON orders;
CREATE TRIGGER trg_handle_order_received
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION handle_order_received();

-- 4. Admin function to update user password
CREATE OR REPLACE FUNCTION admin_update_user_password(target_user_id UUID, new_password TEXT)
RETURNS VOID AS $$
BEGIN
  -- Check if the caller is a DEV OR if the user is updating their own password
  IF NOT (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'DEV'
    ) 
    OR 
    (auth.uid() = target_user_id)
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar esta senha.';
  END IF;

  -- Update the password in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
  
  -- Also update the password_record in profiles for visibility
  UPDATE profiles
  SET password_record = new_password
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin function to create a new user
CREATE OR REPLACE FUNCTION admin_create_user(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_role TEXT,
  user_position TEXT,
  user_phone TEXT
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if caller is DEV or ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('DEV', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar novos usuários.';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uuid_generate_v4(),
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', user_full_name, 'role', user_role),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    email,
    role,
    full_name,
    position,
    phone,
    is_active,
    password_record
  )
  VALUES (
    new_user_id,
    user_email,
    user_role,
    user_full_name,
    user_position,
    user_phone,
    TRUE,
    user_password
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Admin function to delete a user
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if caller is DEV
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'DEV'
  ) THEN
    RAISE EXCEPTION 'Apenas desenvolvedores podem excluir usuários permanentemente.';
  END IF;

  -- Delete from profiles (this will happen automatically due to CASCADE if we delete from auth.users, 
  -- but we do it explicitly to be safe and handle any custom logic)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

