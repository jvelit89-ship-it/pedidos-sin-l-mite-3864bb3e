import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NAV_ITEMS } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Package, 
  Box, 
  Users, 
  UserCheck, 
  Bike, 
  Settings,
  Building2,
  Map,
  Route,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ShoppingCart, Truck, Package, Box, Users, UserCheck, Bike, Settings, Building2, Map, Route, FileText,
};

export function BottomNavigation() {
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useSettings();
  if (!user) return null;
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role)).slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {visibleItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <NavLink key={item.path} to={item.path} className={cn('flex flex-col items-center justify-center flex-1 h-full transition-colors', isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className={cn('w-5 h-5 mb-1', isActive && 'scale-110')} />
              <span className="text-[10px] font-medium">{settings.language === 'en' ? item.labelEn : item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  if (!user) return null;
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-sidebar text-sidebar-foreground fixed left-0 top-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
          <Package className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-semibold text-sidebar-primary-foreground">Pedidos</h1>
          <p className="text-xs text-sidebar-foreground/60">Sistema de gestión</p>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <NavLink key={item.path} to={item.path} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all', isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{settings.language === 'en' ? item.labelEn : item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-semibold text-sidebar-accent-foreground">{user.name.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-primary-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{user.role}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg transition-colors text-left">
          {settings.language === 'en' ? 'Logout' : 'Cerrar Sesión'}
        </button>
      </div>
    </aside>
  );
}
