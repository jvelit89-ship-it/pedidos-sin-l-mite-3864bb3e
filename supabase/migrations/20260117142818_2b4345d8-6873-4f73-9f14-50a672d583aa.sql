-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE public.user_role AS ENUM ('superadmin', 'admin', 'vendedor', 'repartidor');
CREATE TYPE public.order_status AS ENUM ('pending', 'preparation', 'ready', 'delivery', 'delivered', 'cancelled');
CREATE TYPE public.customer_category AS ENUM ('regular', 'premium', 'vip');

-- Companies table
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'vendedor',
    UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    category TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 5,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Production history table (for tracking daily production)
CREATE TABLE public.production_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    notes TEXT,
    produced_by UUID REFERENCES auth.users(id),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    produced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_history ENABLE ROW LEVEL SECURITY;

-- Customers table
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    category customer_category DEFAULT 'regular',
    notes TEXT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Vendedores table
CREATE TABLE public.vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    active BOOLEAN DEFAULT true,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- Repartidores table
CREATE TABLE public.repartidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    zone TEXT,
    active BOOLEAN DEFAULT true,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.repartidores ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    delivery_address TEXT,
    customer_latitude DOUBLE PRECISION,
    customer_longitude DOUBLE PRECISION,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    status order_status NOT NULL DEFAULT 'pending',
    vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
    vendedor_name TEXT,
    repartidor_id UUID REFERENCES public.repartidores(id) ON DELETE SET NULL,
    repartidor_name TEXT,
    delivery_date DATE,
    notes TEXT,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at TIMESTAMPTZ
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order items table
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- App settings table
CREATE TABLE public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT DEFAULT 'es',
    currency TEXT DEFAULT 'MXN',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    current_user_name TEXT;
    company UUID;
BEGIN
    current_user_id := auth.uid();
    
    SELECT name INTO current_user_name FROM public.profiles WHERE user_id = current_user_id;
    
    IF TG_OP = 'DELETE' THEN
        company := OLD.company_id;
    ELSE
        company := NEW.company_id;
    END IF;
    
    INSERT INTO public.audit_logs (user_id, user_name, entity_type, entity_id, action, old_data, new_data, company_id)
    VALUES (
        current_user_id,
        current_user_name,
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        company
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply audit triggers
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- RLS Policies

-- Companies: superadmin can do everything, others can read their own company
CREATE POLICY "Superadmin full access to companies" ON public.companies
    FOR ALL USING (public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "Users can view their own company" ON public.companies
    FOR SELECT USING (id = public.get_user_company_id(auth.uid()));

-- Profiles: users can view/update their own, admins can view all in their company
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can view all profiles in company" ON public.profiles
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- User roles: only superadmin can manage, users can read their own
CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Superadmin can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'superadmin'));

-- Products: company-scoped access
CREATE POLICY "Users can view products in their company" ON public.products
    FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admin can manage products in their company" ON public.products
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- Production history: company-scoped, admin only for insert
CREATE POLICY "Users can view production history" ON public.production_history
    FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admin can insert production" ON public.production_history
    FOR INSERT WITH CHECK (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- Customers: company-scoped, admin can edit
CREATE POLICY "Users can view customers in their company" ON public.customers
    FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admin can manage customers" ON public.customers
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- Vendedores: company-scoped, admin can manage
CREATE POLICY "Users can view vendedores in their company" ON public.vendedores
    FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admin can manage vendedores" ON public.vendedores
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- Repartidores: company-scoped, admin can manage
CREATE POLICY "Users can view repartidores in their company" ON public.repartidores
    FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Admin can manage repartidores" ON public.repartidores
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- Orders: company-scoped with role-based access
CREATE POLICY "Users can view orders in their company" ON public.orders
    FOR SELECT USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "Vendedor can create orders" ON public.orders
    FOR INSERT WITH CHECK (
        company_id = public.get_user_company_id(auth.uid())
        AND (public.has_role(auth.uid(), 'vendedor') OR public.has_role(auth.uid(), 'admin'))
    );
CREATE POLICY "Admin can manage orders" ON public.orders
    FOR ALL USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );
CREATE POLICY "Vendedor can update own orders" ON public.orders
    FOR UPDATE USING (
        public.has_role(auth.uid(), 'vendedor') 
        AND company_id = public.get_user_company_id(auth.uid())
    );
CREATE POLICY "Repartidor can update assigned orders" ON public.orders
    FOR UPDATE USING (
        public.has_role(auth.uid(), 'repartidor') 
        AND company_id = public.get_user_company_id(auth.uid())
    );

-- Order items: follow order access
CREATE POLICY "Users can view order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.company_id = public.get_user_company_id(auth.uid()))
    );
CREATE POLICY "Users can manage order items" ON public.order_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.company_id = public.get_user_company_id(auth.uid()))
    );

-- Audit logs: admin can view only (read-only)
CREATE POLICY "Admin can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin') 
        AND company_id = public.get_user_company_id(auth.uid())
    );
CREATE POLICY "Superadmin can view all audit logs" ON public.audit_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

-- App settings: users manage their own
CREATE POLICY "Users can manage own settings" ON public.app_settings
    FOR ALL USING (user_id = auth.uid());

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_history;