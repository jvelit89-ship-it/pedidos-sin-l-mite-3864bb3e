import { useEffect, useMemo, useRef, useState } from 'react';
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
import { BarChart3, TrendingUp, Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { getBusinessDateKey } from '@/lib/limaTime';
import { toast } from 'sonner';

type RangeMode = 'week' | 'lastweek' | 'month' | 'custom';

interface Row {
  order_id: string;
  customer_name: string;
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

function downloadBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

async function chartElementToPng(container: HTMLDivElement | null): Promise<string | null> {
  const svg = container?.querySelector('svg');
  if (!svg) return null;

  const cloned = svg.cloneNode(true) as SVGElement;
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const rect = svg.getBoundingClientRect();
  const width = Math.max(900, Math.round(rect.width || 900));
  const height = Math.max(340, Math.round(rect.height || 340));
  cloned.setAttribute('width', String(width));
  cloned.setAttribute('height', String(height));

  const source = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('No se pudo convertir el gráfico'));
      image.src = url;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function styleHeader(row: any) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
}

export function WeeklySalesChart() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const chartRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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
        const from = new Date(startDate);
        from.setHours(0, 0, 0, 0);
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);

        const { data, error } = await supabase
          .from('orders')
          .select('id, customer_name, delivered_at, created_at, vendedor_name, status, company_id, order_items(product_id, product_name, quantity, unit_price, total)')
          .eq('company_id', user.companyId)
          .eq('status', 'delivered')
          .gte('delivered_at', from.toISOString())
          .lte('delivered_at', to.toISOString());

        if (error) throw error;

        const flat: Row[] = [];
        (data || []).forEach((o: any) => {
          (o.order_items || []).forEach((it: any) => {
            flat.push({
              order_id: o.id,
              customer_name: o.customer_name || '',
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
        toast.error('No se pudieron cargar las ventas por día');
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

  // Visible chart: distribution by weekday, matching the dashboard view.
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

  // Exact delivery dates for Excel and operational review.
  const deliveryDays = useMemo(() => {
    const map = new Map<string, {
      dateKey: string;
      date: Date;
      units: number;
      amount: number;
      orders: Set<string>;
    }>();

    filtered.forEach(r => {
      const source = r.delivered_at || r.created_at;
      const dateKey = getBusinessDateKey(source);
      const date = new Date(source);
      const current = map.get(dateKey) || {
        dateKey,
        date,
        units: 0,
        amount: 0,
        orders: new Set<string>(),
      };
      current.units += r.quantity;
      current.amount += r.total;
      current.orders.add(r.order_id);
      map.set(dateKey, current);
    });

    return Array.from(map.values())
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map(item => ({
        ...item,
        orderCount: item.orders.size,
        dayName: format(item.date, 'EEEE', { locale: es }),
      }));
  }, [filtered]);

  const weeklyRanking = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    filtered.forEach(r => {
      const p = map.get(r.product_id) || { name: r.product_name, qty: 0, total: 0 };
      p.qty += r.quantity;
      p.total += r.total;
      map.set(r.product_id, p);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 50);
  }, [filtered]);

  const totalUnits = dayData.reduce((s, d) => s + d.cantidad, 0);
  const totalRevenue = dayData.reduce((s, d) => s + d.monto, 0);

  const exportExcel = async () => {
    if (filtered.length === 0) {
      toast.info('No hay ventas para exportar con los filtros actuales');
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sistema de Pedidos INNSANMA';
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.subject = 'Ventas por días de entrega, unidades y montos';
      workbook.title = 'Reporte de ventas';

      const summary = workbook.addWorksheet('Resumen', {
        views: [{ state: 'frozen', ySplit: 7 }],
      });

      summary.columns = [
        { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 },
        { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
      ];

      summary.mergeCells('A1:H1');
      summary.getCell('A1').value = 'VENTAS POR DÍAS DE ENTREGA';
      summary.getCell('A1').font = { size: 20, bold: true, color: { argb: 'FF0F172A' } };
      summary.getCell('A1').alignment = { horizontal: 'center' };
      summary.getRow(1).height = 30;

      summary.mergeCells('A2:H2');
      summary.getCell('A2').value = `Rango: ${format(startDate, 'dd/MM/yyyy')} al ${format(endDate, 'dd/MM/yyyy')}`;
      summary.getCell('A2').alignment = { horizontal: 'center' };
      summary.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };

      summary.getCell('A4').value = 'Filtro vendedor';
      summary.getCell('B4').value = vendedor === 'all' ? 'Todos' : vendedor;
      summary.getCell('D4').value = 'Filtro producto';
      summary.getCell('E4').value = product === 'all' ? 'Todos' : product;

      summary.getCell('A5').value = 'Total unidades';
      summary.getCell('B5').value = totalUnits;
      summary.getCell('D5').value = 'Monto total (S/)';
      summary.getCell('E5').value = totalRevenue;
      summary.getCell('E5').numFmt = '"S/"#,##0.00';
      summary.getCell('G5').value = 'Pedidos entregados';
      summary.getCell('H5').value = new Set(filtered.map(r => r.order_id)).size;

      ['A4','D4','A5','D5','G5'].forEach(cell => {
        summary.getCell(cell).font = { bold: true, color: { argb: 'FF1E3A8A' } };
      });

      const dailyHeaderRow = 7;
      const header = summary.getRow(dailyHeaderRow);
      header.values = ['Fecha entrega', 'Día', 'Pedidos', 'Unidades', 'Monto (S/)'];
      styleHeader(header);
      header.height = 22;

      deliveryDays.forEach((d, index) => {
        const row = summary.getRow(dailyHeaderRow + 1 + index);
        row.values = [
          d.dateKey,
          d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1),
          d.orderCount,
          d.units,
          d.amount,
        ];
        row.getCell(5).numFmt = '"S/"#,##0.00';
      });

      const tableEnd = dailyHeaderRow + deliveryDays.length;
      summary.addTable({
        name: 'ResumenDiasEntrega',
        ref: `A${dailyHeaderRow}`,
        headerRow: true,
        totalsRow: true,
        style: { theme: 'TableStyleMedium2', showRowStripes: true },
        columns: [
          { name: 'Fecha entrega', totalsRowLabel: 'TOTAL' },
          { name: 'Día' },
          { name: 'Pedidos', totalsRowFunction: 'sum' },
          { name: 'Unidades', totalsRowFunction: 'sum' },
          { name: 'Monto (S/)', totalsRowFunction: 'sum' },
        ],
        rows: deliveryDays.map(d => [
          d.dateKey,
          d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1),
          d.orderCount,
          d.units,
          d.amount,
        ]),
      });
      summary.getCell(`E${tableEnd + 1}`).numFmt = '"S/"#,##0.00';

      const chartPng = await chartElementToPng(chartRef.current);
      if (chartPng) {
        const imageId = workbook.addImage({
          base64: chartPng,
          extension: 'png',
        });
        const chartStartRow = tableEnd + 4;
        summary.mergeCells(`A${chartStartRow}:H${chartStartRow}`);
        summary.getCell(`A${chartStartRow}`).value = 'Gráfico del reporte';
        summary.getCell(`A${chartStartRow}`).font = { bold: true, size: 14 };
        summary.addImage(imageId, {
          tl: { col: 0, row: chartStartRow },
          ext: { width: 1040, height: 390 },
        });
      }

      const detail = workbook.addWorksheet('Detalle');
      detail.columns = [
        { header: 'Fecha entrega', key: 'date', width: 16 },
        { header: 'Hora entrega', key: 'time', width: 14 },
        { header: 'Día', key: 'day', width: 14 },
        { header: 'Pedido ID', key: 'order', width: 38 },
        { header: 'Cliente', key: 'customer', width: 32 },
        { header: 'Vendedor', key: 'seller', width: 26 },
        { header: 'Producto', key: 'product', width: 38 },
        { header: 'Unidades', key: 'units', width: 12 },
        { header: 'P. Unitario', key: 'unitPrice', width: 15 },
        { header: 'Monto', key: 'amount', width: 15 },
      ];
      styleHeader(detail.getRow(1));
      detail.views = [{ state: 'frozen', ySplit: 1 }];
      detail.autoFilter = 'A1:J1';

      [...filtered]
        .sort((a, b) => String(a.delivered_at || a.created_at).localeCompare(String(b.delivered_at || b.created_at)))
        .forEach(r => {
          const source = r.delivered_at || r.created_at;
          const date = new Date(source);
          const row = detail.addRow({
            date: format(date, 'dd/MM/yyyy'),
            time: format(date, 'HH:mm'),
            day: format(date, 'EEEE', { locale: es }),
            order: r.order_id,
            customer: r.customer_name,
            seller: r.vendedor_name || 'Sin asignar',
            product: r.product_name,
            units: r.quantity,
            unitPrice: r.unit_price,
            amount: r.total,
          });
          row.getCell('I').numFmt = '"S/"#,##0.00';
          row.getCell('J').numFmt = '"S/"#,##0.00';
        });

      const ranking = workbook.addWorksheet('Ranking productos');
      ranking.columns = [
        { header: '#', key: 'rank', width: 8 },
        { header: 'Producto', key: 'product', width: 42 },
        { header: 'Unidades', key: 'units', width: 14 },
        { header: 'Monto', key: 'amount', width: 18 },
      ];
      styleHeader(ranking.getRow(1));
      weeklyRanking.forEach((p, index) => {
        const row = ranking.addRow({
          rank: index + 1,
          product: p.name,
          units: p.qty,
          amount: p.total,
        });
        row.getCell('D').numFmt = '"S/"#,##0.00';
      });

      [summary, detail, ranking].forEach(sheet => {
        sheet.eachRow(row => {
          row.alignment = { ...row.alignment, vertical: 'middle' };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const rangeName = `${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`;
      const fileName = `Ventas_por_dias_de_entrega_${rangeName}.xlsx`;
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        fileName,
      );
      toast.success('Excel generado correctamente', {
        description: 'Incluye resumen por día, detalle, ranking y el gráfico.',
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('No se pudo generar el Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Ventas por Día de la Semana
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{totalUnits} unidades</Badge>
            <Badge variant="secondary">{formatCurrency(totalRevenue)}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={exportExcel}
              disabled={loading || exporting || filtered.length === 0}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              <span>{exporting ? 'Generando...' : 'Excel (.xlsx)'}</span>
              {!exporting && <Download className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <p className="text-xs text-muted-foreground">
            {format(startDate, "d 'de' MMM", { locale: es })} — {format(endDate, "d 'de' MMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground">
            Excel compatible con Microsoft Excel 2026 · usa la fecha real de entrega
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div ref={chartRef} className="w-full h-72 bg-white">
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
                  <Bar yAxisId="left" dataKey="cantidad" name="Unidades" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="right" dataKey="monto" name="Monto (S/)" fill="#22C55E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

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

            <div>
              <h4 className="text-sm font-semibold mb-2">Ranking de productos en el rango</h4>
              {weeklyRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Sin datos en el rango.</p>
              ) : (
                <div className="space-y-1">
                  {weeklyRanking.slice(0, 10).map((p, i) => (
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
