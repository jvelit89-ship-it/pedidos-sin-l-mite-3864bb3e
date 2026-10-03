import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocumentQueryRequest {
  document_type: "dni" | "ruc";
  document_number: string;
}

type SunatRecord = {
  ruc: string;
  razon_social: string;
  estado?: string | null;
  condicion?: string | null;
  tipo_contribuyente?: string | null;
  ubigeo?: string | null;
  direccion?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function naturalPersonRucFromDni(dni: string): string {
  const firstTen = `10${dni}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = firstTen
    .split("")
    .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) check = 1;
  return `${firstTen}${check}`;
}

async function querySunatPublicMirror(ruc: string): Promise<SunatRecord | null> {
  // Public mirror generated daily from SUNAT's official "Padrón reducido RUC".
  // Partitioning by the first 5 digits keeps each lookup reasonably small.
  const prefix = ruc.slice(0, 5);
  const url =
    `https://cdn.jsdelivr.net/gh/alb3rt0ru1z/tribio-padron-ruc@main/chunks/${prefix}.json`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Pedidos-INNSA-NMA/1.0",
    },
  });

  if (!response.ok) {
    console.warn("SUNAT public mirror unavailable", response.status, prefix);
    return null;
  }

  const payload = await response.json();
  const columns = Array.isArray(payload?.columns) ? payload.columns : [];
  const records = Array.isArray(payload?.records) ? payload.records : [];
  const indexByColumn = Object.fromEntries(columns.map((name: string, index: number) => [name, index]));
  const record = records.find((row: unknown[]) => String(row?.[indexByColumn.ruc] ?? "") === ruc);

  if (!record) return null;

  const get = (name: string) => {
    const index = indexByColumn[name];
    return typeof index === "number" ? record[index] ?? null : null;
  };

  return {
    ruc: String(get("ruc") ?? ruc),
    razon_social: String(get("razon_social") ?? ""),
    estado: get("estado"),
    condicion: get("condicion"),
    tipo_contribuyente: get("tipo_contribuyente"),
    ubigeo: get("ubigeo"),
    direccion: get("direccion"),
    departamento: get("departamento"),
    provincia: get("provincia"),
    distrito: get("distrito"),
  };
}

async function queryDecolecta(
  documentType: "dni" | "ruc",
  documentNumber: string,
  token: string,
) {
  const endpoint = documentType === "dni"
    ? `https://api.decolecta.com/v1/reniec/dni?numero=${documentNumber}`
    : `https://api.decolecta.com/v1/sunat/ruc?numero=${documentNumber}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.warn("Decolecta lookup failed", response.status);
    return null;
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DocumentQueryRequest = await req.json();
    const documentType = body.document_type;
    const documentNumber = String(body.document_number ?? "").replace(/\D/g, "");

    if (!["dni", "ruc"].includes(documentType)) {
      return json({ success: false, error: "Tipo de documento no válido" }, 400);
    }

    const expectedLength = documentType === "dni" ? 8 : 11;
    if (documentNumber.length !== expectedLength) {
      return json({
        success: false,
        error: documentType === "dni"
          ? "DNI debe tener 8 dígitos"
          : "RUC debe tener 11 dígitos",
      }, 400);
    }

    console.log(`Querying ${documentType.toUpperCase()}: ${documentNumber}`);

    // Provider 1: Decolecta when a token is configured.
    const decolectaToken = Deno.env.get("DECOLECTA_API_TOKEN");
    if (decolectaToken) {
      try {
        const responseData = await queryDecolecta(documentType, documentNumber, decolectaToken);
        if (responseData) {
          if (documentType === "dni") {
            const nombre = responseData.full_name ||
              [
                responseData.first_name,
                responseData.first_last_name,
                responseData.second_last_name,
              ].filter(Boolean).join(" ");

            return json({
              success: true,
              source: "decolecta",
              data: {
                document_type: "dni",
                document_number: responseData.document_number || documentNumber,
                nombre: String(nombre || "").trim(),
                razon_social: null,
                direccion: String(responseData.direccion || "").trim(),
              },
            });
          }

          let direccion = responseData.direccion || "";
          if (!direccion && (responseData.distrito || responseData.provincia || responseData.departamento)) {
            direccion = [
              responseData.via_tipo,
              responseData.via_nombre,
              responseData.numero ? `NRO. ${responseData.numero}` : "",
              responseData.interior ? `INT. ${responseData.interior}` : "",
              responseData.zona_codigo,
              responseData.zona_tipo,
              responseData.distrito,
              responseData.provincia,
              responseData.departamento,
            ].filter(Boolean).join(" ");
          }

          return json({
            success: true,
            source: "decolecta",
            data: {
              document_type: "ruc",
              document_number: responseData.numero_documento || documentNumber,
              nombre: null,
              razon_social: String(responseData.razon_social || "").trim(),
              direccion: String(direccion || "").trim(),
              estado: responseData.estado,
              condicion: responseData.condicion,
              departamento: responseData.departamento,
              provincia: responseData.provincia,
              distrito: responseData.distrito,
            },
          });
        }
      } catch (error) {
        console.warn("Decolecta provider exception:", error);
      }
    } else {
      console.warn("DECOLECTA_API_TOKEN not configured; using SUNAT public-data fallback");
    }

    // Provider 2: public SUNAT reduced registry mirror.
    // For DNI we can only resolve people who also have a natural-person RUC.
    const lookupRuc = documentType === "ruc"
      ? documentNumber
      : naturalPersonRucFromDni(documentNumber);

    try {
      const record = await querySunatPublicMirror(lookupRuc);
      if (record) {
        const displayName = record.razon_social?.trim() || "";
        return json({
          success: true,
          source: "sunat_padron_reducido",
          data: {
            document_type: documentType,
            document_number: documentNumber,
            ruc: record.ruc,
            nombre: documentType === "dni" ? displayName : null,
            razon_social: documentType === "ruc" ? displayName : null,
            direccion: String(record.direccion || "").trim(),
            estado: record.estado,
            condicion: record.condicion,
            ubigeo: record.ubigeo,
            departamento: record.departamento,
            provincia: record.provincia,
            distrito: record.distrito,
          },
        });
      }
    } catch (error) {
      console.error("SUNAT public-data fallback exception:", error);
    }

    // Never block new-customer registration just because the external service is unavailable.
    return json({
      success: false,
      manual_allowed: true,
      error: documentType === "dni"
        ? "No se encontraron datos automáticos para este DNI. Puedes registrar el cliente manualmente."
        : "No se encontraron datos automáticos para este RUC. Puedes registrar el cliente manualmente.",
    });
  } catch (error) {
    console.error("Error in query-document:", error);
    return json({
      success: false,
      manual_allowed: true,
      error: "La consulta externa no está disponible. Puedes continuar el registro manualmente.",
    });
  }
});
