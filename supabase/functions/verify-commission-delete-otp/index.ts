 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 };
 
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
     const { otpCode } = await req.json();
 
     if (!otpCode) {
       return new Response(
         JSON.stringify({ error: 'Código OTP requerido' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
 
     // Find valid OTP
     const { data: otpRecord, error: otpError } = await serviceClient
       .from('commission_delete_otp_codes')
       .select('*')
       .eq('user_id', userId)
       .eq('otp_code', otpCode)
       .eq('used', false)
       .gt('expires_at', new Date().toISOString())
       .order('created_at', { ascending: false })
       .limit(1)
       .maybeSingle();
 
     if (otpError || !otpRecord) {
       return new Response(
         JSON.stringify({ error: 'Código OTP inválido o expirado' }),
         { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Mark OTP as used
     await serviceClient
       .from('commission_delete_otp_codes')
       .update({ used: true })
       .eq('id', otpRecord.id);
 
     const { commission_type, target_name, record_ids } = otpRecord;
     let deletedCount = 0;
 
     if (commission_type === 'vendedor') {
       // Delete orders (this will cascade to order_items)
       // First get the order items to restore stock
       for (const orderId of record_ids) {
         const { data: orderItems } = await serviceClient
           .from('order_items')
           .select('product_id, quantity')
           .eq('order_id', orderId);
 
         // Delete stock movements related to this order
         await serviceClient
           .from('stock_movements')
           .delete()
           .eq('reference_id', orderId);
 
         // For delivered orders, restore stock
         const { data: order } = await serviceClient
           .from('orders')
           .select('status')
           .eq('id', orderId)
           .maybeSingle();
 
          if (order?.status === 'delivered' && orderItems) {
            for (const item of orderItems) {
              // Restore stock by incrementing
              const { data: product } = await serviceClient
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .maybeSingle();
              
              if (product) {
                await serviceClient
                  .from('products')
                  .update({ stock: product.stock + item.quantity })
                  .eq('id', item.product_id);
              }
            }
          }
 
         // Delete order items
         await serviceClient
           .from('order_items')
           .delete()
           .eq('order_id', orderId);
 
         // Delete the order
         const { error: deleteError } = await serviceClient
           .from('orders')
           .delete()
           .eq('id', orderId);
 
         if (!deleteError) {
           deletedCount++;
         }
       }
 
       console.log(`Deleted ${deletedCount} orders for vendedor ${target_name}`);
 
     } else if (commission_type === 'operario') {
       // Delete production history records
       for (const productionId of record_ids) {
         // Get production details to adjust stock
         const { data: production } = await serviceClient
           .from('production_history')
           .select('product_id, quantity, company_id')
           .eq('id', productionId)
           .maybeSingle();
 
         if (production) {
           // Reduce stock (reverse the production)
           const { data: product } = await serviceClient
             .from('products')
             .select('stock')
             .eq('id', production.product_id)
             .maybeSingle();
 
           if (product) {
             await serviceClient
               .from('products')
               .update({ stock: Math.max(0, product.stock - production.quantity) })
               .eq('id', production.product_id);
           }
 
           // Delete related stock movements
           await serviceClient
             .from('stock_movements')
             .delete()
             .eq('reference_id', productionId);
 
           // Delete the production record
           const { error: deleteError } = await serviceClient
             .from('production_history')
             .delete()
             .eq('id', productionId);
 
           if (!deleteError) {
             deletedCount++;
           }
         }
       }
 
       console.log(`Deleted ${deletedCount} production records for operario ${target_name}`);
     }
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         message: `Se eliminaron ${deletedCount} registros de ${target_name}`,
         deletedCount 
       }),
       { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Error in verify-commission-delete-otp:', error);
     return new Response(
       JSON.stringify({ error: 'Error interno del servidor' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 };
 
 serve(handler);