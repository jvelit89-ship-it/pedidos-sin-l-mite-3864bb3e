import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteTeamUserRequest {
  teamMemberId?: string;
  role?: 'vendedor' | 'repartidor' | 'operario';
  orphanUserId?: string; // For cleaning up orphan auth users
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
      throw new Error('Only admins can delete team members');
    }

    const { teamMemberId, role, orphanUserId }: DeleteTeamUserRequest = await req.json();

    // Handle orphan user cleanup (when user exists in auth but not in team tables)
    if (orphanUserId) {
      console.log(`Cleaning up orphan user: ${orphanUserId}`);
      
      // Delete user_roles
      await supabaseAdmin.from('user_roles').delete().eq('user_id', orphanUserId);
      // Delete profile
      await supabaseAdmin.from('profiles').delete().eq('user_id', orphanUserId);
      // Delete the auth user
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(orphanUserId);
      
      if (authDeleteError) {
        console.error('Error deleting orphan auth user:', authDeleteError);
        throw new Error('Error deleting orphan user');
      }
      
      console.log(`Orphan user ${orphanUserId} deleted successfully`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Deleting ${role} with ID: ${teamMemberId}`);

    // Get the team member record to find the user_id
    const tableName = role === 'vendedor' ? 'vendedores' : role === 'repartidor' ? 'repartidores' : 'operarios';
    const { data: teamMember, error: fetchError } = await supabaseAdmin
      .from(tableName)
      .select('user_id, name')
      .eq('id', teamMemberId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching team member:', fetchError);
      throw new Error('Error fetching team member');
    }

    if (!teamMember) {
      throw new Error('Team member not found');
    }

    const userId = teamMember.user_id;
    console.log(`Team member ${teamMember.name} has user_id: ${userId}`);

    // Delete from vendedores/repartidores table first
    const { error: deleteTableError } = await supabaseAdmin
      .from(tableName)
      .delete()
      .eq('id', teamMemberId);

    if (deleteTableError) {
      console.error(`Error deleting from ${tableName}:`, deleteTableError);
      throw new Error(`Error deleting ${role} record`);
    }

    console.log(`Deleted from ${tableName} table`);

    // If user has an auth account, delete related records and auth user
    if (userId) {
      // Delete user_roles
      const { error: roleDeleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleDeleteError) {
        console.error('Error deleting user role:', roleDeleteError);
        // Continue anyway
      } else {
        console.log('Deleted user role');
      }

      // Delete profile
      const { error: profileDeleteError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileDeleteError) {
        console.error('Error deleting profile:', profileDeleteError);
        // Continue anyway
      } else {
        console.log('Deleted profile');
      }

      // Delete the auth user
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        // Don't throw, the main record is already deleted
      } else {
        console.log(`Auth user ${userId} deleted successfully`);
      }
    }

    console.log(`${role} deleted successfully`);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in delete-team-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
