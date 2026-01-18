import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTeamUserRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'vendedor' | 'repartidor' | 'operario';
  zone?: string;
  active: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      throw new Error('Invalid token');
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .maybeSingle();

    if (!roleData || !['admin', 'superadmin'].includes(roleData.role)) {
      throw new Error('Only admins can create team members');
    }

    // Get company_id of the admin
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('user_id', requestingUser.id)
      .maybeSingle();

    if (!adminProfile?.company_id) {
      throw new Error('Admin has no company assigned');
    }

    const { email, password, name, phone, role, zone, active }: CreateTeamUserRequest = await req.json();

    console.log(`Creating ${role} user: ${email}`);

    // Create the user in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error('Error creating user:', createError);
      throw new Error(createError.message);
    }

    const userId = newUser.user.id;
    console.log(`User created with ID: ${userId}`);

    // Update the profile (it's auto-created by handle_new_user trigger, so we update it)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name,
        email,
        phone,
        company_id: adminProfile.company_id,
      })
      .eq('user_id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Cleanup: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Error updating profile');
    }

    // Update role (delete the auto-assigned role first, then insert the correct one)
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role,
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Error assigning role');
    }

    // Create vendedor or repartidor record
    if (role === 'vendedor') {
      const { data: vendedor, error: vendedorError } = await supabaseAdmin
        .from('vendedores')
        .insert({
          user_id: userId,
          name,
          email,
          phone,
          active,
          company_id: adminProfile.company_id,
        })
        .select()
        .single();

      if (vendedorError) {
        console.error('Error creating vendedor:', vendedorError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error('Error creating vendedor record');
      }

      console.log(`Vendedor created successfully: ${vendedor.id}`);
      
      return new Response(JSON.stringify({ success: true, data: vendedor }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (role === 'repartidor') {
      const { data: repartidor, error: repartidorError } = await supabaseAdmin
        .from('repartidores')
        .insert({
          user_id: userId,
          name,
          email,
          phone,
          zone: zone || null,
          active,
          company_id: adminProfile.company_id,
        })
        .select()
        .single();

      if (repartidorError) {
        console.error('Error creating repartidor:', repartidorError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error('Error creating repartidor record');
      }

      console.log(`Repartidor created successfully: ${repartidor.id}`);
      
      return new Response(JSON.stringify({ success: true, data: repartidor }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // operario
      const { data: operario, error: operarioError } = await supabaseAdmin
        .from('operarios')
        .insert({
          user_id: userId,
          name,
          email,
          phone,
          active,
          company_id: adminProfile.company_id,
        })
        .select()
        .single();

      if (operarioError) {
        console.error('Error creating operario:', operarioError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error('Error creating operario record');
      }

      console.log(`Operario created successfully: ${operario.id}`);
      
      return new Response(JSON.stringify({ success: true, data: operario }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('Error in create-team-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
