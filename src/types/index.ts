// Core data types for the order management system

export type UserRole = 'admin' | 'vendedor' | 'repartidor';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface Vendedor {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface Repartidor {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
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
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  vendedorId: string;
  vendedorName: string;
  repartidorId?: string;
  repartidorName?: string;
  deliveryDate: string;
  notes?: string;
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
  className: string;
  icon: string;
}> = {
  pending: { 
    label: 'Pendiente', 
    className: 'status-pending',
    icon: '🕐'
  },
  preparation: { 
    label: 'En Preparación', 
    className: 'status-preparation',
    icon: '👨‍🍳'
  },
  ready: { 
    label: 'Listo para Envío', 
    className: 'status-ready',
    icon: '📦'
  },
  delivery: { 
    label: 'En Camino', 
    className: 'status-delivery',
    icon: '🚚'
  },
  delivered: { 
    label: 'Entregado', 
    className: 'status-delivered',
    icon: '✅'
  },
  cancelled: { 
    label: 'Cancelado', 
    className: 'status-cancelled',
    icon: '❌'
  },
};

// Role-based status change permissions
export const STATUS_CHANGE_PERMISSIONS: Record<UserRole, OrderStatus[]> = {
  admin: ['pending', 'preparation', 'ready', 'delivery', 'delivered', 'cancelled'],
  vendedor: ['pending', 'preparation', 'ready'],
  repartidor: ['delivery', 'delivered'],
};

// Navigation items per role
export interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['admin'] },
  { path: '/orders', label: 'Pedidos', icon: 'ShoppingCart', roles: ['admin', 'vendedor'] },
  { path: '/deliveries', label: 'Entregas', icon: 'Truck', roles: ['admin', 'repartidor'] },
  { path: '/inventory', label: 'Inventario', icon: 'Package', roles: ['admin'] },
  { path: '/products', label: 'Productos', icon: 'Box', roles: ['admin'] },
  { path: '/customers', label: 'Clientes', icon: 'Users', roles: ['admin', 'vendedor'] },
  { path: '/vendedores', label: 'Vendedores', icon: 'UserCheck', roles: ['admin'] },
  { path: '/repartidores', label: 'Repartidores', icon: 'Bike', roles: ['admin'] },
  { path: '/settings', label: 'Ajustes', icon: 'Settings', roles: ['admin', 'vendedor', 'repartidor'] },
];
