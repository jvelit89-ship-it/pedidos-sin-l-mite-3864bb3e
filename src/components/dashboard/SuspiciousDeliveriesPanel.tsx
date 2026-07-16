import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, MapPin, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Attempt {
  id: string;
  order_id: string;
  repartidor_name: string | null;
  customer_name: string | null;
  distance_m: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
  reason: string | null;
  created_at: string;
}

export function SuspiciousDeliveriesPanel() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttempts = async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('delivery_location_attempts')
        .select('*')
        .eq('blocked', true)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      setAttempts((data as Attempt[]) || []);
      setLoading(false);
    };
    fetchAttempts();

    const channel = supabase
      .channel('suspicious-deliveries')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'delivery_location_attempts' },
        () => fetchAttempts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return null;
  if (attempts.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          Entregas Sospechosas (bloqueadas hoy)
          <Badge variant="destructive" className="ml-auto">{attempts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {attempts.map((a) => (
            <div key={a.id} className="p-3 bg-white rounded-lg border border-red-100 space-y-1">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p className="font-medium text-sm flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    {a.repartidor_name || 'Repartidor'}
                    <span className="text-muted-foreground">intentó marcar</span>
                    <strong>{a.customer_name || 'cliente'}</strong>
                  </p>
                  <p className="text-xs text-red-700 mt-1">{a.reason}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(a.created_at), 'HH:mm', { locale: es })}
                    </span>
                    {a.distance_m != null && (
                      <span className="flex items-center gap-1 font-semibold text-red-600">
                        <MapPin className="w-3 h-3" />
                        {Math.round(a.distance_m)} m
                      </span>
                    )}
                    {a.driver_lat != null && a.driver_lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${a.driver_lat},${a.driver_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Ver ubicación
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
