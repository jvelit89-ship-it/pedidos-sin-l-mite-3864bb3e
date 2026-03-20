import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  productId: string;
  pendingChanges: Record<string, any>;
  productName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData || (roleData.role !== "admin" && roleData.role !== "superadmin")) {
      return new Response(
        JSON.stringify({ error: "Only admins can edit products" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { productId, pendingChanges, productName }: SendOtpRequest = await req.json();

    console.log("Received request:", { productId, pendingChanges, productName });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Store OTP in the product_edit_otp_codes table
    const { error: otpError } = await supabase
      .from("product_edit_otp_codes")
      .insert({
        user_id: user.id,
        otp_code: otp,
        product_id: productId,
        pending_changes: pendingChanges,
        expires_at: expiresAt.toISOString(),
      });

    if (otpError) {
      console.error("Error storing OTP:", otpError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format changes for email
    const changesHtml = Object.entries(pendingChanges)
      .map(([key, value]) => {
        const labels: Record<string, string> = {
          name: 'Nombre',
          sku: 'SKU',
          category: 'Categoría',
          stock: 'Stock',
          min_stock: 'Stock Mínimo',
          price: 'Precio',
          notes: 'Notas',
          commission_amount: 'Comisión Vendedor',
          operario_commission_amount: 'Comisión Operario',
          repartidor_commission_amount: 'Comisión Repartidor',
        };
        const displayValue = typeof value === 'number' ? `S/ ${value.toFixed(2)}` : value;
        return `<li><strong>${labels[key] || key}:</strong> ${displayValue}</li>`;
      })
      .join('');

    // Send email with OTP
    const emailResponse = await resend.emails.send({
      from: "Sistema de Pedidos <onboarding@resend.dev>",
      to: [user.email!],
      subject: "Código de verificación para editar producto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">🔐 Verificación de Edición</h1>
          <p>Has solicitado editar el producto <strong>"${productName}"</strong>.</p>
          <p>Cambios pendientes:</p>
          <ul style="background-color: #f3f4f6; padding: 15px 30px; border-radius: 8px;">
            ${changesHtml}
          </ul>
          <p>Tu código de verificación es:</p>
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e40af;">${otp}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Este código expira en 10 minutos.</p>
        </div>
      `,
    });

    console.log("OTP email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent to email" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-product-edit-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
