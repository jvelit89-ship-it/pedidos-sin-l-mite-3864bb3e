import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, ClipboardList } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface RepartidorLoadItem {
  productId: string;
  productName: string;
  totalQuantity: number;
}

interface RepartidorLoad {
  repartidorId: string;
  repartidorName: string;
  totalOrders: number;
  items: RepartidorLoadItem[];
}

interface RepartidorLoadSummaryProps {
  load: RepartidorLoad;
  isCompact?: boolean;
}

export function RepartidorLoadSummary({ load, isCompact = false }: RepartidorLoadSummaryProps) {
  const totalItems = load.items.reduce((sum, item) => sum + item.totalQuantity, 0);

  if (isCompact) {
    return (
      <Card className="border-[hsl(var(--status-preparation))]/30 bg-[hsl(var(--status-preparation-bg))]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-[hsl(var(--status-preparation))]" />
              <span className="font-semibold">{load.repartidorName}</span>
            </div>
            <Badge variant="secondary">
              {load.totalOrders} pedidos
            </Badge>
          </div>
          <div className="text-3xl font-bold text-center text-[hsl(var(--status-preparation))]">
            {totalItems} productos
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            para cargar hoy
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Resumen de Carga
          </CardTitle>
          <Badge variant="outline" className="gap-1">
            <Package className="w-3 h-3" />
            {load.totalOrders} pedidos
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-[hsl(var(--status-preparation-bg))] rounded-lg p-4 mb-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-[hsl(var(--status-preparation))]">
              {totalItems}
            </div>
            <p className="text-sm text-muted-foreground">productos totales para cargar</p>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {load.items.map((item, index) => (
            <motion.div
              key={item.productId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
            >
              <span className="text-sm truncate flex-1">{item.productName}</span>
              <Badge 
                variant="secondary" 
                className="ml-2 min-w-[3rem] justify-center font-mono"
              >
                x{item.totalQuantity}
              </Badge>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface AllRepartidoresLoadProps {
  loads: RepartidorLoad[];
}

export function AllRepartidoresLoad({ loads }: AllRepartidoresLoadProps) {
  if (loads.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Carga de Repartidores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin pedidos pendientes asignados para entrega
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Carga de Repartidores
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Mismo resumen que ve cada repartidor en Entregas · Listo para envío + En camino
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {loads.map((load, index) => {
          const totalItems = load.items.reduce((sum, item) => sum + item.totalQuantity, 0);

          return (
            <motion.div
              key={load.repartidorId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-xl border bg-background overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{load.repartidorName}</p>
                    <p className="text-xs text-muted-foreground">
                      Carga pendiente de entrega
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {load.totalOrders} pedido{load.totalOrders === 1 ? '' : 's'} pendiente{load.totalOrders === 1 ? '' : 's'}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    {totalItems} unidades por cargar
                  </Badge>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-2">
                  {load.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {item.productName}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 min-w-[3.25rem] justify-center font-mono"
                      >
                        x{item.totalQuantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
