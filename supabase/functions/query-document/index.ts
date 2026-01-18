import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentQueryRequest {
  document_type: 'dni' | 'ruc';
  document_number: string;
}

interface PersonData {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombre_completo?: string;
  direccion?: string;
}

interface CompanyData {
  razon_social?: string;
  nombre_comercial?: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
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

    // Endpoints de Decolecta API
    const endpoint = document_type === 'dni' 
      ? `https://api.decolecta.com/v1/dni/${document_number}`
      : `https://api.decolecta.com/v1/ruc/${document_number}`;

    console.log(`Calling Decolecta API: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DECOLECTA_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log(`Decolecta API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Decolecta API error: ${errorText}`);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `${document_type.toUpperCase()} no encontrado` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al consultar documento' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: response.status }
      );
    }

    const data = await response.json();
    console.log('Decolecta API response:', JSON.stringify(data));

    let result;

    if (document_type === 'dni') {
      // Formatear respuesta de DNI
      const personData = data as PersonData;
      const nombreCompleto = personData.nombre_completo || 
        [personData.nombres, personData.apellidoPaterno, personData.apellidoMaterno]
          .filter(Boolean)
          .join(' ');
      
      result = {
        success: true,
        data: {
          document_type: 'dni',
          document_number,
          nombre: nombreCompleto,
          direccion: personData.direccion || ''
        }
      };
    } else {
      // Formatear respuesta de RUC
      const companyData = data as CompanyData;
      const direccionCompleta = companyData.direccion || 
        [companyData.direccion, companyData.distrito, companyData.provincia, companyData.departamento]
          .filter(Boolean)
          .join(', ');
      
      result = {
        success: true,
        data: {
          document_type: 'ruc',
          document_number,
          nombre: companyData.razon_social || companyData.nombre_comercial || '',
          direccion: direccionCompleta,
          estado: companyData.estado,
          condicion: companyData.condicion
        }
      };
    }

    console.log('Query result:', JSON.stringify(result));

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
