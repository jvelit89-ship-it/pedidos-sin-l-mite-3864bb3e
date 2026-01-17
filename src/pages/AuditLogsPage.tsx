import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRealtimeQuery } from '@/hooks/useSupabaseData';
import { useSettings } from '@/contexts/SettingsContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Search, FileText, Loader2, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  company_id: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { es: string; en: string; color: string }> = {
  INSERT: { es: 'Creación', en: 'Create', color: 'bg-green-100 text-green-800' },
  UPDATE: { es: 'Actualización', en: 'Update', color: 'bg-blue-100 text-blue-800' },
  DELETE: { es: 'Eliminación', en: 'Delete', color: 'bg-red-100 text-red-800' },
};

const ENTITY_LABELS: Record<string, { es: string; en: string }> = {
  orders: { es: 'Pedido', en: 'Order' },
  products: { es: 'Producto', en: 'Product' },
  customers: { es: 'Cliente', en: 'Customer' },
  vendedores: { es: 'Vendedor', en: 'Vendor' },
  repartidores: { es: 'Repartidor', en: 'Driver' },
};

export default function AuditLogsPage() {
  const { settings, t } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logs, loading } = useRealtimeQuery<AuditLog>('audit_logs', {
    orderBy: { column: 'created_at', ascending: false },
  });

  const locale = settings.language === 'es' ? es : enUS;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    return matchesSearch && matchesEntity && matchesAction;
  });

  const getActionLabel = (action: string) => {
    const config = ACTION_LABELS[action];
    if (!config) return { label: action, color: 'bg-gray-100 text-gray-800' };
    return { 
      label: settings.language === 'es' ? config.es : config.en, 
      color: config.color 
    };
  };

  const getEntityLabel = (entity: string) => {
    const config = ENTITY_LABELS[entity];
    if (!config) return entity;
    return settings.language === 'es' ? config.es : config.en;
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {settings.language === 'es' ? 'Registros de Auditoría' : 'Audit Logs'}
        </h1>
        <p className="text-muted-foreground">
          {settings.language === 'es' 
            ? 'Historial de cambios del sistema' 
            : 'System change history'}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={settings.language === 'es' ? 'Buscar...' : 'Search...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {settings.language === 'es' ? 'Todas las entidades' : 'All entities'}
                </SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, labels]) => (
                  <SelectItem key={key} value={key}>
                    {settings.language === 'es' ? labels.es : labels.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {settings.language === 'es' ? 'Todas las acciones' : 'All actions'}
                </SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, labels]) => (
                  <SelectItem key={key} value={key}>
                    {settings.language === 'es' ? labels.es : labels.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">
              {settings.language === 'es' ? 'No hay registros' : 'No logs'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const actionInfo = getActionLabel(log.action);
            return (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Badge className={actionInfo.color}>
                        {actionInfo.label}
                      </Badge>
                      <span className="font-medium">{getEntityLabel(log.entity_type)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), 'PPpp', { locale })}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span>
                      {settings.language === 'es' ? 'Por: ' : 'By: '}
                      <span className="font-medium text-foreground">
                        {log.user_name || (settings.language === 'es' ? 'Sistema' : 'System')}
                      </span>
                    </span>
                    <span className="mx-2">•</span>
                    <span className="font-mono text-xs">{log.entity_id.slice(0, 8)}</span>
                  </div>
                  {log.action === 'UPDATE' && log.old_data && log.new_data && (
                    <details className="mt-3">
                      <summary className="text-sm text-primary cursor-pointer">
                        {settings.language === 'es' ? 'Ver cambios' : 'View changes'}
                      </summary>
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono overflow-x-auto">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold mb-1 text-red-600">
                              {settings.language === 'es' ? 'Antes' : 'Before'}
                            </p>
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="font-semibold mb-1 text-green-600">
                              {settings.language === 'es' ? 'Después' : 'After'}
                            </p>
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
