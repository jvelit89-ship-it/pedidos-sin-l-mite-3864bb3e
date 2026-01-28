import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { otpCode } = await req.json();

    if (!otpCode) {
      return new Response(JSON.stringify({ error: 'OTP code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to access OTP data
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find and validate OTP
    const { data: otpData, error: otpError } = await serviceClient
      .from('restore_otp_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('otp_code', otpCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      console.error('OTP validation failed:', otpError);
      return new Response(JSON.stringify({ error: 'Invalid or expired OTP' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark OTP as used
    await serviceClient
      .from('restore_otp_codes')
      .update({ used: true })
      .eq('id', otpData.id);

    // Get user's company_id
    const { data: profileData } = await serviceClient
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profileData?.company_id) {
      return new Response(JSON.stringify({ error: 'User company not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const companyId = profileData.company_id;
    const backupData = otpData.backup_data;
    const selectedTables = otpData.selected_tables;

    const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};

    // Process each selected table
    for (const tableName of selectedTables) {
      const records = backupData[tableName];
      
      if (!Array.isArray(records)) {
        results[tableName] = { deleted: 0, inserted: 0, error: 'No valid data found' };
        continue;
      }

      try {
        // Delete existing records for this company
        const { error: deleteError } = await serviceClient
          .from(tableName)
          .delete()
          .eq('company_id', companyId);

        if (deleteError) {
          console.error(`Error deleting from ${tableName}:`, deleteError);
          results[tableName] = { deleted: 0, inserted: 0, error: deleteError.message };
          continue;
        }

        // Filter records for this company and prepare for insertion
        const companyRecords = records.filter((r: any) => r.company_id === companyId);
        
        if (companyRecords.length === 0) {
          results[tableName] = { deleted: 0, inserted: 0 };
          continue;
        }

        // Insert records in batches
        const batchSize = 100;
        let insertedCount = 0;

        for (let i = 0; i < companyRecords.length; i += batchSize) {
          const batch = companyRecords.slice(i, i + batchSize);
          
          // Remove any auto-generated fields that might conflict
          const cleanedBatch = batch.map((record: any) => {
            const { created_at, updated_at, ...rest } = record;
            return rest;
          });

          const { error: insertError } = await serviceClient
            .from(tableName)
            .upsert(cleanedBatch, { onConflict: 'id', ignoreDuplicates: false });

          if (insertError) {
            console.error(`Error inserting into ${tableName}:`, insertError);
          } else {
            insertedCount += batch.length;
          }
        }

        results[tableName] = { deleted: companyRecords.length, inserted: insertedCount };
        
      } catch (tableError) {
        console.error(`Error processing ${tableName}:`, tableError);
        results[tableName] = { deleted: 0, inserted: 0, error: String(tableError) };
      }
    }

    // Log the restore action
    await serviceClient.from('logs').insert({
      user_id: user.id,
      company_id: companyId,
      entity: 'backup_restore',
      action: 'restore',
      details: {
        tables: selectedTables,
        results,
        restored_at: new Date().toISOString(),
      },
    });

    console.log('Restore completed:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Restore completed',
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in execute-restore:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
