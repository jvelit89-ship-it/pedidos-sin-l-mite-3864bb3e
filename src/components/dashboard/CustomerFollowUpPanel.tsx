import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/contexts/SettingsContext';
import {
  CustomerFollowUpItem,
  CustomerFollowUpStatus,
  useCustomerFollowUp,
} from '@/hooks/useCustomerFollowUp';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Loader2,
  MessageCircle,
  TrendingUp,
  Users,
} from 'lucide-react';

const STATUS_CONFIG: Record<
  CustomerFollowUpStatus,
  { label: string; icon: typeof CalendarClock; className: string; description: string }
> = {
  upcoming: {
    label: 'Próximos',
    icon: CalendarClock,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Dentro de su ventana habitual de recompra',
  },
  overdue: {
    label: 'Atrasados',
    icon: Clock3,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Ya superaron su fecha estimada',
  },
  risk: {
    label: 'En riesgo',
    icon: AlertTriangle,
    className: 'bg-red-50 text-red-700 border-red-200',
    description: 'Llevan bastante más tiempo de lo habitual sin comprar',
  },
};

function normalizeWhatsAppPhone(phone: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Números móviles peruanos guardados localmente suelen tener 9 dígitos.
  if (digits.length === 9) digits = `51${digits}`;
  return digits;
}

function buildWhatsAppMessage(item: CustomerFollowUpItem): string {
  const statusText: Record<CustomerFollowUpStatus, string> = {
    upcoming: 'se está acercando tu fecha habitual de pedido',
    overdue: 'ya estamos dentro de tu fecha habitual de reposición',
    risk: 'ha pasado más tiempo de lo habitual desde tu último pedido',
  };

  const productsText = item.favoriteProducts.length > 0
    ? ` Tus productos frecuentes son: ${item.favoriteProducts.join(', ')}.`
    : '';

  return `Hola ${item.customerName}, te escribimos de Santa María. Según tu historial de compras, ${statusText[item.status]}.${productsText} ¿Deseas que preparemos tu próximo pedido?`;
}

function openWhatsApp(item: CustomerFollowUpItem) {
  const phone = normalizeWhatsAppPhone(item.phone);
  if (!phone) return;

  const message = encodeURIComponent(buildWhatsAppMessage(item));
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
}

function CustomerRow({ item }: { item: CustomerFollowUpItem }) {
  const { formatCurrency } = useSettings();
  const status = STATUS_CONFIG[item.status];
  const phone = normalizeWhatsAppPhone(item.phone);
  const dateText = format(
    new Date(`${item.nextEstimatedPurchaseDate}T12:00:00`),
    'dd MMM yyyy',
    { locale: es }
  );

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{item.customerName}</p>
          <p className="text-xs text-muted-foreground">
            Próximo estimado: {dateText}
          </p>
        </div>
        <Badge variant="outline" className={status.className}>
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-muted-foreground">Potencial</p>
          <p className="font-semibold text-foreground">
            {formatCurrency(item.averageOrderValue)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <p className="text-muted-foreground">Frecuencia</p>
          <p className="font-semibold text-foreground">
            cada {item.averageDaysBetweenPurchases} días
          </p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <span>Promedio {item.averageUnitsPerPurchase.toFixed(1)} uds/compra</span>
        {item.favoriteProducts.length > 0 && (
          <span> · {item.favoriteProducts.slice(0, 2).join(', ')}</span>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full gap-2"
        disabled={!phone}
        onClick={() => openWhatsApp(item)}
        title={phone ? 'Contactar por WhatsApp' : 'Cliente sin teléfono registrado'}
      >
        <MessageCircle className="w-4 h-4" />
        {phone ? 'Recordar pedido por WhatsApp' : 'Sin teléfono para WhatsApp'}
      </Button>
    </div>
  );
}

export function CustomerFollowUpPanel() {
  const { items, loading, error } = useCustomerFollowUp();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Calculando seguimiento de clientes...
        </CardContent>
      </Card>
    );
  }

  const grouped: Record<CustomerFollowUpStatus, CustomerFollowUpItem[]> = {
    upcoming: items.filter((item) => item.status === 'upcoming'),
    overdue: items.filter((item) => item.status === 'overdue'),
    risk: items.filter((item) => item.status === 'risk'),
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Seguimiento de Clientes
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Predicción automática usando el promedio real de días entre compras. Dentro de cada estado, los clientes aparecen por mayor potencial de venta.
            </p>
          </div>
          <Badge variant="secondary" className="gap-1 self-start">
            <Users className="w-3.5 h-3.5" />
            {items.length} por atender
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive py-4">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No hay clientes próximos, atrasados o en riesgo en este momento.</p>
            <p className="text-xs mt-1">La estimación se activa cuando el cliente tiene al menos dos días de compra.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {(Object.keys(STATUS_CONFIG) as CustomerFollowUpStatus[]).map((statusKey) => {
              const config = STATUS_CONFIG[statusKey];
              const Icon = config.icon;
              const list = grouped[statusKey];

              return (
                <div key={statusKey} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 font-semibold">
                        <Icon className="w-4 h-4" />
                        {config.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {config.description}
                      </p>
                    </div>
                    <Badge variant="outline">{list.length}</Badge>
                  </div>

                  {list.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">
                      Sin clientes en este estado
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                      {list.map((item) => (
                        <CustomerRow key={item.customerId} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
