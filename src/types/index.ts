// Core data types for the order management system

export type UserRole = 'superadmin' | 'admin' | 'vendedor' | 'repartidor' | 'operario';

export type Language = 'es' | 'en';
export type Currency = 'PEN' | 'USD' | 'MXN';
export type Timezone = 'America/Lima' | 'America/Mexico_City' | 'America/New_York' | 'America/Los_Angeles' | 'UTC';

export interface AppSettings {
  language: Language;
  currency: Currency;
  timezone: Timezone;
  companyId?: string;
}

export const TIMEZONE_CONFIG: Record<Timezone, { label: string; offset: string }> = {
  'America/Lima': { label: 'Lima, Perú', offset: 'UTC-5' },
  'America/Mexico_City': { label: 'Ciudad de México', offset: 'UTC-6' },
  'America/New_York': { label: 'Nueva York', offset: 'UTC-5/-4' },
  'America/Los_Angeles': { label: 'Los Ángeles', offset: 'UTC-8/-7' },
  'UTC': { label: 'UTC (Universal)', offset: 'UTC+0' },
};

export const CURRENCY_CONFIG: Record<Currency, { symbol: string; name: string }> = {
  PEN: { symbol: 'S/', name: 'Soles' },
  USD: { symbol: '$', name: 'Dólares' },
  MXN: { symbol: '$', name: 'Pesos' },
};

export interface Company {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  companyId?: string | null; // For multi-tenancy
  repartidorId?: string | null; // ID in repartidores table
  vendedorId?: string | null; // ID in vendedores table
  operarioId?: string | null; // ID in operarios table
}

export type OrderStatus = 
  | 'pending' 
  | 'preparation' 
  | 'ready' 
  | 'delivery' 
  | 'delivered' 
  | 'cancelled';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  notes?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendedor {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  companyId?: string;
  createdAt: string;
}

export interface Repartidor {
  id: string;
  name: string;
  email: string;
  phone: string;
  zone?: string;
  active: boolean;
  companyId?: string;
  createdAt: string;
}

export interface Operario {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  companyId?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  deliveryAddress: string;
  customerLatitude?: number;
  customerLongitude?: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  vendedorId: string;
  vendedorName: string;
  repartidorId?: string;
  repartidorName?: string;
  deliveryDate: string;
  notes?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'synced' | 'pending' | 'error';
  deliveredAt?: string;
}

export interface DashboardStats {
  ordersToday: number;
  pendingOrders: number;
  inDeliveryOrders: number;
  deliveredOrders: number;
}

// Status display configuration
export const ORDER_STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  labelEn: string;
  className: string;
  icon: string;
}> = {
  pending: { 
    label: 'Pendiente', 
    labelEn: 'Pending',
    className: 'status-pending',
    icon: '🕐'
  },
  preparation: { 
    label: 'En Preparación', 
    labelEn: 'In Preparation',
    className: 'status-preparation',
    icon: '👨‍🍳'
  },
  ready: { 
    label: 'Listo para Envío', 
    labelEn: 'Ready for Dispatch',
    className: 'status-ready',
    icon: '📦'
  },
  delivery: { 
    label: 'En Camino', 
    labelEn: 'Out for Delivery',
    className: 'status-delivery',
    icon: '🚚'
  },
  delivered: { 
    label: 'Entregado', 
    labelEn: 'Delivered',
    className: 'status-delivered',
    icon: '✅'
  },
  cancelled: { 
    label: 'Cancelado', 
    labelEn: 'Cancelled',
    className: 'status-cancelled',
    icon: '❌'
  },
};

// Role-based status change permissions
export const STATUS_CHANGE_PERMISSIONS: Record<UserRole, OrderStatus[]> = {
  superadmin: ['pending', 'preparation', 'ready', 'delivery', 'delivered', 'cancelled'],
  admin: ['pending', 'preparation', 'ready', 'delivery', 'delivered', 'cancelled'],
  vendedor: ['pending', 'preparation', 'ready'],
  repartidor: ['delivery', 'delivered', 'cancelled'],
  operario: ['preparation', 'ready'],
};

// All statuses array for admin full control
const ALL_STATUSES: OrderStatus[] = ['pending', 'preparation', 'ready', 'delivery', 'delivered', 'cancelled'];

// Status-based change permissions (what current status allows changing to)
export const STATUS_TRANSITION_PERMISSIONS: Record<UserRole, Record<OrderStatus, OrderStatus[]>> = {
  superadmin: {
    pending: ALL_STATUSES,
    preparation: ALL_STATUSES,
    ready: ALL_STATUSES,
    delivery: ALL_STATUSES,
    delivered: ALL_STATUSES,
    cancelled: ALL_STATUSES,
  },
  admin: {
    pending: ALL_STATUSES,
    preparation: ALL_STATUSES,
    ready: ALL_STATUSES,
    delivery: ALL_STATUSES,
    delivered: ALL_STATUSES,
    cancelled: ALL_STATUSES,
  },
  vendedor: {
    pending: ['pending', 'preparation', 'ready'],
    preparation: ['pending', 'preparation', 'ready'],
    ready: ['pending', 'preparation', 'ready'],
    delivery: [],
    delivered: [],
    cancelled: [],
  },
  repartidor: {
    pending: [],
    preparation: [],
    ready: ['delivery', 'delivered', 'cancelled'],
    delivery: ['delivery', 'delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  },
  operario: {
    pending: ['preparation', 'ready'],
    preparation: ['preparation', 'ready'],
    ready: [],
    delivery: [],
    delivered: [],
    cancelled: [],
  },
};

// Navigation items per role
export interface NavItem {
  path: string;
  label: string;
  labelEn: string;
  icon: string;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/companies', label: 'Empresas', labelEn: 'Companies', icon: 'Building2', roles: ['superadmin'] },
  { path: '/dashboard', label: 'Dashboard', labelEn: 'Dashboard', icon: 'LayoutDashboard', roles: ['admin'] },
  { path: '/orders', label: 'Pedidos', labelEn: 'Orders', icon: 'ShoppingCart', roles: ['admin', 'vendedor', 'operario', 'repartidor'] },
  { path: '/deliveries', label: 'Entregas', labelEn: 'Deliveries', icon: 'Truck', roles: ['admin', 'repartidor'] },
  { path: '/route', label: 'Ruta', labelEn: 'Route', icon: 'Route', roles: ['repartidor'] },
  { path: '/inventory', label: 'Inventario', labelEn: 'Inventory', icon: 'Package', roles: ['admin', 'vendedor', 'operario'] },
  { path: '/customers', label: 'Clientes', labelEn: 'Customers', icon: 'Users', roles: ['admin', 'vendedor', 'repartidor'] },
  { path: '/customers-map', label: 'Mapa Clientes', labelEn: 'Customers Map', icon: 'Map', roles: ['admin'] },
  { path: '/commissions', label: 'Comisiones', labelEn: 'Commissions', icon: 'DollarSign', roles: ['admin', 'vendedor', 'operario'] },
  { path: '/vendedores', label: 'Vendedores', labelEn: 'Vendors', icon: 'UserCheck', roles: ['admin'] },
  { path: '/repartidores', label: 'Repartidores', labelEn: 'Drivers', icon: 'Bike', roles: ['admin'] },
  { path: '/operarios', label: 'Operarios', labelEn: 'Operators', icon: 'Wrench', roles: ['admin'] },
  { path: '/logs', label: 'Registros', labelEn: 'Audit Logs', icon: 'FileText', roles: ['admin'] },
  { path: '/settings', label: 'Ajustes', labelEn: 'Settings', icon: 'Settings', roles: ['superadmin', 'admin', 'vendedor', 'repartidor', 'operario'] },
  { path: '/manual', label: 'Manual', labelEn: 'Manual', icon: 'BookOpen', roles: ['superadmin', 'admin', 'vendedor', 'repartidor', 'operario'] },
];
