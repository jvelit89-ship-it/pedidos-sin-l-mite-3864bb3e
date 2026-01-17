-- Create a trigger function to auto-assign admin role to specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_company_id UUID := '00000000-0000-0000-0000-000000000001';
    user_name TEXT;
BEGIN
    -- Get name from user metadata or email
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Create profile
    INSERT INTO public.profiles (user_id, name, email, company_id)
    VALUES (NEW.id, user_name, NEW.email, default_company_id);
    
    -- Assign role based on email
    IF NEW.email = 'jvelit89@gmail.com' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    ELSE
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'vendedor');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();