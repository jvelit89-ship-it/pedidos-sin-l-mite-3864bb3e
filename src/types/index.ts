// Core data types for the order management system

export type UserRole = 'superadmin' | 'admin' | 'vendedor' | 'repartidor';

export type Language = 'es' | 'en';
export type Currency = 'PEN' | 'USD' | 'MXN';

export interface AppSettings {
  language: Language;
  currency: Currency;
  companyId?: string;
}

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
  companyId?: string; // For multi-tenancy
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
  superadmin: [],
  admin: ['pending', 'preparation', 'ready', 'delivery', 'delivered', 'cancelled'],
  vendedor: ['pending', 'preparation', 'ready'],
  repartidor: ['delivery', 'delivered'],
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
  { path: '/orders', label: 'Pedidos', labelEn: 'Orders', icon: 'ShoppingCart', roles: ['admin', 'vendedor'] },
  { path: '/deliveries', label: 'Entregas', labelEn: 'Deliveries', icon: 'Truck', roles: ['admin', 'repartidor'] },
  { path: '/route', label: 'Ruta', labelEn: 'Route', icon: 'Route', roles: ['repartidor'] },
  { path: '/inventory', label: 'Inventario', labelEn: 'Inventory', icon: 'Package', roles: ['admin'] },
  { path: '/products', label: 'Productos', labelEn: 'Products', icon: 'Box', roles: ['admin'] },
  { path: '/customers', label: 'Clientes', labelEn: 'Customers', icon: 'Users', roles: ['admin', 'vendedor', 'repartidor'] },
  { path: '/customers-map', label: 'Mapa Clientes', labelEn: 'Customers Map', icon: 'Map', roles: ['admin'] },
  { path: '/vendedores', label: 'Vendedores', labelEn: 'Vendors', icon: 'UserCheck', roles: ['admin'] },
  { path: '/repartidores', label: 'Repartidores', labelEn: 'Drivers', icon: 'Bike', roles: ['admin'] },
  { path: '/settings', label: 'Ajustes', labelEn: 'Settings', icon: 'Settings', roles: ['superadmin', 'admin', 'vendedor', 'repartidor'] },
];
