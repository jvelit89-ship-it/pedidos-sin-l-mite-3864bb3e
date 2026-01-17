import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Product, Customer, Order, Vendedor, Repartidor, User, Company } from '@/types';

interface PedidosDB extends DBSchema {
  products: {
    key: string;
    value: Product;
    indexes: { 'by-sku': string; 'by-category': string; 'by-company': string };
  };
  customers: {
    key: string;
    value: Customer;
    indexes: { 'by-name': string; 'by-company': string };
  };
  orders: {
    key: string;
    value: Order;
    indexes: { 
      'by-status': string; 
      'by-date': string; 
      'by-vendedor': string;
      'by-repartidor': string;
      'by-sync': string;
      'by-company': string;
    };
  };
  vendedores: {
    key: string;
    value: Vendedor;
    indexes: { 'by-company': string };
  };
  repartidores: {
    key: string;
    value: Repartidor;
    indexes: { 'by-company': string };
  };
  companies: {
    key: string;
    value: Company;
  };
  auth: {
    key: string;
    value: { user: User; token: string };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'create' | 'update' | 'delete';
      entity: 'products' | 'customers' | 'orders' | 'vendedores' | 'repartidores' | 'companies';
      data: unknown;
      timestamp: string;
    };
  };
}

let dbInstance: IDBPDatabase<PedidosDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<PedidosDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PedidosDB>('pedidos-db', 2, {
    upgrade(db, oldVersion) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('by-sku', 'sku');
        productsStore.createIndex('by-category', 'category');
        productsStore.createIndex('by-company', 'companyId');
      }

      // Customers store
      if (!db.objectStoreNames.contains('customers')) {
        const customersStore = db.createObjectStore('customers', { keyPath: 'id' });
        customersStore.createIndex('by-name', 'name');
        customersStore.createIndex('by-company', 'companyId');
      }

      // Orders store
      if (!db.objectStoreNames.contains('orders')) {
        const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
        ordersStore.createIndex('by-status', 'status');
        ordersStore.createIndex('by-date', 'createdAt');
        ordersStore.createIndex('by-vendedor', 'vendedorId');
        ordersStore.createIndex('by-repartidor', 'repartidorId');
        ordersStore.createIndex('by-sync', 'syncStatus');
        ordersStore.createIndex('by-company', 'companyId');
      }

      // Vendedores store
      if (!db.objectStoreNames.contains('vendedores')) {
        const vendedoresStore = db.createObjectStore('vendedores', { keyPath: 'id' });
        vendedoresStore.createIndex('by-company', 'companyId');
      }

      // Repartidores store
      if (!db.objectStoreNames.contains('repartidores')) {
        const repartidoresStore = db.createObjectStore('repartidores', { keyPath: 'id' });
        repartidoresStore.createIndex('by-company', 'companyId');
      }

      // Companies store
      if (!db.objectStoreNames.contains('companies')) {
        db.createObjectStore('companies', { keyPath: 'id' });
      }

      // Auth store
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'user.id' });
      }

      // Sync queue
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

type StoreName = 'products' | 'customers' | 'orders' | 'vendedores' | 'repartidores' | 'companies' | 'auth' | 'syncQueue';

// Generic CRUD operations
export async function getAllItems<T extends StoreName>(
  store: T
): Promise<PedidosDB[T]['value'][]> {
  const db = await getDB();
  return db.getAll(store);
}

export async function getItem<T extends StoreName>(
  store: T,
  id: string
): Promise<PedidosDB[T]['value'] | undefined> {
  const db = await getDB();
  return db.get(store, id);
}

export async function addItem<T extends StoreName>(
  store: T,
  item: PedidosDB[T]['value']
): Promise<string> {
  const db = await getDB();
  return db.add(store, item);
}

export async function updateItem<T extends StoreName>(
  store: T,
  item: PedidosDB[T]['value']
): Promise<string> {
  const db = await getDB();
  return db.put(store, item);
}

export async function deleteItem<T extends StoreName>(
  store: T,
  id: string
): Promise<void> {
  const db = await getDB();
  return db.delete(store, id);
}

// Orders specific queries
export async function getOrdersByStatus(status: string): Promise<Order[]> {
  const db = await getDB();
  return db.getAllFromIndex('orders', 'by-status', status);
}

export async function getOrdersByVendedor(vendedorId: string): Promise<Order[]> {
  const db = await getDB();
  return db.getAllFromIndex('orders', 'by-vendedor', vendedorId);
}

export async function getOrdersByRepartidor(repartidorId: string): Promise<Order[]> {
  const db = await getDB();
  return db.getAllFromIndex('orders', 'by-repartidor', repartidorId);
}

export async function getPendingSyncOrders(): Promise<Order[]> {
  const db = await getDB();
  return db.getAllFromIndex('orders', 'by-sync', 'pending');
}

// Sync queue operations
export async function addToSyncQueue(item: PedidosDB['syncQueue']['value']): Promise<void> {
  const db = await getDB();
  await db.add('syncQueue', item);
}

export async function getSyncQueue(): Promise<PedidosDB['syncQueue']['value'][]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Initialize with demo data
export async function initializeDemoData(): Promise<void> {
  const db = await getDB();
  
  // Check if already initialized
  const existingProducts = await db.getAll('products');
  if (existingProducts.length > 0) return;

  const now = new Date().toISOString();
  const companyId = 'company1';

  // Demo Company
  const companies: Company[] = [
    { id: companyId, name: 'Empresa Demo', active: true, createdAt: now, updatedAt: now },
  ];

  // Demo Products
  const products: Product[] = [
    { id: 'p1', name: 'Producto A', sku: 'SKU-001', category: 'Categoría 1', stock: 50, minStock: 10, price: 25.00, companyId, createdAt: now, updatedAt: now },
    { id: 'p2', name: 'Producto B', sku: 'SKU-002', category: 'Categoría 1', stock: 8, minStock: 10, price: 45.50, companyId, createdAt: now, updatedAt: now },
    { id: 'p3', name: 'Producto C', sku: 'SKU-003', category: 'Categoría 2', stock: 0, minStock: 5, price: 15.00, companyId, createdAt: now, updatedAt: now },
    { id: 'p4', name: 'Producto D', sku: 'SKU-004', category: 'Categoría 2', stock: 100, minStock: 20, price: 35.00, companyId, createdAt: now, updatedAt: now },
    { id: 'p5', name: 'Producto E', sku: 'SKU-005', category: 'Categoría 3', stock: 25, minStock: 15, price: 60.00, companyId, createdAt: now, updatedAt: now },
  ];

  // Demo Customers with lat/lng
  const customers: Customer[] = [
    { id: 'c1', name: 'Juan Pérez', phone: '+52 55 1234 5678', address: 'Av. Reforma 123, CDMX', email: 'juan@email.com', latitude: 19.4326, longitude: -99.1332, category: 'premium', companyId, createdAt: now, updatedAt: now },
    { id: 'c2', name: 'María García', phone: '+52 55 8765 4321', address: 'Calle Insurgentes 456, CDMX', latitude: 19.4200, longitude: -99.1700, category: 'regular', companyId, createdAt: now, updatedAt: now },
    { id: 'c3', name: 'Empresa ABC', phone: '+52 55 1111 2222', address: 'Blvd. Miguel de Cervantes 789', email: 'contacto@abc.com', latitude: 19.4050, longitude: -99.1500, category: 'premium', companyId, createdAt: now, updatedAt: now },
  ];

  // Demo Vendedores
  const vendedores: Vendedor[] = [
    { id: 'v1', name: 'Carlos Vendedor', email: 'vendedor@pedidos.com', phone: '+52 55 3333 4444', active: true, companyId, createdAt: now },
    { id: 'v2', name: 'Ana Ventas', email: 'ana@pedidos.com', phone: '+52 55 5555 6666', active: true, companyId, createdAt: now },
  ];

  // Demo Repartidores
  const repartidores: Repartidor[] = [
    { id: 'r1', name: 'Pedro Repartidor', email: 'repartidor@pedidos.com', phone: '+52 55 7777 8888', zone: 'Centro', active: true, companyId, createdAt: now },
    { id: 'r2', name: 'Luis Entregas', email: 'luis@pedidos.com', phone: '+52 55 9999 0000', zone: 'Norte', active: true, companyId, createdAt: now },
  ];

  // Demo Orders
  const orders: Order[] = [
    {
      id: 'o1',
      customerId: 'c1',
      customerName: 'Juan Pérez',
      deliveryAddress: 'Av. Reforma 123, CDMX',
      customerLatitude: 19.4326,
      customerLongitude: -99.1332,
      items: [
        { productId: 'p1', productName: 'Producto A', quantity: 2, unitPrice: 25.00, total: 50.00 },
        { productId: 'p2', productName: 'Producto B', quantity: 1, unitPrice: 45.50, total: 45.50 },
      ],
      total: 95.50,
      status: 'pending',
      vendedorId: 'v1',
      vendedorName: 'Carlos Vendedor',
      repartidorId: 'r1',
      repartidorName: 'Pedro Repartidor',
      deliveryDate: new Date().toISOString().split('T')[0],
      companyId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    },
    {
      id: 'o2',
      customerId: 'c2',
      customerName: 'María García',
      deliveryAddress: 'Calle Insurgentes 456, CDMX',
      customerLatitude: 19.4200,
      customerLongitude: -99.1700,
      items: [
        { productId: 'p4', productName: 'Producto D', quantity: 3, unitPrice: 35.00, total: 105.00 },
      ],
      total: 105.00,
      status: 'preparation',
      vendedorId: 'v1',
      vendedorName: 'Carlos Vendedor',
      deliveryDate: new Date().toISOString().split('T')[0],
      companyId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    },
    {
      id: 'o3',
      customerId: 'c3',
      customerName: 'Empresa ABC',
      deliveryAddress: 'Blvd. Miguel de Cervantes 789',
      customerLatitude: 19.4050,
      customerLongitude: -99.1500,
      items: [
        { productId: 'p1', productName: 'Producto A', quantity: 5, unitPrice: 25.00, total: 125.00 },
        { productId: 'p5', productName: 'Producto E', quantity: 2, unitPrice: 60.00, total: 120.00 },
      ],
      total: 245.00,
      status: 'delivery',
      vendedorId: 'v2',
      vendedorName: 'Ana Ventas',
      repartidorId: 'r1',
      repartidorName: 'Pedro Repartidor',
      deliveryDate: new Date().toISOString().split('T')[0],
      companyId,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    },
    {
      id: 'o4',
      customerId: 'c1',
      customerName: 'Juan Pérez',
      deliveryAddress: 'Av. Reforma 123, CDMX',
      customerLatitude: 19.4326,
      customerLongitude: -99.1332,
      items: [
        { productId: 'p4', productName: 'Producto D', quantity: 2, unitPrice: 35.00, total: 70.00 },
      ],
      total: 70.00,
      status: 'delivered',
      vendedorId: 'v1',
      vendedorName: 'Carlos Vendedor',
      repartidorId: 'r2',
      repartidorName: 'Luis Entregas',
      deliveryDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      companyId,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: now,
      syncStatus: 'synced',
      deliveredAt: now,
    },
  ];

  // Insert demo data
  const tx = db.transaction(['companies', 'products', 'customers', 'vendedores', 'repartidores', 'orders'], 'readwrite');
  
  for (const company of companies) {
    await tx.objectStore('companies').add(company);
  }
  for (const product of products) {
    await tx.objectStore('products').add(product);
  }
  for (const customer of customers) {
    await tx.objectStore('customers').add(customer);
  }
  for (const vendedor of vendedores) {
    await tx.objectStore('vendedores').add(vendedor);
  }
  for (const repartidor of repartidores) {
    await tx.objectStore('repartidores').add(repartidor);
  }
  for (const order of orders) {
    await tx.objectStore('orders').add(order);
  }

  await tx.done;
}
