import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Minus
} from 'lucide-react';

interface HealthIndicatorsProps {
  deliveredTodayPercent: number;
  avgDeliveryTimeMinutes: number;
  cancelledToday: number;
  cancelledYesterday: number;
  cancelledDiff: number;
}

export function HealthIndicators({
  deliveredTodayPercent,
  avgDeliveryTimeMinutes,
  cancelledToday,
  cancelledDiff,
}: HealthIndicatorsProps) {
  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getDeliveryColor = () => {
    if (deliveredTodayPercent >= 80) return 'text-[hsl(var(--status-delivered))]';
    if (deliveredTodayPercent >= 50) return 'text-[hsl(var(--status-pending))]';
    return 'text-destructive';
  };

  const getTimeColor = () => {
    if (avgDeliveryTimeMinutes <= 60) return 'text-[hsl(var(--status-delivered))]';
    if (avgDeliveryTimeMinutes <= 120) return 'text-[hsl(var(--status-pending))]';
    return 'text-destructive';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          📈 Indicadores de Salud
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Delivered Today % */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className={`text-2xl font-bold ${getDeliveryColor()}`}>
              {deliveredTodayPercent}%
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Entregados hoy</span>
            </div>
          </motion.div>

          {/* Avg Delivery Time */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <div className={`text-2xl font-bold ${getTimeColor()}`}>
              {avgDeliveryTimeMinutes > 0 ? formatTime(avgDeliveryTimeMinutes) : '--'}
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="w-3 h-3" />
              <span>Tiempo promedio</span>
            </div>
          </motion.div>

          {/* Cancelled vs Yesterday */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold">{cancelledToday}</span>
              {cancelledDiff !== 0 && (
                <span className={`text-sm flex items-center ${
                  cancelledDiff > 0 ? 'text-destructive' : 'text-[hsl(var(--status-delivered))]'
                }`}>
                  {cancelledDiff > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(cancelledDiff)}
                </span>
              )}
              {cancelledDiff === 0 && (
                <span className="text-sm text-muted-foreground flex items-center">
                  <Minus className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
              <XCircle className="w-3 h-3" />
              <span>Cancelados vs ayer</span>
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
