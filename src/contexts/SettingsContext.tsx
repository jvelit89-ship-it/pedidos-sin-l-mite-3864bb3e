import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppSettings, Language, Currency, CURRENCY_CONFIG } from '@/types';

interface Translations {
  // Common
  save: string;
  cancel: string;
  create: string;
  edit: string;
  delete: string;
  search: string;
  loading: string;
  noData: string;
  actions: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  status: string;
  active: string;
  inactive: string;
  
  // Navigation
  dashboard: string;
  orders: string;
  deliveries: string;
  inventory: string;
  products: string;
  customers: string;
  vendedores: string;
  repartidores: string;
  settings: string;
  companies: string;
  customersMap: string;
  route: string;
  
  // Auth
  login: string;
  logout: string;
  password: string;
  
  // Settings page
  settingsTitle: string;
  account: string;
  language: string;
  currency: string;
  synchronization: string;
  syncNow: string;
  lastSync: string;
  
  // Customers
  newCustomer: string;
  editCustomer: string;
  customerLocation: string;
  viewOnly: string;
  
  // Orders
  newOrder: string;
  orderDetail: string;
  total: string;
  
  // Vendedores/Repartidores
  newVendedor: string;
  editVendedor: string;
  newRepartidor: string;
  editRepartidor: string;
  zone: string;
  
  // Companies
  newCompany: string;
  editCompany: string;
  
  // Map
  setLocation: string;
  viewLocation: string;
  optimizeRoute: string;
  startNavigation: string;
}

const translations: Record<Language, Translations> = {
  es: {
    save: 'Guardar',
    cancel: 'Cancelar',
    create: 'Crear',
    edit: 'Editar',
    delete: 'Eliminar',
    search: 'Buscar',
    loading: 'Cargando...',
    noData: 'No hay datos',
    actions: 'Acciones',
    name: 'Nombre',
    email: 'Email',
    phone: 'Teléfono',
    address: 'Dirección',
    notes: 'Notas',
    status: 'Estado',
    active: 'Activo',
    inactive: 'Inactivo',
    
    dashboard: 'Dashboard',
    orders: 'Pedidos',
    deliveries: 'Entregas',
    inventory: 'Inventario',
    products: 'Productos',
    customers: 'Clientes',
    vendedores: 'Vendedores',
    repartidores: 'Repartidores',
    settings: 'Ajustes',
    companies: 'Empresas',
    customersMap: 'Mapa de Clientes',
    route: 'Ruta de Entrega',
    
    login: 'Iniciar Sesión',
    logout: 'Cerrar Sesión',
    password: 'Contraseña',
    
    settingsTitle: 'Ajustes',
    account: 'Cuenta',
    language: 'Idioma',
    currency: 'Moneda',
    synchronization: 'Sincronización',
    syncNow: 'Sincronizar Ahora',
    lastSync: 'Última sincronización',
    
    newCustomer: 'Nuevo Cliente',
    editCustomer: 'Editar Cliente',
    customerLocation: 'Ubicación del Cliente',
    viewOnly: 'Solo lectura',
    
    newOrder: 'Nuevo Pedido',
    orderDetail: 'Detalle del Pedido',
    total: 'Total',
    
    newVendedor: 'Nuevo Vendedor',
    editVendedor: 'Editar Vendedor',
    newRepartidor: 'Nuevo Repartidor',
    editRepartidor: 'Editar Repartidor',
    zone: 'Zona',
    
    newCompany: 'Nueva Empresa',
    editCompany: 'Editar Empresa',
    
    setLocation: 'Establecer Ubicación',
    viewLocation: 'Ver Ubicación',
    optimizeRoute: 'Optimizar Ruta',
    startNavigation: 'Iniciar Navegación',
  },
  en: {
    save: 'Save',
    cancel: 'Cancel',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search',
    loading: 'Loading...',
    noData: 'No data',
    actions: 'Actions',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    notes: 'Notes',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    
    dashboard: 'Dashboard',
    orders: 'Orders',
    deliveries: 'Deliveries',
    inventory: 'Inventory',
    products: 'Products',
    customers: 'Customers',
    vendedores: 'Vendors',
    repartidores: 'Drivers',
    settings: 'Settings',
    companies: 'Companies',
    customersMap: 'Customers Map',
    route: 'Delivery Route',
    
    login: 'Login',
    logout: 'Logout',
    password: 'Password',
    
    settingsTitle: 'Settings',
    account: 'Account',
    language: 'Language',
    currency: 'Currency',
    synchronization: 'Synchronization',
    syncNow: 'Sync Now',
    lastSync: 'Last sync',
    
    newCustomer: 'New Customer',
    editCustomer: 'Edit Customer',
    customerLocation: 'Customer Location',
    viewOnly: 'View only',
    
    newOrder: 'New Order',
    orderDetail: 'Order Detail',
    total: 'Total',
    
    newVendedor: 'New Vendor',
    editVendedor: 'Edit Vendor',
    newRepartidor: 'New Driver',
    editRepartidor: 'Edit Driver',
    zone: 'Zone',
    
    newCompany: 'New Company',
    editCompany: 'Edit Company',
    
    setLocation: 'Set Location',
    viewLocation: 'View Location',
    optimizeRoute: 'Optimize Route',
    startNavigation: 'Start Navigation',
  },
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  t: Translations;
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'pedidos_settings';

const defaultSettings: AppSettings = {
  language: 'es',
  currency: 'MXN',
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      } catch {
        // ignore
      }
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const t = translations[settings.language];
  
  const currencyConfig = CURRENCY_CONFIG[settings.currency];
  const currencySymbol = currencyConfig.symbol;

  const formatCurrency = useCallback(
    (amount: number) => `${currencySymbol}${amount.toFixed(2)}`,
    [currencySymbol]
  );

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, t, formatCurrency, currencySymbol }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
