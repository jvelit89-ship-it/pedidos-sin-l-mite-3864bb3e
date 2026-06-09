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
  login: (email: string, password: string) => Promise<{ data: any; error: any }>;
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
      console.log('Fetching profile for user:', userId);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        // Continue anyway, we'll default to vendedor
      }

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
        console.log('Profile not found, creating new profile for:', userId);
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: userId,
              name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'Usuario',
              email: userData.user.email,
            });
          
          if (insertError) {
            console.error('Error inserting profile:', insertError);
            return;
          }

          // Set default role
          const { error: roleInsertError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              role: 'vendedor',
            });

          if (roleInsertError) {
            console.error('Error inserting role:', roleInsertError);
          }

          setUser({
            id: userId,
            email: userData.user.email || '',
            name: userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'Usuario',
            role: 'vendedor',
            companyId: null,
            repartidorId: null,
            vendedorId: null,
            operarioId: null,
          });
        }
      }
    } catch (error) {
      console.error('Unexpected error in fetchUserProfile:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST (per Supabase best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (newSession?.user) {
          // Defer supabase call to avoid deadlock inside the listener
          setTimeout(() => {
            if (!mounted) return;
            fetchUserProfile(newSession.user.id).finally(() => {
              if (mounted) setIsLoading(false);
            });
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!mounted) return;
      setSession(existingSession);
      setSupabaseUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        fetchUserProfile(existingSession.user.id).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    }).catch((err) => {
      console.error('Error checking session:', err);
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);


  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
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
