import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { Archive, RefreshCw, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ArchivedOrderItem {
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
}

interface ArchivedOrderData {
  id?: string;
  tracking_code?: string | null;
  customer_name?: string;
  total?: number;
  status?: string;
  created_at?: string;
  delivered_at?: string | null;
  vendedor_name?: string | null;
  repartidor_name?: string | null;
  delivery_address?: string | null;
  order_items?: ArchivedOrderItem[];
}

interface DeletedOrderLog {
  id: string;
  entity_id: string;
  old_data: ArchivedOrderData | null;
  user_name: string | null;
  created_at: string;
}

const getOriginalMonth = (order: ArchivedOrderData | null) => {
  const value = order?.created_at;
  return value ? format(new Date(value), 'yyyy-MM') : 'unknown';
};

export function DeletedOrdersArchivePanel() {
  const { user } = useAuth();
  const { formatCurrency } = useSettings();
  const [logs, setLogs] = useState<DeletedOrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);

  const fetchDeletedOrders = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('audit_logs')
      .select('id, entity_id, old_data, user_name, created_at')
      .eq('entity_type', 'orders')
      .eq('action', 'DELETE')
      .order('created_at', { ascending: false });

    if (user?.companyId) {
      query = query.eq('company_id', user.companyId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setLogs(
        data.map((row) => ({
          id: row.id,
          entity_id: row.entity_id,
          old_data: (row.old_data ?? null) as unknown as ArchivedOrderData | null,
          user_name: row.user_name,
          created_at: row.created_at,
        }))
      );
    }

    setLoading(false);
  }, [user?.companyId]);

  useEffect(() => {
    fetchDeletedOrders();
  }, [fetchDeletedOrders]);

  const months = useMemo(() => {
    const monthSet = new Set(
      logs
        .map((log) => getOriginalMonth(log.old_data))
        .filter((month) => month !== 'unknown')
    );

    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const order = log.old_data;
      if (monthFilter !== 'all' && getOriginalMonth(order) !== monthFilter) return false;

      if (!search) return true;

      return [
        order?.customer_name,
        order?.tracking_code,
        order?.vendedor_name,
        order?.repartidor_name,
        log.entity_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }, [logs, monthFilter, searchTerm]);

  const visibleLogs = expanded ? filteredLogs : filteredLogs.slice(0, 8);

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4" />
              Archivo de pedidos eliminados
              <Badge variant="secondary">{logs.length}</Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Historial de auditoría de solo lectura. No afecta ventas, stock ni comisiones.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDeletedOrders} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, tracking o responsable..."
              className="pl-9"
            />
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  <span className="capitalize">
                    {format(new Date(`${month}-01T12:00:00-05:00`), 'MMMM yyyy', { locale: es })}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Cargando archivo...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No hay pedidos eliminados para este filtro.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleLogs.map((log) => {
                const order = log.old_data;
                const items = Array.isArray(order?.order_items) ? order?.order_items : null;

                return (
                  <div key={log.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="font-medium">{order?.customer_name || 'Cliente no disponible'}</span>
                          {order?.tracking_code && (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {order.tracking_code}
                            </Badge>
                          )}
                          {order?.status && <Badge variant="secondary">{order.status}</Badge>}
                        </div>

                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <span>
                            Pedido: {order?.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm') : 'Sin fecha'}
                          </span>
                          <span>
                            Eliminado: {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                          </span>
                          <span>Por: {log.user_name || 'Sistema / usuario no identificado'}</span>
                          <span>Vendedor: {order?.vendedor_name || 'Sin asignar'}</span>
                        </div>

                        {items ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Productos:{' '}
                            {items.length > 0
                              ? items.map((item) => `${item.product_name || 'Producto'} x${item.quantity ?? 0}`).join(', ')
                              : 'Sin productos registrados'}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                            El archivo antiguo conserva la cabecera, pero no el detalle de productos.
                          </div>
                        )}
                      </div>

                      <div className="text-left md:text-right">
                        <p className="font-semibold">{formatCurrency(Number(order?.total || 0))}</p>
                        <p className="text-[11px] text-muted-foreground">Solo referencia histórica</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredLogs.length > 8 && (
              <Button variant="ghost" className="w-full" onClick={() => setExpanded((value) => !value)}>
                {expanded ? 'Mostrar menos' : `Ver todos (${filteredLogs.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
