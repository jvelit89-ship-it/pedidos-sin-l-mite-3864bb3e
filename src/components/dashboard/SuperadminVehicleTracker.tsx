import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Maximize2, RefreshCw, Satellite, Truck } from 'lucide-react';

const GPS_LIVE_URL = 'https://plataforma.seguriper.com.pe/sharing/a2fe16ddc64209c5ee4e8ebc3376e005';

export function SuperadminVehicleTracker() {
  const [frameKey, setFrameKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const iframeSrc = useMemo(() => {
    const separator = GPS_LIVE_URL.includes('?') ? '&' : '?';
    return `${GPS_LIVE_URL}${separator}embed_refresh=${frameKey}`;
  }, [frameKey]);

  const refreshTracker = () => {
    setLoaded(false);
    setFrameKey((current) => current + 1);
  };

  const openLiveMap = () => {
    window.open(GPS_LIVE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 via-background to-background">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
                <Satellite className="w-5 h-5" />
              </span>
              Seguimiento GPS en vivo
              <Badge variant="outline" className="font-semibold border-primary/30 bg-background">
                CNL-773
              </Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                ● En vivo
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Vehículo de reparto monitoreado mediante SEGURIPER GPS
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={refreshTracker}>
              <RefreshCw className="w-4 h-4" />
              Actualizar GPS
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={openLiveMap}>
              <ExternalLink className="w-4 h-4" />
              Abrir mapa
            </Button>
            <Button size="sm" className="gap-2" onClick={openLiveMap}>
              <Maximize2 className="w-4 h-4" />
              Vista completa
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative bg-muted/30 min-h-[560px]">
          {!loaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
              <div className="text-center space-y-3">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-primary" />
                <div>
                  <p className="font-medium">Conectando con SEGURIPER GPS…</p>
                  <p className="text-xs text-muted-foreground">Cargando ubicación en vivo de CNL-773</p>
                </div>
              </div>
            </div>
          )}

          <iframe
            key={frameKey}
            src={iframeSrc}
            title="GPS en vivo CNL-773"
            className="w-full h-[560px] lg:h-[640px] border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="geolocation; fullscreen"
            onLoad={() => setLoaded(true)}
          />
        </div>

        <div className="px-4 py-3 border-t bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <span>La ubicación mostrada proviene del vínculo compartido de SEGURIPER GPS.</span>
          <span>Si el mapa no carga dentro del panel, usa “Abrir mapa”.</span>
        </div>
      </CardContent>
    </Card>
  );
}
