import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useOrders } from './useOrders';
import { useRepartidores } from './useTeam';
import { getLimaDateKey } from '@/lib/limaTime';

const WORK_START_HOUR = 7; // 7am
const WORK_END_HOUR = 19; // 7pm
const ALERT_THRESHOLD_MINUTES = 120; // 2 hours

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

interface HealthIndicators {
  deliveredTodayPercent: number;
  avgDeliveryTimeMinutes: number;
  cancelledToday: number;
  cancelledYesterday: number;
  cancelledDiff: number;
}

interface OperationalInsight {
  type: 'fast_driver' | 'frequent_canceller' | 'problematic_product' | 'best_time_driver';
  icon: string;
  message: string;
  severity: 'positive' | 'warning' | 'info';
}

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

export function useDashboardStats() {
  const { orders } = useOrders();
  const { repartidores } = useRepartidores();
  const [newOrderSound, setNewOrderSound] = useState<HTMLAudioElement | null>(null);
  const previousOrderCountRef = useRef<number>(0);
  const initialLoadRef = useRef(true);

  // Initialize sound
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const createBeep = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };

    // Store the function to play later
    setNewOrderSound({ play: createBeep } as any);
  }, []);

  // Play sound on new order
  useEffect(() => {
    if (initialLoadRef.current) {
      previousOrderCountRef.current = orders.length;
      initialLoadRef.current = false;
      return;
    }

    if (orders.length > previousOrderCountRef.current) {
      // New order detected
      if (newOrderSound) {
        try {
          (newOrderSound as any).play?.();
        } catch (e) {
          console.log('Sound autoplay blocked');
        }
      }
    }
    previousOrderCountRef.current = orders.length;
  }, [orders.length, newOrderSound]);

  // Get effective start time for delivery calculation
  const getEffectiveStartTime = useCallback((createdAt: string): Date => {
    const orderDate = new Date(createdAt);
    const workStartToday = new Date(orderDate);
    workStartToday.setHours(WORK_START_HOUR, 0, 0, 0);
    
    // If order was created before work hours, use work start time
    if (orderDate < workStartToday) {
      return workStartToday;
    }
    return orderDate;
  }, []);

  // Calculate delivery time in minutes
  const getDeliveryTimeMinutes = useCallback((order: { created_at: string; delivered_at: string | null }): number | null => {
    if (!order.delivered_at) return null;
    
    const startTime = getEffectiveStartTime(order.created_at);
    const deliveredTime = new Date(order.delivered_at);
    
    return Math.round((deliveredTime.getTime() - startTime.getTime()) / (1000 * 60));
  }, [getEffectiveStartTime]);

  // Smart Alerts
  const smartAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = [];
    const now = new Date();

    // Check for pending orders over threshold
    orders.forEach(order => {
      if (order.status === 'pending' || order.status === 'preparation') {
        const startTime = getEffectiveStartTime(order.created_at);
        const minutesPending = (now.getTime() - startTime.getTime()) / (1000 * 60);
        
        if (minutesPending >= ALERT_THRESHOLD_MINUTES) {
          const severity = minutesPending >= ALERT_THRESHOLD_MINUTES * 1.5 ? 'critical' : 'warning';
          alerts.push({
            id: `pending-${order.id}`,
            type: 'pending_overtime',
            severity,
            title: `Pedido pendiente +${Math.round(minutesPending)} min`,
            description: `${order.customer_name} - ${order.status === 'pending' ? 'Sin iniciar' : 'En preparación'}`,
            orderId: order.id,
            createdAt: new Date(order.created_at),
          });
        }
      }

      // Check for delayed deliveries (in delivery status for too long)
      if (order.status === 'delivery') {
        const statusChangedAt = new Date(order.updated_at);
        const minutesInDelivery = (now.getTime() - statusChangedAt.getTime()) / (1000 * 60);
        
        if (minutesInDelivery >= 60) { // 1 hour in delivery is concerning
          alerts.push({
            id: `delayed-${order.id}`,
            type: 'delayed_delivery',
            severity: minutesInDelivery >= 90 ? 'critical' : 'warning',
            title: `Entrega retrasada +${Math.round(minutesInDelivery)} min`,
            description: `${order.customer_name} - ${order.repartidor_name || 'Sin repartidor'}`,
            orderId: order.id,
            repartidorId: order.repartidor_id || undefined,
            createdAt: statusChangedAt,
          });
        }
      }
    });

    // Check for inactive drivers with assigned orders
    const activeDeliveryOrders = orders.filter(o => o.status === 'delivery' || o.status === 'ready');
    const driversWithOrders = new Set(activeDeliveryOrders.map(o => o.repartidor_id).filter(Boolean));
    
    repartidores.filter(r => r.active).forEach(driver => {
      const driverOrders = activeDeliveryOrders.filter(o => o.repartidor_id === driver.id);
      if (driverOrders.length > 0) {
        const lastUpdate = Math.max(...driverOrders.map(o => new Date(o.updated_at).getTime()));
        const minutesSinceUpdate = (now.getTime() - lastUpdate) / (1000 * 60);
        
        if (minutesSinceUpdate >= 45) { // No activity for 45+ minutes
          alerts.push({
            id: `inactive-${driver.id}`,
            type: 'inactive_driver',
            severity: minutesSinceUpdate >= 60 ? 'critical' : 'warning',
            title: `Repartidor inactivo ${Math.round(minutesSinceUpdate)} min`,
            description: `${driver.name} - ${driverOrders.length} pedidos asignados`,
            repartidorId: driver.id,
            createdAt: new Date(lastUpdate),
          });
        }
      }
    });

    // Sort by severity (critical first) then by time
    return alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [orders, repartidores, getEffectiveStartTime]);

  // Health Indicators
  const healthIndicators = useMemo<HealthIndicators>(() => {
    const today = getLimaDateKey(new Date());
    const yesterday = getLimaDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const todayOrders = orders.filter(o => (o as any).delivery_date === today || (!((o as any).delivery_date) && getLimaDateKey(o.created_at) === today));
    const yesterdayOrders = orders.filter(o => (o as any).delivery_date === yesterday || (!((o as any).delivery_date) && getLimaDateKey(o.created_at) === yesterday));

    const deliveredToday = todayOrders.filter(o => o.status === 'delivered').length;
    const totalToday = todayOrders.length;
    const deliveredTodayPercent = totalToday > 0 ? Math.round((deliveredToday / totalToday) * 100) : 0;

    // Calculate average delivery time
    const deliveryTimes = orders
      .filter(o => o.status === 'delivered' && o.delivered_at)
      .map(o => getDeliveryTimeMinutes(o))
      .filter((t): t is number => t !== null && t > 0 && t < 480); // Filter outliers (max 8 hours)

    const avgDeliveryTimeMinutes = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : 0;

    const cancelledToday = todayOrders.filter(o => o.status === 'cancelled').length;
    const cancelledYesterday = yesterdayOrders.filter(o => o.status === 'cancelled').length;
    const cancelledDiff = cancelledToday - cancelledYesterday;

    return {
      deliveredTodayPercent,
      avgDeliveryTimeMinutes,
      cancelledToday,
      cancelledYesterday,
      cancelledDiff,
    };
  }, [orders, getDeliveryTimeMinutes]);

  // Operational Insights
  const operationalInsights = useMemo<OperationalInsight[]>(() => {
    const insights: OperationalInsight[] = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Recent orders for analysis
    const recentOrders = orders.filter(o => new Date(o.created_at) >= thirtyDaysAgo);

    // Driver performance analysis
    const driverStats = new Map<string, { name: string; deliveries: number; totalTime: number }>();
    recentOrders.filter(o => o.status === 'delivered' && o.repartidor_id && o.delivered_at).forEach(order => {
      const time = getDeliveryTimeMinutes(order);
      if (time && time > 0 && time < 480) {
        const existing = driverStats.get(order.repartidor_id!) || { 
          name: order.repartidor_name || 'Desconocido', 
          deliveries: 0, 
          totalTime: 0 
        };
        existing.deliveries++;
        existing.totalTime += time;
        driverStats.set(order.repartidor_id!, existing);
      }
    });

    // Find fastest driver
    let fastestDriver: { name: string; avgTime: number } | null = null;
    let slowestAvg = 0;
    driverStats.forEach((stats) => {
      if (stats.deliveries >= 5) {
        const avgTime = stats.totalTime / stats.deliveries;
        if (!fastestDriver || avgTime < fastestDriver.avgTime) {
          if (fastestDriver) slowestAvg = Math.max(slowestAvg, fastestDriver.avgTime);
          fastestDriver = { name: stats.name, avgTime };
        } else {
          slowestAvg = Math.max(slowestAvg, avgTime);
        }
      }
    });

    if (fastestDriver && slowestAvg > 0) {
      const percentFaster = Math.round(((slowestAvg - fastestDriver.avgTime) / slowestAvg) * 100);
      if (percentFaster >= 15) {
        insights.push({
          type: 'fast_driver',
          icon: '🚀',
          message: `${fastestDriver.name} entrega ${percentFaster}% más rápido`,
          severity: 'positive',
        });
      }
    }

    // Customer cancellation analysis
    const customerCancellations = new Map<string, { name: string; cancellations: number; total: number }>();
    recentOrders.forEach(order => {
      const existing = customerCancellations.get(order.customer_id) || { 
        name: order.customer_name, 
        cancellations: 0, 
        total: 0 
      };
      existing.total++;
      if (order.status === 'cancelled') existing.cancellations++;
      customerCancellations.set(order.customer_id, existing);
    });

    customerCancellations.forEach((stats) => {
      if (stats.total >= 3 && stats.cancellations / stats.total >= 0.3) {
        insights.push({
          type: 'frequent_canceller',
          icon: '⚠️',
          message: `${stats.name} cancela seguido (${stats.cancellations}/${stats.total})`,
          severity: 'warning',
        });
      }
    });

    // Product delay analysis (products in orders that took longer)
    const productDelays = new Map<string, { name: string; totalTime: number; count: number }>();
    recentOrders.filter(o => o.status === 'delivered' && o.delivered_at).forEach(order => {
      const time = getDeliveryTimeMinutes(order);
      if (time && time > 0) {
        order.order_items?.forEach(item => {
          const existing = productDelays.get(item.product_id) || { 
            name: item.product_name, 
            totalTime: 0, 
            count: 0 
          };
          existing.totalTime += time;
          existing.count++;
          productDelays.set(item.product_id, existing);
        });
      }
    });

    // Find problematic products (higher than average delivery time)
    const avgAllDeliveries = healthIndicators.avgDeliveryTimeMinutes;
    if (avgAllDeliveries > 0) {
      productDelays.forEach((stats) => {
        if (stats.count >= 5) {
          const avgProductTime = stats.totalTime / stats.count;
          if (avgProductTime > avgAllDeliveries * 1.3) {
            insights.push({
              type: 'problematic_product',
              icon: '📦',
              message: `${stats.name} causa más retrasos`,
              severity: 'warning',
            });
          }
        }
      });
    }

    // Best time for drivers analysis
    const hourlyDriverPerformance = new Map<number, Map<string, { name: string; deliveries: number; totalTime: number }>>();
    recentOrders.filter(o => o.status === 'delivered' && o.repartidor_id && o.delivered_at).forEach(order => {
      const hour = new Date(order.created_at).getHours();
      if (hour >= WORK_START_HOUR && hour < WORK_END_HOUR) {
        const time = getDeliveryTimeMinutes(order);
        if (time && time > 0 && time < 480) {
          if (!hourlyDriverPerformance.has(hour)) {
            hourlyDriverPerformance.set(hour, new Map());
          }
          const hourMap = hourlyDriverPerformance.get(hour)!;
          const existing = hourMap.get(order.repartidor_id!) || { 
            name: order.repartidor_name || 'Desconocido', 
            deliveries: 0, 
            totalTime: 0 
          };
          existing.deliveries++;
          existing.totalTime += time;
          hourMap.set(order.repartidor_id!, existing);
        }
      }
    });

    // Find best driver for current hour
    const currentHour = now.getHours();
    if (currentHour >= WORK_START_HOUR && currentHour < WORK_END_HOUR) {
      const hourPerformance = hourlyDriverPerformance.get(currentHour);
      if (hourPerformance) {
        let bestDriver: { name: string; avgTime: number } | null = null;
        hourPerformance.forEach((stats) => {
          if (stats.deliveries >= 3) {
            const avgTime = stats.totalTime / stats.deliveries;
            if (!bestDriver || avgTime < bestDriver.avgTime) {
              bestDriver = { name: stats.name, avgTime };
            }
          }
        });
        if (bestDriver) {
          insights.push({
            type: 'best_time_driver',
            icon: '⏰',
            message: `A esta hora conviene más ${bestDriver.name}`,
            severity: 'info',
          });
        }
      }
    }

    return insights.slice(0, 4); // Limit to 4 insights
  }, [orders, healthIndicators.avgDeliveryTimeMinutes, getDeliveryTimeMinutes]);

  // Repartidor Load Summary
  const getRepartidorLoad = useCallback((repartidorId: string): RepartidorLoad | null => {
    const driverOrders = orders.filter(
      o => o.repartidor_id === repartidorId && 
           (o.status === 'ready' || o.status === 'delivery')
    );

    if (driverOrders.length === 0) return null;

    const itemsMap = new Map<string, RepartidorLoadItem>();
    driverOrders.forEach(order => {
      order.order_items?.forEach(item => {
        const existing = itemsMap.get(item.product_id) || {
          productId: item.product_id,
          productName: item.product_name,
          totalQuantity: 0,
        };
        existing.totalQuantity += item.quantity;
        itemsMap.set(item.product_id, existing);
      });
    });

    const driver = repartidores.find(r => r.id === repartidorId);
    return {
      repartidorId,
      repartidorName: driver?.name || 'Desconocido',
      totalOrders: driverOrders.length,
      items: Array.from(itemsMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity),
    };
  }, [orders, repartidores]);

  // All Repartidores Load Summary
  const allRepartidoresLoad = useMemo<RepartidorLoad[]>(() => {
    const loads: RepartidorLoad[] = [];
    repartidores.filter(r => r.active).forEach(driver => {
      const load = getRepartidorLoad(driver.id);
      if (load) {
        loads.push(load);
      }
    });
    return loads.sort((a, b) => b.totalOrders - a.totalOrders);
  }, [repartidores, getRepartidorLoad]);

  // Count new orders (for badge)
  const newOrdersCount = useMemo(() => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return orders.filter(o => 
      o.status === 'pending' && 
      new Date(o.created_at) >= fiveMinutesAgo
    ).length;
  }, [orders]);

  return {
    smartAlerts,
    healthIndicators,
    operationalInsights,
    getRepartidorLoad,
    allRepartidoresLoad,
    newOrdersCount,
    ALERT_THRESHOLD_MINUTES,
  };
}
