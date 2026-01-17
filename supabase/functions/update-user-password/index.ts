import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePasswordRequest {
  userId?: string; // For team member password update (admin only)
  newPassword: string;
  updateOwnPassword?: boolean; // For admin updating own password
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      throw new Error('Invalid token');
    }

    const { userId, newPassword, updateOwnPassword }: UpdatePasswordRequest = await req.json();

    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // If updating own password
    if (updateOwnPassword) {
      console.log(`Updating own password for user: ${requestingUser.id}`);
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        requestingUser.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('Error updating password:', updateError);
        throw new Error(updateError.message);
      }

      console.log('Own password updated successfully');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For updating team member password - check if admin
    if (!userId) {
      throw new Error('userId is required for team member password update');
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .maybeSingle();

    if (!roleData || !['admin', 'superadmin'].includes(roleData.role)) {
      throw new Error('Only admins can update team member passwords');
    }

    console.log(`Admin updating password for user: ${userId}`);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error(updateError.message);
    }

    console.log('Team member password updated successfully');
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in update-user-password:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
