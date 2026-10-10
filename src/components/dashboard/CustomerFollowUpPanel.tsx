import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/contexts/SettingsContext';
import {
  CustomerFollowUpItem,
  useCustomerFollowUp,
} from '@/hooks/useCustomerFollowUp';
import { supabase } from '@/integrations/supabase/client';

type ViewTab = 'today' | 'urgent' | 'high' | 'managed';
type SortMode = 'priority' | 'potential' | 'overdue';

const HIGH_VALUE_THRESHOLD = 500;
const DAILY_TARGET = 18;

function normalizeWhatsAppPhone(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) digits = `51${digits}`;
  return digits;
}

function buildWhatsAppMessage(item: CustomerFollowUpItem): string {
  const productText = item.favoriteProducts[0]
    ? ` Veo que normalmente compras ${item.favoriteProducts[0]}.`
    : '';

  return `Hola ${item.customerName}, te escribimos de Agua Santa María. Ya estamos cerca de tu fecha habitual de reposición.${productText} ¿Deseas que preparemos tu próximo pedido?`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function daysSince(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, differenceInCalendarDays(today, date));
}

function actionWasToday(item: CustomerFollowUpItem) {
  if (!item.lastActionAt) return false;
  return format(new Date(item.lastActionAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
}

function isSnoozedNow(item: CustomerFollowUpItem) {
  if (item.lastActionType !== 'snoozed' || !item.snoozedUntil) return false;
  return item.snoozedUntil >= format(new Date(), 'yyyy-MM-dd');
}

function urgencyScore(item: CustomerFollowUpItem) {
  const overdueDays = Math.max(0, Math.abs(Math.min(0, item.daysToEstimatedPurchase)));
  const statusPoints = item.status === 'risk' ? 120 : item.status === 'overdue' ? 70 : 25;
  const potentialPoints = Math.min(80, item.averageOrderValue / 10);
  return statusPoints + overdueDays * 2 + potentialPoints;
}

function StatusChip({ item }: { item: CustomerFollowUpItem }) {
  if (actionWasToday(item)) {
    if (item.lastActionType === 'no_response') {
      return (
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
          Sin respuesta
        </Badge>
      );
    }

    if (item.lastActionType === 'snoozed') {
      return (
        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
          Pospuesto
        </Badge>
      );
    }

    if (item.lastActionType === 'managed') {
      return (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          <Check className="mr-1 h-3 w-3" />
          Gestionado
        </Badge>
      );
    }
  }

  if (item.status === 'risk') {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Urgente
      </Badge>
    );
  }

  if (item.averageOrderValue >= HIGH_VALUE_THRESHOLD) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        <Star className="mr-1 h-3 w-3" />
        Alto valor
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      <CalendarDays className="mr-1 h-3 w-3" />
      Hoy
    </Badge>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  onClick,
}: {
  icon: typeof Clock3;
  label: string;
  value: number;
  helper: string;
  tone: 'blue' | 'red' | 'amber' | 'green';
  onClick: () => void;
}) {
  const tones = {
    blue: {
      shell: 'border-blue-200 bg-gradient-to-br from-blue-50 to-white',
      icon: 'bg-blue-100 text-blue-700',
      text: 'text-blue-700',
    },
    red: {
      shell: 'border-red-200 bg-gradient-to-br from-red-50 to-white',
      icon: 'bg-red-100 text-red-700',
      text: 'text-red-700',
    },
    amber: {
      shell: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
      icon: 'bg-amber-100 text-amber-700',
      text: 'text-amber-700',
    },
    green: {
      shell: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
      icon: 'bg-emerald-100 text-emerald-700',
      text: 'text-emerald-700',
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${tones.shell}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tones.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${tones.text}`}>{label}</p>
          <p className="text-2xl font-black leading-tight text-foreground">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{helper}</p>
        </div>
        <ChevronRight className={`h-4 w-4 shrink-0 ${tones.text}`} />
      </div>
    </button>
  );
}

function OpportunityCard({
  item,
  onWhatsApp,
  onCall,
  onCreateOrder,
  onSnooze,
  onManaged,
  onNoResponse,
  busy,
}: {
  item: CustomerFollowUpItem;
  onWhatsApp: () => void;
  onCall: () => void;
  onCreateOrder: () => void;
  onSnooze: () => void;
  onManaged: () => void;
  onNoResponse: () => void;
  busy: boolean;
}) {
  const { formatCurrency } = useSettings();
  const phone = normalizeWhatsAppPhone(item.phone);
  const since = daysSince(item.lastPurchaseDate);
  const product = item.favoriteProducts[0] || 'Producto habitual';

  return (
    <div className="rounded-2xl border bg-background p-3.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md sm:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-sm font-black text-blue-700">
          {initials(item.customerName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-bold text-foreground">{item.customerName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{product}</p>
            </div>
            <StatusChip item={item} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-muted/45 p-2.5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-black">{since} días</p>
              <p className="text-[11px] leading-tight text-muted-foreground">desde última compra</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-muted/45 p-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-black">{formatCurrency(item.averageOrderValue)}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">potencial de venta</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-muted/45 p-2.5">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-black">cada {item.averageDaysBetweenPurchases} días</p>
              <p className="text-[11px] leading-tight text-muted-foreground">frecuencia habitual</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-muted/45 p-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{product}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">producto principal</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          disabled={!phone || busy}
          onClick={onWhatsApp}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
          <span className="sm:hidden">WA</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!phone || busy}
          onClick={onCall}
        >
          <Phone className="h-4 w-4" />
          Llamar
        </Button>

        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={busy}
          onClick={onCreateOrder}
        >
          <ShoppingCart className="h-4 w-4" />
          Pedido
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-xl border bg-muted/15">
        <button
          type="button"
          disabled={busy}
          onClick={onSnooze}
          className="flex items-center justify-center gap-1 border-r px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
        >
          <Clock3 className="h-3.5 w-3.5" />
          Posponer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onManaged}
          className="flex items-center justify-center gap-1 border-r px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Gestionado
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onNoResponse}
          className="flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Sin respuesta
        </button>
      </div>

      {item.lastActionAt && actionWasToday(item) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Última gestión: {format(new Date(item.lastActionAt), 'HH:mm', { locale: es })}
          {item.lastActionNote ? ` · ${item.lastActionNote}` : ''}
        </p>
      )}
    </div>
  );
}

export function CustomerFollowUpPanel() {
  const navigate = useNavigate();
  const { formatCurrency } = useSettings();
  const { items, loading, error, refetch } = useCustomerFollowUp();

  const [tab, setTab] = useState<ViewTab>('today');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [busyCustomerId, setBusyCustomerId] = useState<string | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<CustomerFollowUpItem | null>(null);
  const [snoozeDate, setSnoozeDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return format(tomorrow, 'yyyy-MM-dd');
  });

  const managedToday = useMemo(
    () =>
      items.filter(
        (item) =>
          actionWasToday(item) &&
          ['managed', 'no_response', 'snoozed'].includes(item.lastActionType || ''),
      ),
    [items],
  );

  const activeItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !actionWasToday(item) &&
          !isSnoozedNow(item),
      ),
    [items],
  );

  const prioritySorted = useMemo(
    () => [...activeItems].sort((a, b) => urgencyScore(b) - urgencyScore(a)),
    [activeItems],
  );

  const todayItems = useMemo(
    () => prioritySorted.slice(0, DAILY_TARGET),
    [prioritySorted],
  );

  const urgentItems = useMemo(
    () => activeItems.filter((item) => item.status === 'risk'),
    [activeItems],
  );

  const highPotentialItems = useMemo(
    () => activeItems.filter((item) => item.averageOrderValue >= HIGH_VALUE_THRESHOLD),
    [activeItems],
  );

  const dailyGoal = Math.max(
    1,
    Math.min(DAILY_TARGET, todayItems.length + managedToday.length),
  );
  const progress = Math.min(100, Math.round((managedToday.length / dailyGoal) * 100));

  const immediateAction = todayItems[0] || urgentItems[0] || highPotentialItems[0] || null;

  const sourceList = useMemo(() => {
    if (tab === 'urgent') return urgentItems;
    if (tab === 'high') return highPotentialItems;
    if (tab === 'managed') return managedToday;
    return todayItems;
  }, [tab, urgentItems, highPotentialItems, managedToday, todayItems]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    let list = sourceList.filter((item) => {
      if (!normalizedSearch) return true;
      const haystack = [
        item.customerName,
        ...item.favoriteProducts,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    if (sortMode === 'potential') {
      list = [...list].sort((a, b) => b.averageOrderValue - a.averageOrderValue);
    } else if (sortMode === 'overdue') {
      list = [...list].sort((a, b) => a.daysToEstimatedPurchase - b.daysToEstimatedPurchase);
    } else {
      list = [...list].sort((a, b) => urgencyScore(b) - urgencyScore(a));
    }

    return list;
  }, [sourceList, search, sortMode]);

  const recordAction = async (
    item: CustomerFollowUpItem,
    actionType: 'managed' | 'no_response' | 'snoozed',
    note?: string,
    snoozedUntil?: string | null,
  ) => {
    setBusyCustomerId(item.customerId);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        'record_customer_followup_action',
        {
          p_customer_id: item.customerId,
          p_action_type: actionType,
          p_note: note || null,
          p_snoozed_until: snoozedUntil || null,
        },
      );

      if (rpcError) throw rpcError;
      if (data?.success === false) throw new Error(data?.error || 'No se pudo registrar la gestión');

      if (actionType === 'managed') {
        toast.success('Cliente marcado como gestionado');
      } else if (actionType === 'no_response') {
        toast.success('Registrado como sin respuesta');
      } else {
        toast.success('Seguimiento pospuesto', {
          description: snoozedUntil
            ? `Volverá a tu lista después del ${format(new Date(`${snoozedUntil}T12:00:00`), 'dd MMM', { locale: es })}.`
            : undefined,
        });
      }

      await refetch();
    } catch (actionError) {
      console.error('Customer follow-up action error:', actionError);
      toast.error('No se pudo guardar la gestión');
    } finally {
      setBusyCustomerId(null);
    }
  };

  const handleWhatsApp = (item: CustomerFollowUpItem) => {
    const phone = normalizeWhatsAppPhone(item.phone);
    if (!phone) {
      toast.error('Este cliente no tiene teléfono registrado');
      return;
    }
    const message = encodeURIComponent(buildWhatsAppMessage(item));
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const handleCall = (item: CustomerFollowUpItem) => {
    const phone = normalizeWhatsAppPhone(item.phone);
    if (!phone) {
      toast.error('Este cliente no tiene teléfono registrado');
      return;
    }
    window.location.href = `tel:+${phone}`;
  };

  const handleCreateOrder = (item: CustomerFollowUpItem) => {
    sessionStorage.setItem(
      'followup_customer_hint',
      JSON.stringify({
        id: item.customerId,
        name: item.customerName,
      }),
    );
    navigate('/orders');
  };

  const openSnooze = (item: CustomerFollowUpItem) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSnoozeDate(format(tomorrow, 'yyyy-MM-dd'));
    setSnoozeItem(item);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Preparando oportunidades de venta...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-white via-blue-50/40 to-white pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                Oportunidades de Venta
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Clientes que conviene contactar hoy para recuperar ventas y generar nuevos pedidos.
              </p>
            </div>

            <Badge variant="secondary" className="self-start gap-1 px-3 py-1.5">
              <Users className="h-3.5 w-3.5" />
              {activeItems.length} por atender
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricCard
              icon={Clock3}
              label="Por contactar hoy"
              value={todayItems.length}
              helper="Clientes recomendados"
              tone="blue"
              onClick={() => setTab('today')}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Urgentes"
              value={urgentItems.length}
              helper="Mayor retraso de recompra"
              tone="red"
              onClick={() => setTab('urgent')}
            />
            <MetricCard
              icon={Star}
              label="Alto potencial"
              value={highPotentialItems.length}
              helper={`Potencial ≥ ${formatCurrency(HIGH_VALUE_THRESHOLD)}`}
              tone="amber"
              onClick={() => setTab('high')}
            />
            <MetricCard
              icon={CheckCircle2}
              label="Gestionados hoy"
              value={managedToday.length}
              helper={`De ${dailyGoal} recomendados (${progress}%)`}
              tone="green"
              onClick={() => setTab('managed')}
            />
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-semibold text-foreground">No hay oportunidades pendientes</p>
              <p className="mt-1 text-sm">Los clientes con historial suficiente aparecerán aquí cuando corresponda contactarlos.</p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <Tabs value={tab} onValueChange={(value) => setTab(value as ViewTab)}>
                  <div className="rounded-2xl border bg-muted/15 p-2">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-transparent p-0 lg:w-auto lg:grid-cols-4">
                        <TabsTrigger value="today" className="gap-1.5 rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                          <CalendarDays className="h-4 w-4" />
                          Hoy ({todayItems.length})
                        </TabsTrigger>
                        <TabsTrigger value="urgent" className="gap-1.5 rounded-xl">
                          <AlertTriangle className="h-4 w-4" />
                          Urgentes ({urgentItems.length})
                        </TabsTrigger>
                        <TabsTrigger value="high" className="gap-1.5 rounded-xl">
                          <Star className="h-4 w-4" />
                          Alto potencial ({highPotentialItems.length})
                        </TabsTrigger>
                        <TabsTrigger value="managed" className="gap-1.5 rounded-xl">
                          <CheckCircle2 className="h-4 w-4" />
                          Gestionados ({managedToday.length})
                        </TabsTrigger>
                      </TabsList>

                      <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-2 lg:w-[440px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar cliente o producto..."
                            className="pl-9"
                          />
                        </div>

                        <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                          <SelectTrigger className="gap-1">
                            <Filter className="h-4 w-4" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="priority">Prioridad</SelectItem>
                            <SelectItem value="potential">Mayor potencial</SelectItem>
                            <SelectItem value="overdue">Más atrasados</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {(['today', 'urgent', 'high', 'managed'] as ViewTab[]).map((tabKey) => (
                    <TabsContent key={tabKey} value={tabKey} className="mt-3">
                      {visibleItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
                          <Target className="mx-auto mb-2 h-8 w-8 opacity-50" />
                          No hay clientes en esta vista con los filtros actuales.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {visibleItems.map((item) => (
                            <OpportunityCard
                              key={item.customerId}
                              item={item}
                              busy={busyCustomerId === item.customerId}
                              onWhatsApp={() => handleWhatsApp(item)}
                              onCall={() => handleCall(item)}
                              onCreateOrder={() => handleCreateOrder(item)}
                              onSnooze={() => openSnooze(item)}
                              onManaged={() => recordAction(item, 'managed', 'Seguimiento comercial completado')}
                              onNoResponse={() =>
                                recordAction(
                                  item,
                                  'no_response',
                                  'Cliente no respondió al contacto',
                                  format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                                )
                              }
                            />
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <aside className="space-y-3">
                <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 p-4 text-white shadow-md">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    <h3 className="font-bold">Acción inmediata</h3>
                  </div>
                  <p className="mt-1 text-xs text-blue-100">
                    Siguiente mejor acción para aumentar tus ventas hoy.
                  </p>

                  {immediateAction ? (
                    <div className="mt-4 rounded-2xl bg-white p-3 text-foreground shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 font-black text-violet-700">
                          {initials(immediateAction.customerName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-bold">{immediateAction.customerName}</p>
                            <StatusChip item={immediateAction} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {daysSince(immediateAction.lastPurchaseDate)} días sin comprar
                          </p>
                          <p className="mt-1 text-xs font-semibold text-emerald-700">
                            Potencial: {formatCurrency(immediateAction.averageOrderValue)}
                          </p>
                        </div>
                      </div>

                      <Button
                        className="mt-3 w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                        disabled={!normalizeWhatsAppPhone(immediateAction.phone)}
                        onClick={() => handleWhatsApp(immediateAction)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Contactar por WhatsApp
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-white/10 p-4 text-sm text-blue-50">
                      No hay una acción urgente pendiente.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Resumen de hoy</h3>
                    <Badge variant="secondary">{dailyGoal} clientes</Badge>
                  </div>

                  <div className="mt-3 space-y-3 text-sm">
                    <button type="button" className="flex w-full items-center justify-between" onClick={() => setTab('urgent')}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        Urgentes
                      </span>
                      <span className="font-bold">{urgentItems.length}</span>
                    </button>
                    <button type="button" className="flex w-full items-center justify-between" onClick={() => setTab('high')}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Alto potencial
                      </span>
                      <span className="font-bold">{highPotentialItems.length}</span>
                    </button>
                    <button type="button" className="flex w-full items-center justify-between" onClick={() => setTab('today')}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        Por contactar
                      </span>
                      <span className="font-bold">{todayItems.length}</span>
                    </button>
                    <button type="button" className="flex w-full items-center justify-between" onClick={() => setTab('managed')}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Gestionados
                      </span>
                      <span className="font-bold">{managedToday.length}</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" />
                    <h3 className="font-bold">Tu progreso hoy</h3>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-8 border-emerald-100 bg-white text-lg font-black text-emerald-700">
                      {progress}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {managedToday.length} de {dailyGoal} clientes
                      </p>
                      <p className="text-xs text-muted-foreground">ya gestionados</p>
                      <Progress value={progress} className="mt-2 h-2" />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-800">Sugerencia del día</p>
                      <p className="mt-1 text-sm text-blue-700">
                        {urgentItems.length > 0
                          ? `Contacta primero a los ${Math.min(urgentItems.length, 6)} clientes urgentes con mayor potencial. Son los que más rápido pueden convertirse en pedido.`
                          : 'Empieza por los clientes de mayor potencial y registra cada gestión para mantener tu lista limpia.'}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!snoozeItem} onOpenChange={(open) => !open && setSnoozeItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Posponer seguimiento</DialogTitle>
            <DialogDescription>
              {snoozeItem
                ? `¿Cuándo quieres volver a contactar a ${snoozeItem.customerName}?`
                : 'Selecciona una fecha.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Volver a mostrar desde</label>
            <Input
              type="date"
              value={snoozeDate}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={(event) => setSnoozeDate(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeItem(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!snoozeItem || !snoozeDate || busyCustomerId === snoozeItem?.customerId}
              onClick={async () => {
                if (!snoozeItem) return;
                await recordAction(
                  snoozeItem,
                  'snoozed',
                  `Seguimiento pospuesto hasta ${snoozeDate}`,
                  snoozeDate,
                );
                setSnoozeItem(null);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
