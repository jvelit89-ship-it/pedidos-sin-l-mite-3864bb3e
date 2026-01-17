import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  canAccessRoute: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users
const DEMO_USERS: { email: string; password: string; user: User }[] = [
  {
    email: 'admin@pedidos.com',
    password: 'admin',
    user: {
      id: 'u1',
      email: 'admin@pedidos.com',
      name: 'Administrador',
      role: 'admin',
    },
  },
  {
    email: 'vendedor@pedidos.com',
    password: '123456',
    user: {
      id: 'v1',
      email: 'vendedor@pedidos.com',
      name: 'Carlos Vendedor',
      role: 'vendedor',
    },
  },
  {
    email: 'repartidor@pedidos.com',
    password: '123456',
    user: {
      id: 'r1',
      email: 'repartidor@pedidos.com',
      name: 'Pedro Repartidor',
      role: 'repartidor',
    },
  },
];

// Route permissions by role
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/dashboard': ['admin'],
  '/orders': ['admin', 'vendedor'],
  '/deliveries': ['admin', 'repartidor'],
  '/inventory': ['admin'],
  '/products': ['admin'],
  '/customers': ['admin', 'vendedor'],
  '/vendedores': ['admin'],
  '/repartidores': ['admin'],
  '/settings': ['admin', 'vendedor', 'repartidor'],
};

const AUTH_STORAGE_KEY = 'pedidos_auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuth = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.user) {
            setUser(parsed.user);
          }
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const demoUser = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (demoUser) {
      setUser(demoUser.user);
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user: demoUser.user, token: 'demo-token' })
      );
      return true;
    }

    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const canAccessRoute = useCallback(
    (path: string): boolean => {
      if (!user) return false;
      
      // Find matching route pattern
      const matchingRoute = Object.keys(ROUTE_PERMISSIONS).find((route) => {
        if (path === route) return true;
        if (path.startsWith(route + '/')) return true;
        return false;
      });

      if (!matchingRoute) return true; // Allow unprotected routes
      
      return ROUTE_PERMISSIONS[matchingRoute].includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        canAccessRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'vendedor':
      return '/orders';
    case 'repartidor':
      return '/deliveries';
    default:
      return '/';
  }
}
