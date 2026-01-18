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

    // Endpoints correctos según documentación de Decolecta
    // DNI: https://api.decolecta.com/v1/reniec/dni?numero={DNI}
    // RUC: https://api.decolecta.com/v1/sunat/ruc?numero={RUC}
    const endpoint = document_type === 'dni' 
      ? `https://api.decolecta.com/v1/reniec/dni?numero=${document_number}`
      : `https://api.decolecta.com/v1/sunat/ruc?numero=${document_number}`;

    console.log(`Calling Decolecta API: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DECOLECTA_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No se pudo consultar el ${document_type.toUpperCase()}. Verifica el número ingresado.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const responseData = await response.json();
    console.log('API response data:', JSON.stringify(responseData));

    // Procesar respuesta según el tipo de documento
    let result;

    if (document_type === 'dni') {
      // Campos para DNI según documentación:
      // first_name, first_last_name, second_last_name, full_name, document_number
      const nombre = responseData.full_name || 
                     [
                       responseData.first_name,
                       responseData.first_last_name,
                       responseData.second_last_name
                     ].filter(Boolean).join(' ') ||
                     '';
      
      // DNI no retorna dirección según la documentación
      const direccion = responseData.direccion || '';
      
      result = {
        success: true,
        data: {
          document_type: 'dni',
          document_number: responseData.document_number || document_number,
          nombre: nombre.trim(),
          razon_social: null,
          direccion: direccion.trim()
        }
      };
    } else {
      // Campos para RUC según documentación:
      // razon_social, numero_documento, estado, condicion, direccion, 
      // ubigeo, via_tipo, via_nombre, distrito, provincia, departamento, etc.
      const razonSocial = responseData.razon_social || '';
      
      // Construir dirección completa
      let direccion = responseData.direccion || '';
      
      // Si no hay dirección directa, construirla de los componentes
      if (!direccion && (responseData.distrito || responseData.provincia || responseData.departamento)) {
        direccion = [
          responseData.via_tipo,
          responseData.via_nombre,
          responseData.numero ? `NRO. ${responseData.numero}` : '',
          responseData.interior ? `INT. ${responseData.interior}` : '',
          responseData.zona_codigo,
          responseData.zona_tipo,
          responseData.distrito,
          responseData.provincia,
          responseData.departamento
        ].filter(Boolean).join(' ');
      }
      
      result = {
        success: true,
        data: {
          document_type: 'ruc',
          document_number: responseData.numero_documento || document_number,
          nombre: null,
          razon_social: razonSocial.trim(),
          direccion: direccion.trim(),
          estado: responseData.estado,
          condicion: responseData.condicion,
          // Datos adicionales
          departamento: responseData.departamento,
          provincia: responseData.provincia,
          distrito: responseData.distrito
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
