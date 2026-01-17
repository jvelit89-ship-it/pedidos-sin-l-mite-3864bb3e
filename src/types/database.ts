// Database types that map to Supabase tables
export type UserRole = 'superadmin' | 'admin' | 'vendedor' | 'repartidor';
export type OrderStatus = 'pending' | 'preparation' | 'ready' | 'delivery' | 'delivered' | 'cancelled';
export type CustomerCategory = 'regular' | 'premium' | 'vip';

export interface DbCompany {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbUserRole {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface DbProduct {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  stock: number;
  min_stock: number;
  price: number;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbProductionHistory {
  id: string;
  product_id: string;
  quantity: number;
  notes: string | null;
  produced_by: string | null;
  company_id: string;
  produced_at: string;
}

export interface DbCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: CustomerCategory;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbVendedor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  user_id: string | null;
  company_id: string;
  created_at: string;
}

export interface DbRepartidor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  zone: string | null;
  active: boolean;
  user_id: string | null;
  company_id: string;
  created_at: string;
}

export interface DbOrder {
  id: string;
  customer_id: string;
  customer_name: string;
  delivery_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  total: number;
  status: OrderStatus;
  vendedor_id: string | null;
  vendedor_name: string | null;
  repartidor_id: string | null;
  repartidor_name: string | null;
  delivery_date: string | null;
  notes: string | null;
  company_id: string;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface DbAuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  company_id: string | null;
  created_at: string;
}

export interface DbAppSettings {
  id: string;
  user_id: string;
  language: string;
  currency: string;
  updated_at: string;
}
