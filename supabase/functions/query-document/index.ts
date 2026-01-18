import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentQueryRequest {
  document_type: 'dni' | 'ruc';
  document_number: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_type, document_number }: DocumentQueryRequest = await req.json();
    
    console.log(`Querying ${document_type.toUpperCase()}: ${document_number}`);

    // Validar formato
    if (document_type === 'dni' && document_number.length !== 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'DNI debe tener 8 dígitos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (document_type === 'ruc' && document_number.length !== 11) {
      return new Response(
        JSON.stringify({ success: false, error: 'RUC debe tener 11 dígitos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const DECOLECTA_TOKEN = Deno.env.get('DECOLECTA_API_TOKEN');
    
    if (!DECOLECTA_TOKEN) {
      console.error('DECOLECTA_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API no configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Probar múltiples endpoints de Decolecta API
    const endpoints = document_type === 'dni' 
      ? [
          `https://api.decolecta.com/dni/${document_number}`,
          `https://api.decolecta.com/v1/dni/${document_number}`,
          `https://api.decolecta.com/api/dni/${document_number}`,
          `https://api.decolecta.com/consulta/dni/${document_number}`
        ]
      : [
          `https://api.decolecta.com/ruc/${document_number}`,
          `https://api.decolecta.com/v1/ruc/${document_number}`,
          `https://api.decolecta.com/api/ruc/${document_number}`,
          `https://api.decolecta.com/consulta/ruc/${document_number}`
        ];

    let responseData = null;
    let lastError = null;

    for (const endpoint of endpoints) {
      console.log(`Trying endpoint: ${endpoint}`);
      
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DECOLECTA_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        console.log(`Response status for ${endpoint}: ${response.status}`);

        if (response.ok) {
          responseData = await response.json();
          console.log('API response data:', JSON.stringify(responseData));
          break;
        } else {
          const errorText = await response.text();
          console.log(`Error from ${endpoint}: ${errorText}`);
          lastError = errorText;
        }
      } catch (fetchError) {
        console.log(`Fetch error for ${endpoint}:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : 'Error de conexión';
      }
    }

    if (!responseData) {
      console.error('All endpoints failed. Last error:', lastError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No se pudo consultar el ${document_type.toUpperCase()}. Verifica el número ingresado.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Procesar respuesta según el tipo de documento
    let result;

    if (document_type === 'dni') {
      // Posibles campos para DNI
      const nombre = responseData.nombre_completo || 
                     responseData.nombreCompleto ||
                     responseData.nombre ||
                     [
                       responseData.nombres || responseData.name,
                       responseData.apellidoPaterno || responseData.apellido_paterno || responseData.paterno,
                       responseData.apellidoMaterno || responseData.apellido_materno || responseData.materno
                     ].filter(Boolean).join(' ') ||
                     '';
      
      const direccion = responseData.direccion || 
                        responseData.address || 
                        responseData.domicilio ||
                        '';
      
      result = {
        success: true,
        data: {
          document_type: 'dni',
          document_number,
          nombre: nombre.trim(),
          razon_social: null,
          direccion: direccion.trim()
        }
      };
    } else {
      // Posibles campos para RUC
      const razonSocial = responseData.razon_social || 
                          responseData.razonSocial ||
                          responseData.nombre_o_razon_social ||
                          responseData.nombre ||
                          responseData.name ||
                          '';
      
      const direccion = responseData.direccion || 
                        responseData.direccion_fiscal ||
                        responseData.domicilio_fiscal ||
                        responseData.address ||
                        [
                          responseData.direccion,
                          responseData.distrito,
                          responseData.provincia,
                          responseData.departamento
                        ].filter(Boolean).join(', ') ||
                        '';
      
      result = {
        success: true,
        data: {
          document_type: 'ruc',
          document_number,
          nombre: null,
          razon_social: razonSocial.trim(),
          direccion: direccion.trim(),
          estado: responseData.estado || responseData.state,
          condicion: responseData.condicion || responseData.condition
        }
      };
    }

    console.log('Final result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in query-document:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
