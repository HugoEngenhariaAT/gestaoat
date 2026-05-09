export type Area = 'Civil' | 'Acabamento' | 'Elétrica' | 'Hidráulica' | 'Impermeabilização';

export type UserRole = 'DEV' | 'ADMIN' | 'FOREMAN' | 'USER';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  position?: string;
  phone?: string;
  is_active?: boolean;
  password_record?: string;
  created_at?: string;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  provider: string;
  stock_quantity: number;
  min_stock: number;
  created_at: string;
}

export interface Movement {
  id: string;
  material_id: string;
  quantity: number;
  type: 'IN' | 'OUT';
  area: Area | string | null;
  project: string | null;
  apartment: string | null;
  service_description: string | null;
  responsible: string;
  created_at: string;
  material?: Material;
}

export interface Provider {
  id: string;
  name: string;
  service_type: string;
  area: Area | string;
  daily_rate?: number;
  active?: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
}

export interface ServiceRecord {
  id: string;
  provider_id: string;
  area: Area | string;
  project: string | null;
  date: string;
  quantity: number;
  description: string;
  descriptions?: string[];
  details?: any[];
  service_value?: number;
  created_by_id: string | null;
  created_at: string;
  provider?: Provider;
}

export interface Order {
  id: string;
  material_id: string;
  quantity: number;
  original_quantity?: number;
  quantity_justification?: string;
  status: 'PENDING' | 'APPROVED' | 'AWAITING_PICKUP' | 'PICKED_UP' | 'AWAITING_DELIVERY' | 'DELIVERED' | 'RECEIVED' | 'CANCELLED';
  requested_by: string;
  requested_by_id?: string;
  use_date: string;
  service_description: string;
  project: string;
  apartment: string;
  observation?: string;
  for_stock?: boolean;
  stock_updated?: boolean;
  delivery_type?: 'DELIVERY' | 'PICKUP';
  pickup_info?: string;
  pickup_by_id?: string;
  pickup_by_name?: string;
  delivered_to_name?: string;
  supplier?: string;
  expected_delivery: string | null;
  received_by?: string;
  created_at: string;
  material?: Material;
}

export interface Equipment {
  id: string;
  name: string;
  code: string;
  category: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'LOST';
  current_responsible: string | null;
  current_responsible_id: string | null;
  current_project: string | null;
  last_revision?: string;
  revisions?: {
    date: string;
    description: string;
    responsible: string;
  }[];
  created_at: string;
}

export interface EquipmentMovement {
  id: string;
  equipment_id: string;
  from_responsible: string | null;
  to_responsible: string;
  to_responsible_id: string | null;
  from_project: string | null;
  to_project: string;
  notes: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  confirmed_at: string | null;
  created_at: string;
  equipment?: Equipment;
}
