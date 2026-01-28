import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Download, 
  Upload, 
  Clock, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  History,
  RotateCcw,
  FileJson,
  Table2,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BackupInfo {
  tableName: string;
  recordCount: number;
  lastUpdated: string | null;
}

export function BackupRecoveryPanel() {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [backupInfo, setBackupInfo] = useState<BackupInfo[]>([]);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<Date | null>(null);

  const fetchBackupInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const info: BackupInfo[] = [];

      // Fetch counts for each table
      const [ordersRes, customersRes, productsRes, productionRes, stockRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('production_history').select('*', { count: 'exact', head: true }),
        supabase.from('stock_movements').select('*', { count: 'exact', head: true }),
      ]);

      const tables = [
        { label: 'Pedidos', count: ordersRes.count },
        { label: 'Clientes', count: customersRes.count },
        { label: 'Productos', count: productsRes.count },
        { label: 'Historial Producción', count: productionRes.count },
        { label: 'Movimientos Stock', count: stockRes.count },
      ];

      for (const table of tables) {
        info.push({
          tableName: table.label,
          recordCount: table.count || 0,
          lastUpdated: new Date().toISOString(),
        });
      }

      setBackupInfo(info);
      setLastBackupDate(new Date());
    } catch (error) {
      console.error('Error fetching backup info:', error);
      toast.error('Error al obtener información de respaldo');
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(15);
      const [ordersRes, customersRes, productsRes, productionRes, stockRes, itemsRes] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('products').select('*'),
        supabase.from('production_history').select('*'),
        supabase.from('stock_movements').select('*'),
        supabase.from('order_items').select('*'),
      ]);

      setExportProgress(80);

      const exportDataObj: Record<string, unknown[]> = {
        orders: ordersRes.data || [],
        customers: customersRes.data || [],
        products: productsRes.data || [],
        production_history: productionRes.data || [],
        stock_movements: stockRes.data || [],
        order_items: itemsRes.data || [],
      };

      setExportProgress(90);

      const timestamp = new Date().toISOString().split('T')[0];
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportDataObj, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `backup_${timestamp}.json`);
      } else {
        // Export each table as separate CSV
        for (const [tableName, records] of Object.entries(exportDataObj)) {
          if (records.length > 0) {
            const csv = convertToCSV(records as Record<string, unknown>[]);
            const blob = new Blob([csv], { type: 'text/csv' });
            downloadBlob(blob, `${tableName}_${timestamp}.csv`);
          }
        }
      }

      toast.success(`Respaldo exportado exitosamente en formato ${format.toUpperCase()}`);
      setLastBackupDate(new Date());
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Error al exportar datos');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const convertToCSV = (data: Record<string, unknown>[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return String(value);
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const recalculateStock = async () => {
    try {
      const { data, error } = await supabase.rpc('recalculate_my_company_stock');
      
      if (error) throw error;
      
      toast.success(`Stock recalculado: ${data} productos actualizados`);
    } catch (error) {
      console.error('Recalculate error:', error);
      toast.error('Error al recalcular stock');
    }
  };

  return (
    <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/30 to-orange-50/20 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Respaldo y Recuperación</CardTitle>
              <CardDescription>Gestiona copias de seguridad y restauración de datos</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Protegido
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
            <Database className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Base de Datos</p>
              <p className="font-semibold text-sm">En línea</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
            <Clock className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Último Respaldo</p>
              <p className="font-semibold text-sm">
                {lastBackupDate ? lastBackupDate.toLocaleString() : 'No disponible'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border">
            <HardDrive className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Respaldos Auto.</p>
              <p className="font-semibold text-sm">Activo (Diario)</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Export Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium">Exportar Datos</h4>
          </div>
          
          {isExporting && (
            <div className="space-y-2">
              <Progress value={exportProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Exportando... {exportProgress}%
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => exportData('json')}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileJson className="w-5 h-5 text-orange-500" />
              )}
              <span className="text-xs">Exportar JSON</span>
              <span className="text-[10px] text-muted-foreground">Archivo único completo</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex-col gap-2"
              onClick={() => exportData('csv')}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Table2 className="w-5 h-5 text-green-500" />
              )}
              <span className="text-xs">Exportar CSV</span>
              <span className="text-[10px] text-muted-foreground">Archivos por tabla</span>
            </Button>
          </div>
        </div>

        <Separator />

        {/* Database Info Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium">Estado de Tablas</h4>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchBackupInfo}
              disabled={isLoadingInfo}
            >
              {isLoadingInfo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span className="ml-1 text-xs">Actualizar</span>
            </Button>
          </div>
          
          {backupInfo.length > 0 ? (
            <div className="space-y-2">
              {backupInfo.map((info, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-2 rounded-md bg-background/40 border text-sm"
                >
                  <span className="font-medium">{info.tableName}</span>
                  <Badge variant="secondary">{info.recordCount.toLocaleString()} registros</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Haz clic en "Actualizar" para ver el estado de las tablas
            </p>
          )}
        </div>

        <Separator />

        {/* Recovery Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-medium">Herramientas de Recuperación</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="justify-start gap-3 h-auto py-3">
                  <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
                    <Database className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">Recalcular Inventario</p>
                    <p className="text-xs text-muted-foreground">
                      Sincroniza el stock basado en el historial completo
                    </p>
                  </div>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Recalcular Inventario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción recalculará todo el inventario basándose en:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Historial de producción</li>
                      <li>Pedidos entregados</li>
                      <li>Registros de merma</li>
                      <li>Consumo de materiales (recetas)</li>
                    </ul>
                    <p className="mt-3 font-medium">
                      Esto puede tomar unos segundos.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={recalculateStock}>
                    Recalcular
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="p-4 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-amber-800 dark:text-amber-200">
                    Restauración desde Respaldo
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Para restaurar datos desde un respaldo anterior, contacta al soporte técnico. 
                    Los respaldos automáticos se mantienen por 7 días.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            💡 Los respaldos automáticos se realizan diariamente. Para mayor seguridad, 
            exporta tus datos periódicamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
