import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Maximize2,
  RefreshCw,
  Satellite,
  Truck,
  MapPinned,
  Radio,
} from 'lucide-react';

interface FleetVehicle {
  plate: string;
  label: string;
  liveUrl: string;
}

const FLEET_VEHICLES: FleetVehicle[] = [
  {
    plate: 'CNL-773',
    label: 'Vehículo de reparto 1',
    liveUrl: 'https://plataforma.seguriper.com.pe/sharing/a2fe16ddc64209c5ee4e8ebc3376e005',
  },
  {
    plate: 'AVT-856',
    label: 'Vehículo de reparto 2',
    liveUrl: 'https://plataforma.seguriper.com.pe/sharing/f6c65ccdb8ca90b32359bb1a512a2368',
  },
];

export function SuperadminVehicleTracker() {
  const [selectedPlate, setSelectedPlate] = useState(FLEET_VEHICLES[0].plate);
  const [frameKey, setFrameKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const selectedVehicle = useMemo(
    () => FLEET_VEHICLES.find((vehicle) => vehicle.plate === selectedPlate) ?? FLEET_VEHICLES[0],
    [selectedPlate],
  );

  const iframeSrc = useMemo(() => {
    const separator = selectedVehicle.liveUrl.includes('?') ? '&' : '?';
    return `${selectedVehicle.liveUrl}${separator}embed_refresh=${frameKey}`;
  }, [selectedVehicle, frameKey]);

  const selectVehicle = (plate: string) => {
    if (plate === selectedPlate) return;
    setLoaded(false);
    setSelectedPlate(plate);
    setFrameKey((current) => current + 1);
  };

  const refreshTracker = () => {
    setLoaded(false);
    setFrameKey((current) => current + 1);
  };

  const openLiveMap = (vehicle: FleetVehicle = selectedVehicle) => {
    window.open(vehicle.liveUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="overflow-hidden border-primary/20 shadow-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-950/5 via-primary/10 to-background">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Satellite className="w-5 h-5" />
              </span>
              Flota de reparto · GPS en vivo
              <Badge variant="outline" className="font-semibold border-primary/30 bg-background">
                2 vehículos
              </Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                <Radio className="w-3 h-3 mr-1" />
                En vivo
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Seguimiento centralizado de CNL-773 y AVT-856 mediante SEGURIPER GPS
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={refreshTracker}>
              <RefreshCw className="w-4 h-4" />
              Actualizar GPS
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => openLiveMap()}>
              <ExternalLink className="w-4 h-4" />
              Abrir {selectedVehicle.plate}
            </Button>
            <Button size="sm" className="gap-2" onClick={() => openLiveMap()}>
              <Maximize2 className="w-4 h-4" />
              Vista completa
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border-b bg-muted/10">
          {FLEET_VEHICLES.map((vehicle) => {
            const active = vehicle.plate === selectedVehicle.plate;

            return (
              <button
                key={vehicle.plate}
                type="button"
                onClick={() => selectVehicle(vehicle.plate)}
                className={[
                  'group rounded-xl border p-3 sm:p-4 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 text-blue-700">
                        <Truck className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="font-black text-lg tracking-wide">{vehicle.plate}</p>
                        <p className="text-xs text-muted-foreground">{vehicle.label}</p>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={active ? 'default' : 'outline'}
                    className={active ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                  >
                    {active ? '● Viendo ahora' : 'Ver GPS'}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <MapPinned className="w-3.5 h-3.5" />
                    SEGURIPER GPS
                  </span>

                  <span
                    role="button"
                    tabIndex={0}
                    className="text-primary font-semibold hover:underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      openLiveMap(vehicle);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        openLiveMap(vehicle);
                      }
                    }}
                  >
                    Abrir mapa ↗
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-b bg-background flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
              <MapPinned className="w-4 h-4" />
            </span>
            <div>
              <p className="font-semibold text-sm">Monitoreando {selectedVehicle.plate}</p>
              <p className="text-xs text-muted-foreground">
                Selecciona cualquiera de los dos vehículos para cambiar la vista en vivo.
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="w-fit">
            {selectedVehicle.label}
          </Badge>
        </div>

        <div className="relative bg-muted/30 min-h-[560px]">
          {!loaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
              <div className="text-center space-y-3">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-primary" />
                <div>
                  <p className="font-medium">Conectando con SEGURIPER GPS…</p>
                  <p className="text-xs text-muted-foreground">
                    Cargando ubicación en vivo de {selectedVehicle.plate}
                  </p>
                </div>
              </div>
            </div>
          )}

          <iframe
            key={`${selectedVehicle.plate}-${frameKey}`}
            src={iframeSrc}
            title={`GPS en vivo ${selectedVehicle.plate}`}
            className="w-full h-[560px] lg:h-[640px] border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="geolocation; fullscreen"
            onLoad={() => setLoaded(true)}
          />
        </div>

        <div className="px-4 py-3 border-t bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <span>
            La ubicación proviene de los vínculos compartidos de SEGURIPER GPS.
          </span>
          <span>
            CNL-773 y AVT-856 están disponibles desde este mismo panel.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
