import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';

interface OperationalInsight {
  type: 'fast_driver' | 'frequent_canceller' | 'problematic_product' | 'best_time_driver';
  icon: string;
  message: string;
  severity: 'positive' | 'warning' | 'info';
}

interface OperationalInsightsProps {
  insights: OperationalInsight[];
}

export function OperationalInsights({ insights }: OperationalInsightsProps) {
  if (insights.length === 0) {
    return null;
  }

  const getSeverityStyles = (severity: OperationalInsight['severity']) => {
    switch (severity) {
      case 'positive':
        return 'bg-[hsl(var(--status-delivered-bg))] border-[hsl(var(--status-delivered))]/30';
      case 'warning':
        return 'bg-[hsl(var(--status-pending-bg))] border-[hsl(var(--status-pending))]/30';
      case 'info':
        return 'bg-[hsl(var(--status-preparation-bg))] border-[hsl(var(--status-preparation))]/30';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[hsl(var(--status-pending))]" />
          Inteligencia Operativa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, index) => (
          <motion.div
            key={`${insight.type}-${index}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              flex items-center gap-3 p-3 rounded-lg border
              ${getSeverityStyles(insight.severity)}
            `}
          >
            <span className="text-xl">{insight.icon}</span>
            <p className="text-sm">{insight.message}</p>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
