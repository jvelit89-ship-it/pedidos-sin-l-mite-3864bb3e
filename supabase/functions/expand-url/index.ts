import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Expanding URL:', url);

    // Follow redirects to get the final URL
    // Use GET because some shorteners (like goo.gl) might not support HEAD properly
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    const expandedUrl = response.url;
    console.log('Expanded URL:', expandedUrl);

    // Extract coordinates from the expanded URL
    const coordinates = extractCoordinates(expandedUrl);

    return new Response(
      JSON.stringify({ 
        expandedUrl, 
        coordinates,
        success: coordinates !== null 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error expanding URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractCoordinates(url: string): { lat: number; lng: number } | null {
  try {
    const decodedUrl = decodeURIComponent(url);

    // Pattern 1: @lat,lng (most common)
    const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const atMatch = decodedUrl.match(atPattern);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // Pattern 2: ?q=lat,lng or &q=lat,lng or search?q=...
    const qPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const qMatch = decodedUrl.match(qPattern);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // Pattern 3: /place/lat,lng or /search/lat,lng
    const placePattern = /\/(?:place|search)\/(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const placeMatch = decodedUrl.match(placePattern);
    if (placeMatch) {
      return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
    }

    // Pattern 4: ll=lat,lng
    const llPattern = /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const llMatch = decodedUrl.match(llPattern);
    if (llMatch) {
      return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
    }

    // Pattern 5: !3d lat !4d lng (from embed URLs or search results)
    const embedPattern = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/;
    const embedMatch = decodedUrl.match(embedPattern);
    if (embedMatch) {
      return { lat: parseFloat(embedMatch[1]), lng: parseFloat(embedMatch[2]) };
    }

    // Pattern 6: data= with coordinates (various formats)
    const dataPattern1 = /!1d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/;
    const dataMatch1 = decodedUrl.match(dataPattern1);
    if (dataMatch1) {
      // In some formats, 1d is lng and 2d is lat
      // But typically 3d is lat, 4d is lng.
      // Let's check common Google Maps data strings
      return { lat: parseFloat(dataMatch1[1]), lng: parseFloat(dataMatch1[2]) };
    }

    const dataPattern2 = /!1d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/; // Alias for consistency
    
    // Pattern 7: center=lat,lng
    const centerPattern = /center=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const centerMatch = decodedUrl.match(centerPattern);
    if (centerMatch) {
      return { lat: parseFloat(centerMatch[1]), lng: parseFloat(centerMatch[2]) };
    }

    // Pattern 8: Generic coordinate pattern (more flexible)
    // Matches something like -12.0464,-77.0428
    const genericPattern = /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/;
    const genericMatch = decodedUrl.match(genericPattern);
    if (genericMatch) {
      const lat = parseFloat(genericMatch[1]);
      const lng = parseFloat(genericMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }

    return null;
  } catch {
    return null;
  }
}
