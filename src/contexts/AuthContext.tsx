import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  canAccessRoute: (path: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isOperario: boolean;
  canEditCustomers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Route permissions by role
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/companies': ['superadmin'],
  '/dashboard': ['admin'],
  '/orders': ['admin', 'vendedor'],
  '/deliveries': ['admin', 'repartidor'],
  '/route': ['repartidor'],
  '/inventory': ['admin', 'vendedor', 'operario'],
  '/customers': ['admin', 'vendedor', 'repartidor'],
  '/customers-map': ['admin'],
  '/commissions': ['admin', 'vendedor', 'operario', 'repartidor'],
  '/vendedores': ['admin'],
  '/repartidores': ['admin'],
  '/operarios': ['admin'],
  '/logs': ['admin'],
  '/settings': ['superadmin', 'admin', 'vendedor', 'repartidor', 'operario'],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        const role = (roleData?.role as UserRole) || 'vendedor';
        
        // Fetch role-specific IDs
        let repartidorId: string | null = null;
        let vendedorId: string | null = null;
        let operarioId: string | null = null;
        
        if (role === 'repartidor') {
          const { data: repartidorData } = await supabase
            .from('repartidores')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          repartidorId = repartidorData?.id || null;
        } else if (role === 'vendedor') {
          const { data: vendedorData } = await supabase
            .from('vendedores')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          vendedorId = vendedorData?.id || null;
        } else if (role === 'operario') {
          const { data: operarioData } = await supabase
            .from('operarios')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          operarioId = operarioData?.id || null;
        }
        
        setUser({
          id: userId,
          email: profileData.email || '',
          name: profileData.name,
          role,
          companyId: profileData.company_id,
          repartidorId,
          vendedorId,
          operarioId,
        });
      } else {
        // Profile doesn't exist yet - create one
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: userId,
              name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'Usuario',
              email: userData.user.email,
            });
          
          if (!insertError) {
            // Set default role
            await supabase
              .from('user_roles')
              .insert({
                user_id: userId,
                role: 'vendedor',
              });

            setUser({
              id: userId,
              email: userData.user.email || '',
              name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'Usuario',
              role: 'vendedor',
              companyId: null,
              repartidorId: null,
              vendedorId: null,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setSupabaseUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setUser(null);
        }
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error.message);
      return false;
    }

    return !!data.session;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setSupabaseUser(null);
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

  const isAdmin = user?.role === 'admin';
  const isSuperAdmin = user?.role === 'superadmin';
  const isOperario = user?.role === 'operario';
  const canEditCustomers = user?.role === 'admin' || user?.role === 'vendedor';

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        isLoading,
        isAuthenticated: !!session,
        login,
        logout,
        canAccessRoute,
        isAdmin,
        isSuperAdmin,
        isOperario,
        canEditCustomers,
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
    case 'superadmin':
      return '/companies';
    case 'admin':
      return '/dashboard';
    case 'vendedor':
      return '/orders';
    case 'repartidor':
      return '/deliveries';
    default:
      return '/dashboard';
  }
}
