import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'superadmin'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Only admins can restore backups' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { backupData, selectedTables } = await req.json();

    if (!backupData || !selectedTables || selectedTables.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing backup data or selected tables' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP and backup data
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: insertError } = await serviceClient
      .from('restore_otp_codes')
      .insert({
        user_id: user.id,
        otp_code: otpCode,
        backup_data: backupData,
        selected_tables: selectedTables,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to generate OTP' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send OTP via email
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    const tableList = selectedTables.join(', ');
    const recordCounts = selectedTables.map((table: string) => {
      const records = backupData[table];
      return `${table}: ${Array.isArray(records) ? records.length : 0} registros`;
    }).join('<br>');

    const { error: emailError } = await resend.emails.send({
      from: 'SISPETI <noreply@sispeti.lovable.app>',
      to: [user.email!],
      subject: '🔐 Código de Verificación - Restauración de Backup',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #f59e0b; text-align: center;">⚠️ Restauración de Backup</h1>
          <p>Se ha solicitado restaurar datos desde un backup.</p>
          
          <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #92400e;">Tablas a restaurar:</h3>
            <p style="font-size: 14px; color: #78350f;">${recordCounts}</p>
          </div>
          
          <div style="background: #1f2937; border-radius: 8px; padding: 30px; text-align: center; margin: 20px 0;">
            <p style="color: #9ca3af; margin: 0 0 10px 0;">Tu código de verificación:</p>
            <h2 style="color: #f59e0b; font-size: 36px; letter-spacing: 8px; margin: 0;">${otpCode}</h2>
          </div>
          
          <p style="color: #dc2626; font-weight: bold;">⚠️ Esta acción reemplazará los datos existentes en las tablas seleccionadas.</p>
          <p style="color: #6b7280; font-size: 14px;">Este código expira en 10 minutos.</p>
          <p style="color: #6b7280; font-size: 12px;">Si no solicitaste esta restauración, ignora este correo.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      return new Response(JSON.stringify({ error: 'Failed to send OTP email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Restore OTP sent to:', user.email);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'OTP sent to your email',
      email: user.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3')
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in send-restore-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
