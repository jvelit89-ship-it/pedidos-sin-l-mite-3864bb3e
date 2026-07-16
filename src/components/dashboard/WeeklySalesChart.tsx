import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { BarChart3, TrendingUp, Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBusinessDateKey } from '@/lib/limaTime';

type RangeMode = 'week' | 'lastweek' | 'month' | 'custom';

interface Row {
  order_id: string;
  delivered_at: string | null;
  created_at: string;
  vendedor_name: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  product_id: string;
  product_name: string;
}

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function WeeklySalesChart() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<RangeMode>('week');
  const [customStart, setCustomStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [vendedor, setVendedor] = useState<string>('all');
  const [product, setProduct] = useState<string>('all');

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (mode === 'week') return { startDate: startOfWeek(now, { weekStartsOn: 1 }), endDate: endOfWeek(now, { weekStartsOn: 1 }) };
    if (mode === 'lastweek') {
      const s = addDays(startOfWeek(now, { weekStartsOn: 1 }), -7);
      return { startDate: s, endDate: addDays(s, 6) };
    }
    if (mode === 'month') return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    return { startDate: new Date(customStart + 'T00:00:00'), endDate: new Date(customEnd + 'T23:59:59') };
  }, [mode, customStart, customEnd]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.companyId) return;
      setLoading(true);
      try {
        const from = new Date(startDate); from.setHours(0, 0, 0, 0);
        const to = new Date(endDate); to.setHours(23, 59, 59, 999);
        // Fetch delivered orders in range with items
        const { data, error } = await supabase
          .from('orders')
          .select('id, delivered_at, created_at, vendedor_name, status, company_id, order_items(product_id, product_name, quantity, unit_price, total)')
          .eq('company_id', user.company_id)
          .eq('status', 'delivered')
          .gte('delivered_at', from.toISOString())
          .lte('delivered_at', to.toISOString());
        if (error) throw error;
        const flat: Row[] = [];
        (data || []).forEach((o: any) => {
          (o.order_items || []).forEach((it: any) => {
            flat.push({
              order_id: o.id,
              delivered_at: o.delivered_at,
              created_at: o.created_at,
              vendedor_name: o.vendedor_name,
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              total: Number(it.total) || 0,
              product_id: it.product_id,
              product_name: it.product_name,
            });
          });
        });
        setRows(flat);
      } catch (e) {
        console.error('WeeklySalesChart error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.companyId, startDate, endDate]);

  const vendedores = useMemo(
    () => Array.from(new Set(rows.map(r => r.vendedor_name).filter(Boolean))) as string[],
    [rows]
  );
  const products = useMemo(
    () => Array.from(new Set(rows.map(r => r.product_name).filter(Boolean))) as string[],
    [rows]
  );

  const filtered = useMemo(
    () => rows.filter(r =>
      (vendedor === 'all' || r.vendedor_name === vendedor) &&
      (product === 'all' || r.product_name === product)
    ),
    [rows, vendedor, product]
  );

  // Aggregate by day of week (Mon=0..Sun=6)
  const dayData = useMemo(() => {
    const buckets = DAY_LABELS.map((label, idx) => ({
      dayIdx: idx,
      day: label,
      dayFull: DAY_LABELS_FULL[idx],
      cantidad: 0,
      monto: 0,
      products: new Map<string, { name: string; qty: number; total: number }>(),
    }));
    filtered.forEach(r => {
      const d = new Date(r.delivered_at || r.created_at);
      // JS: 0=Sun..6=Sat -> convert to Mon=0..Sun=6
      const idx = (d.getDay() + 6) % 7;
      const b = buckets[idx];
      b.cantidad += r.quantity;
      b.monto += r.total;
      const p = b.products.get(r.product_id) || { name: r.product_name, qty: 0, total: 0 };
      p.qty += r.quantity;
      p.total += r.total;
      b.products.set(r.product_id, p);
    });
    return buckets.map(b => ({
      ...b,
      topProducts: Array.from(b.products.values()).sort((a, b) => b.qty - a.qty).slice(0, 3),
    }));
  }, [filtered]);

  // Weekly product ranking
  const weeklyRanking = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    filtered.forEach(r => {
      const p = map.get(r.product_id) || { name: r.product_name, qty: 0, total: 0 };
      p.qty += r.quantity;
      p.total += r.total;
      map.set(r.product_id, p);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filtered]);

  const totalUnits = dayData.reduce((s, d) => s + d.cantidad, 0);
  const totalRevenue = dayData.reduce((s, d) => s + d.monto, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Ventas por Día de la Semana
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{totalUnits} unidades</Badge>
            <Badge variant="secondary">{formatCurrency(totalRevenue)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Rango</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as RangeMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana actual</SelectItem>
                <SelectItem value="lastweek">Semana pasada</SelectItem>
                <SelectItem value="month">Mes actual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === 'custom' && (
            <>
              <div>
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hasta</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Vendedor</Label>
            <Select value={vendedor} onValueChange={setVendedor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Producto</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {format(startDate, "d 'de' MMM", { locale: es })} — {format(endDate, "d 'de' MMM yyyy", { locale: es })}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `S/${v}`} />
                  <Tooltip
                    formatter={(value: any, name: string) =>
                      name === 'monto' ? formatCurrency(Number(value)) : `${value} u.`
                    }
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.dayFull || label}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="cantidad" name="Unidades" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="right" dataKey="monto" name="Monto (S/)" fill="hsl(var(--status-delivered))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top products per day */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Productos más vendidos por día
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {dayData.map(d => (
                  <div key={d.day} className="rounded-lg border p-3 bg-muted/30">
                    <p className="font-semibold text-sm mb-1">{d.dayFull}</p>
                    <p className="text-xs text-muted-foreground mb-2">{d.cantidad} u · {formatCurrency(d.monto)}</p>
                    {d.topProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin ventas</p>
                    ) : (
                      <ul className="space-y-1">
                        {d.topProducts.map(p => (
                          <li key={p.name} className="text-xs flex justify-between gap-2">
                            <span className="truncate">{p.name}</span>
                            <span className="font-medium text-primary shrink-0">{p.qty}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly ranking */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Ranking semanal de productos</h4>
              {weeklyRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin datos en el rango.</p>
              ) : (
                <div className="space-y-1">
                  {weeklyRanking.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/30">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-semibold">{p.qty} u</span>
                      <span className="text-muted-foreground w-24 text-right">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
