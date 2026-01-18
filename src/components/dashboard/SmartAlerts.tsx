import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Truck, UserX, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SmartAlert {
  id: string;
  type: 'pending_overtime' | 'inactive_driver' | 'delayed_delivery';
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  orderId?: string;
  repartidorId?: string;
  createdAt: Date;
}

interface SmartAlertsProps {
  alerts: SmartAlert[];
  thresholdMinutes: number;
}

const alertIcons = {
  pending_overtime: Clock,
  inactive_driver: UserX,
  delayed_delivery: Truck,
};

export function SmartAlerts({ alerts, thresholdMinutes }: SmartAlertsProps) {
  const navigate = useNavigate();

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            Alertas Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            ✅ Sin alertas activas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Alertas Inteligentes
          </CardTitle>
          <Badge variant="destructive" className="animate-pulse">
            {alerts.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Umbral: {thresholdMinutes} min para pedidos pendientes
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        <AnimatePresence>
          {alerts.slice(0, 5).map((alert, index) => {
            const Icon = alertIcons[alert.type];
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  flex items-center gap-3 p-3 rounded-lg cursor-pointer
                  transition-colors
                  ${alert.severity === 'critical' 
                    ? 'bg-destructive/10 hover:bg-destructive/20 border border-destructive/30' 
                    : 'bg-[hsl(var(--status-pending-bg))] hover:bg-[hsl(var(--status-pending-bg))]/80'
                  }
                `}
                onClick={() => {
                  if (alert.orderId) {
                    navigate(`/orders/${alert.orderId}`);
                  } else if (alert.repartidorId) {
                    navigate('/repartidores');
                  }
                }}
              >
                <div className={`
                  p-2 rounded-full
                  ${alert.severity === 'critical' 
                    ? 'bg-destructive/20 text-destructive' 
                    : 'bg-[hsl(var(--status-pending))]/20 text-[hsl(var(--status-pending))]'
                  }
                `}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${alert.severity === 'critical' ? 'text-destructive' : ''}`}>
                    {alert.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {alert.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {alerts.length > 5 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-muted-foreground"
            onClick={() => navigate('/orders')}
          >
            Ver {alerts.length - 5} alertas más
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
