import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProducts } from '@/hooks/useProducts';
import { AlertTriangle, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export function LowStockAlert() {
  const { products, loading } = useProducts();

  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= (p.stock_critical_level || 5) && p.product_type === 'final');
  }, [products]);

  if (loading || lowStockProducts.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50/30 dark:bg-red-900/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4" />
          Alertas de Stock Crítico
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {lowStockProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-black/20 border border-red-100 dark:border-red-900/30"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{product.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={product.stock === 0 ? "destructive" : "outline"} className={product.stock > 0 ? "text-red-600 border-red-200" : ""}>
                  {product.stock} {product.stock === 1 ? 'unidad' : 'unidades'}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
