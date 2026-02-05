 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import { Resend } from "https://esm.sh/resend@2.0.0";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
 function generateOTP(): string {
   return Math.floor(100000 + Math.random() * 900000).toString();
 }
 
 const handler = async (req: Request): Promise<Response> => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const authHeader = req.headers.get('Authorization');
     if (!authHeader?.startsWith('Bearer ')) {
       return new Response(
         JSON.stringify({ error: 'No autorizado' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 
     const supabase = createClient(supabaseUrl, supabaseAnonKey, {
       global: { headers: { Authorization: authHeader } },
     });
 
     const token = authHeader.replace('Bearer ', '');
     const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
     if (claimsError || !claimsData?.claims) {
       return new Response(
         JSON.stringify({ error: 'Token inválido' }),
         { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const userId = claimsData.claims.sub as string;
 
     // Check admin role
     const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
     const { data: userRole } = await serviceClient
       .from('user_roles')
       .select('role')
       .eq('user_id', userId)
       .maybeSingle();
 
     if (!userRole || !['admin', 'superadmin'].includes(userRole.role)) {
       return new Response(
         JSON.stringify({ error: 'Solo administradores pueden eliminar comisiones' }),
         { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const { commissionType, targetId, targetName, recordIds, year, month, period } = await req.json();
 
     if (!commissionType || !targetId || !targetName || !recordIds || recordIds.length === 0) {
       return new Response(
         JSON.stringify({ error: 'Datos incompletos' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Get user email
     const { data: profile } = await serviceClient
       .from('profiles')
       .select('email')
       .eq('user_id', userId)
       .maybeSingle();
 
     if (!profile?.email) {
       return new Response(
         JSON.stringify({ error: 'No se encontró el email del usuario' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const otpCode = generateOTP();
     const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
 
     // Store OTP
     const { error: insertError } = await serviceClient
       .from('commission_delete_otp_codes')
       .insert({
         user_id: userId,
         otp_code: otpCode,
         commission_type: commissionType,
         target_id: targetId,
         target_name: targetName,
         record_ids: recordIds,
         year,
         month,
         period: period || null,
         expires_at: expiresAt.toISOString(),
       });
 
     if (insertError) {
       console.error('Error storing OTP:', insertError);
       return new Response(
         JSON.stringify({ error: 'Error al generar código' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Send email
     const resendApiKey = Deno.env.get('RESEND_API_KEY');
     if (!resendApiKey) {
       return new Response(
         JSON.stringify({ error: 'Configuración de email faltante' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const resend = new Resend(resendApiKey);
     const typeLabel = commissionType === 'vendedor' ? 'Vendedor' : 'Operario';
     const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                         'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
     
     const periodLabel = period === 1 ? 'Periodo 1 (1-15)' : 
                         period === 2 ? `Periodo 2 (16-${new Date(year, month, 0).getDate()})` : 
                         'Mes completo';
 
     const { error: emailError } = await resend.emails.send({
       from: 'Sistema <onboarding@resend.dev>',
       to: [profile.email],
       subject: `Código OTP - Eliminar comisiones de ${targetName}`,
       html: `
         <h2>Confirmación de eliminación de comisiones</h2>
         <p>Se ha solicitado eliminar comisiones con los siguientes detalles:</p>
         <ul>
           <li><strong>Tipo:</strong> ${typeLabel}</li>
           <li><strong>Nombre:</strong> ${targetName}</li>
           <li><strong>Mes:</strong> ${monthNames[month - 1]} ${year}</li>
           <li><strong>Periodo:</strong> ${periodLabel}</li>
           <li><strong>Registros a eliminar:</strong> ${recordIds.length}</li>
         </ul>
         <p style="font-size: 24px; font-weight: bold; color: #e11d48;">
           Código OTP: ${otpCode}
         </p>
         <p>Este código expira en 10 minutos.</p>
         <p style="color: #666; font-size: 12px;">
           Si no solicitaste esta eliminación, ignora este correo.
         </p>
       `,
     });
 
     if (emailError) {
       console.error('Error sending email:', emailError);
       return new Response(
         JSON.stringify({ error: 'Error al enviar email' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     console.log(`Commission delete OTP sent to ${profile.email} for ${targetName}`);
 
     return new Response(
       JSON.stringify({ success: true, message: 'Código OTP enviado' }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Error in send-commission-delete-otp:', error);
     return new Response(
       JSON.stringify({ error: 'Error interno del servidor' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 };
 
 serve(handler);