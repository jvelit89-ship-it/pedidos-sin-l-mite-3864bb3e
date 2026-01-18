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
            Sin pedidos asignados para entrega
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="w-4 h-4" />
          Carga de Repartidores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loads.map((load, index) => {
          const totalItems = load.items.reduce((sum, item) => sum + item.totalQuantity, 0);
          return (
            <motion.div
              key={load.repartidorId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{load.repartidorName}</span>
                <Badge variant="outline">{load.totalOrders} pedidos</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-lg font-bold text-[hsl(var(--status-preparation))]">
                  {totalItems}
                </span>
                <span className="text-sm text-muted-foreground">productos</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {load.items.slice(0, 3).map(item => (
                  <Badge key={item.productId} variant="secondary" className="text-xs">
                    {item.productName.split(' ')[0]} x{item.totalQuantity}
                  </Badge>
                ))}
                {load.items.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{load.items.length - 3} más
                  </Badge>
                )}
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
