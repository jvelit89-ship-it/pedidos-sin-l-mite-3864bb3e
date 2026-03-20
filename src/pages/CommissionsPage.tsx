import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useVendedores, useOperarios, useRepartidores } from '@/hooks/useTeam';
import { useProductCommissions, useVendorCommissions, useMyCommissions, useOperarioCommissions, useMyOperarioCommissions, useRepartidorCommissions, useMyRepartidorCommissions } from '@/hooks/useCommissions';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
 import { DollarSign, TrendingUp, Calendar, Users, Package, ChevronLeft, ChevronRight, Eye, CalendarDays, Wrench, Trash2, Loader2, FileDown, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
 import { supabase } from '@/integrations/supabase/client';
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
 import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

interface CommissionSummary {
  id: string;
  name: string;
  period1_units: number;
  period1_commission: number;
  period2_units: number;
  period2_commission: number;
  total_units: number;
  total_commission: number;
  details: any[];
}

export default function CommissionsPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const { vendedores } = useVendedores();
  const { operarios } = useOperarios();
  const { repartidores } = useRepartidores();
  const { products, setProductCommission, loading: productsLoading } = useProductCommissions();
  const { formatDateLocal } = useSettings();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [vendedorCommissions, setVendedorCommissions] = useState<CommissionSummary[]>([]);
  const [operarioCommissions, setOperarioCommissions] = useState<CommissionSummary[]>([]);
  const [repartidorCommissions, setRepartidorCommissions] = useState<CommissionSummary[]>([]);
  const [myCommission, setMyCommission] = useState<any>(null);
  const [dailyCommissions, setDailyCommissions] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'vendedor' | 'operario' | 'repartidor'>('vendedor');
  const [newAmount, setNewAmount] = useState('');
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<CommissionSummary | null>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [adminTab, setAdminTab] = useState<'vendedores' | 'operarios' | 'repartidores'>('vendedores');
 
   // Delete commission states
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    personId: string;
    personName: string;
    recordId: string;
    productName: string;
    quantity: number;
    commission: number;
  } | null>(null);
   const [deleteType, setDeleteType] = useState<'vendedor' | 'operario' | 'repartidor'>('vendedor');
   const [otpValue, setOtpValue] = useState('');
   const [sendingOtp, setSendingOtp] = useState(false);
   const [verifyingOtp, setVerifyingOtp] = useState(false);

  const { calculateCommissions: calcVendedorCommissions, loading: calcVendedorLoading } = useVendorCommissions(selectedYear, selectedMonth);
  const { calculateCommissions: calcOperarioCommissions, loading: calcOperarioLoading } = useOperarioCommissions(selectedYear, selectedMonth);
  const { calculateCommissions: calcRepartidorCommissions, loading: calcRepartidorLoading } = useRepartidorCommissions(selectedYear, selectedMonth);
  const { calculateMyCommissions, getDailyCommissions } = useMyCommissions(user?.vendedorId || null, selectedYear, selectedMonth);
  const { calculateMyCommissions: calcMyOperarioCommissions } = useMyOperarioCommissions(user?.operarioId || null, selectedYear, selectedMonth);
  const { calculateMyCommissions: calcMyRepartidorCommissions } = useMyRepartidorCommissions(user?.repartidorId || null, selectedYear, selectedMonth);

  const isAdminOrSuper = isAdmin || isSuperAdmin;
  const isOperario = user?.role === 'operario';
  const isVendedor = user?.role === 'vendedor';
  const isRepartidor = user?.role === 'repartidor';

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  useEffect(() => {
    loadCommissions();
  }, [selectedMonth, selectedYear]);

  const loadCommissions = async () => {
    setLoadingCommissions(true);
    try {
      if (isAdminOrSuper) {
        const vendedorData = await calcVendedorCommissions();
        setVendedorCommissions(vendedorData.map(v => ({
          id: v.vendedor_id,
          name: v.vendedor_name,
          ...v,
        })));
        
        const operarioData = await calcOperarioCommissions();
        setOperarioCommissions(operarioData.map(o => ({
          id: o.operario_id,
          name: o.operario_name,
          ...o,
        })));

        const repartidorData = await calcRepartidorCommissions();
        setRepartidorCommissions(repartidorData.map(r => ({
          id: r.repartidor_id,
          name: r.repartidor_name,
          ...r,
        })));
      } else if (isVendedor && user?.vendedorId) {
        const data = await calculateMyCommissions();
        setMyCommission(data);
        const daily = await getDailyCommissions();
        setDailyCommissions(daily);
      } else if (isOperario && user?.operarioId) {
        const data = await calcMyOperarioCommissions();
        setMyCommission(data);
      } else if (isRepartidor && user?.repartidorId) {
        const data = await calcMyRepartidorCommissions();
        setMyCommission(data);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoadingCommissions(false);
    }
  };

  const handleSaveProductCommission = async (productId: string) => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('El monto debe ser mayor o igual a 0');
      return;
    }
    await setProductCommission(productId, amount, editingType);
    setEditingProduct(null);
    setNewAmount('');
    loadCommissions();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

  const exportCommissionsPDF = (type: 'vendedores' | 'operarios' | 'repartidores') => {
    const data = type === 'vendedores' ? vendedorCommissions : type === 'repartidores' ? repartidorCommissions : operarioCommissions;
    if (data.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const totalCommission = data.reduce((sum, c) => sum + c.total_commission, 0);
    const totalUnits = data.reduce((sum, c) => sum + c.total_units, 0);
    const title = type === 'vendedores' ? 'Comisiones de Vendedores' : type === 'repartidores' ? 'Comisiones de Repartidores' : 'Comisiones de Operarios';
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:20px}
      .header{text-align:center;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #333}
      .header h1{font-size:18px;margin-bottom:5px}
      .header p{font-size:12px;color:#666}
      .summary{display:flex;justify-content:space-around;margin-bottom:20px;padding:10px;background:#f5f5f5;border-radius:5px}
      .summary-item{text-align:center}
      .summary-item .value{font-size:16px;font-weight:bold;color:#333}
      .summary-item .label{font-size:10px;color:#666}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:10px}
      th{background:#333!important;color:#fff!important;font-weight:bold}
      tr:nth-child(even){background:#f9f9f9}
      .text-right{text-align:right}
      .total-row{background:#e8f5e9!important;font-weight:bold}
      .footer{margin-top:20px;text-align:center;font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:10px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}th{background:#333!important;color:#fff!important}}
    </style></head><body>
      <div class="header">
        <h1>📋 ${title}</h1>
        <p>${monthNames[selectedMonth - 1]} ${selectedYear}</p>
        <p>Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>
      <div class="summary">
        <div class="summary-item"><div class="value">${data.length}</div><div class="label">${type === 'vendedores' ? 'Vendedores' : 'Operarios'}</div></div>
        <div class="summary-item"><div class="value">${totalUnits}</div><div class="label">Total Unidades</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalCommission)}</div><div class="label">Total Comisiones</div></div>
      </div>
      <table>
        <thead><tr>
          <th>${type === 'vendedores' ? 'Vendedor' : 'Operario'}</th>
          <th class="text-right">P1 (1-15) Uds</th>
          <th class="text-right">P1 Comisión</th>
          <th class="text-right">P2 (16-${lastDay}) Uds</th>
          <th class="text-right">P2 Comisión</th>
          <th class="text-right">Total Uds</th>
          <th class="text-right">Total Comisión</th>
        </tr></thead>
        <tbody>
          ${data.map(c => `<tr>
            <td>${c.name}</td>
            <td class="text-right">${c.period1_units}</td>
            <td class="text-right">${formatCurrency(c.period1_commission)}</td>
            <td class="text-right">${c.period2_units}</td>
            <td class="text-right">${formatCurrency(c.period2_commission)}</td>
            <td class="text-right">${c.total_units}</td>
            <td class="text-right" style="font-weight:bold">${formatCurrency(c.total_commission)}</td>
          </tr>`).join('')}
          <tr class="total-row">
            <td>TOTAL</td>
            <td class="text-right">${data.reduce((s, c) => s + c.period1_units, 0)}</td>
            <td class="text-right">${formatCurrency(data.reduce((s, c) => s + c.period1_commission, 0))}</td>
            <td class="text-right">${data.reduce((s, c) => s + c.period2_units, 0)}</td>
            <td class="text-right">${formatCurrency(data.reduce((s, c) => s + c.period2_commission, 0))}</td>
            <td class="text-right">${totalUnits}</td>
            <td class="text-right">${formatCurrency(totalCommission)}</td>
          </tr>
        </tbody>
      </table>
      ${data.map(c => c.details.length > 0 ? `
        <h3 style="margin-top:20px;margin-bottom:5px;font-size:13px">${c.name} - Detalle</h3>
        <table>
          <thead><tr>
            <th>Fecha</th>
            <th>${type === 'vendedores' ? 'Cliente' : 'Producción'}</th>
            <th>Producto</th>
            <th class="text-right">Cant.</th>
            <th class="text-right">Com/U</th>
            <th class="text-right">Total</th>
          </tr></thead>
          <tbody>
            ${c.details.map((d: any) => `<tr>
              <td>${format(new Date(d.order_date || d.produced_at), 'dd/MM/yyyy', { locale: es })}</td>
              <td>${d.customer_name || 'Producción'}</td>
              <td>${d.product_name}</td>
              <td class="text-right">${d.quantity}</td>
              <td class="text-right">${formatCurrency(d.commission_per_unit)}</td>
              <td class="text-right" style="font-weight:bold">${formatCurrency(d.total_commission)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      ` : '').join('')}
      <div class="footer"><p>Sistema de Pedidos y Entregas - ${format(new Date(), 'yyyy')}</p></div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  const exportPersonDetailPDF = (mode: 'commissions' | 'sales') => {
    if (!selectedPerson || selectedPerson.details.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const details = selectedPerson.details;
    const totalComm = details.reduce((s: number, d: any) => s + d.total_commission, 0);
    const totalUnits = details.reduce((s: number, d: any) => s + d.quantity, 0);
    const totalSales = details.reduce((s: number, d: any) => s + (d.sale_total || 0), 0);
    const isVendedor = adminTab === 'vendedores';
    const titleMode = mode === 'commissions' ? 'Comisiones' : (isVendedor ? 'Ventas' : 'Producción');

    const pdfStyles = `*{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,sans-serif;font-size:11px;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:20px}
      .header{text-align:center;margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid #333}
      .header h1{font-size:18px;margin-bottom:5px}
      .header p{font-size:12px;color:#666}
      .summary{display:flex;justify-content:space-around;margin-bottom:20px;padding:10px;background:#f5f5f5;border-radius:5px}
      .summary-item{text-align:center}
      .summary-item .value{font-size:16px;font-weight:bold;color:#333}
      .summary-item .label{font-size:10px;color:#666}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:10px}
      th{background:#333!important;color:#fff!important;font-weight:bold}
      tr:nth-child(even){background:#f9f9f9}
      .text-right{text-align:right}
      .total-row{background:#e8f5e9!important;font-weight:bold}
      .footer{margin-top:20px;text-align:center;font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:10px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}th{background:#333!important;color:#fff!important}}`;

    let summaryHtml = '';
    let tableHeaders = '';
    let tableRows = '';
    let totalRow = '';

    if (mode === 'commissions') {
      summaryHtml = `
        <div class="summary-item"><div class="value">${totalUnits}</div><div class="label">Total Unidades</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalComm)}</div><div class="label">Total Comisión</div></div>`;
      tableHeaders = `<th>Fecha</th><th>${isVendedor ? 'Cliente' : 'Producción'}</th><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">Com/U</th><th class="text-right">Total</th>`;
      tableRows = details.map((d: any) => `<tr>
        <td>${format(new Date(d.order_date || d.produced_at), 'dd/MM/yyyy', { locale: es })}</td>
        <td>${d.customer_name || 'Producción'}</td>
        <td>${d.product_name}</td>
        <td class="text-right">${d.quantity}</td>
        <td class="text-right">${formatCurrency(d.commission_per_unit)}</td>
        <td class="text-right" style="font-weight:bold">${formatCurrency(d.total_commission)}</td>
      </tr>`).join('');
      totalRow = `<tr class="total-row"><td colspan="3">TOTAL</td><td class="text-right">${totalUnits}</td><td></td><td class="text-right">${formatCurrency(totalComm)}</td></tr>`;
    } else {
      summaryHtml = `
        <div class="summary-item"><div class="value">${totalUnits}</div><div class="label">Total Unidades</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalSales)}</div><div class="label">Total ${isVendedor ? 'Ventas' : 'Producción'}</div></div>
        <div class="summary-item"><div class="value">${formatCurrency(totalComm)}</div><div class="label">Total Comisión</div></div>`;
      tableHeaders = `<th>Fecha</th><th>${isVendedor ? 'Cliente' : 'Producción'}</th><th>Producto</th><th class="text-right">Cant.</th><th class="text-right">P. Unit</th><th class="text-right">Venta</th><th class="text-right">Com/U</th><th class="text-right">Comisión</th>`;
      tableRows = details.map((d: any) => `<tr>
        <td>${format(new Date(d.order_date || d.produced_at), 'dd/MM/yyyy', { locale: es })}</td>
        <td>${d.customer_name || 'Producción'}</td>
        <td>${d.product_name}</td>
        <td class="text-right">${d.quantity}</td>
        <td class="text-right">${formatCurrency(d.unit_price || 0)}</td>
        <td class="text-right" style="font-weight:bold">${formatCurrency(d.sale_total || 0)}</td>
        <td class="text-right">${formatCurrency(d.commission_per_unit)}</td>
        <td class="text-right">${formatCurrency(d.total_commission)}</td>
      </tr>`).join('');
      totalRow = `<tr class="total-row"><td colspan="3">TOTAL</td><td class="text-right">${totalUnits}</td><td></td><td class="text-right">${formatCurrency(totalSales)}</td><td></td><td class="text-right">${formatCurrency(totalComm)}</td></tr>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titleMode} - ${selectedPerson.name}</title><style>${pdfStyles}</style></head><body>
      <div class="header">
        <h1>📋 ${titleMode} - ${selectedPerson.name}</h1>
        <p>${monthNames[selectedMonth - 1]} ${selectedYear}</p>
        <p>Generado el ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>
      <div class="summary">${summaryHtml}</div>
      <table><thead><tr>${tableHeaders}</tr></thead><tbody>${tableRows}${totalRow}</tbody></table>
      <div class="footer"><p>Sistema de Pedidos y Entregas - ${format(new Date(), 'yyyy')}</p></div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  };

 
   const handleDeleteSingleCommission = (
     personId: string,
     personName: string,
     recordId: string,
     productName: string,
     quantity: number,
     commission: number,
     type: 'vendedor' | 'operario'
   ) => {
     setDeleteTarget({
       personId,
       personName,
       recordId,
       productName,
       quantity,
       commission,
     });
     setDeleteType(type);
     setDeleteDialogOpen(true);
   };
 
   const handleSendOtp = async () => {
     if (!deleteTarget) return;
     
     setSendingOtp(true);
     try {
       // Single record ID
       const recordIds = [deleteTarget.recordId];
 
       const { data, error } = await supabase.functions.invoke('send-commission-delete-otp', {
         body: {
           commissionType: deleteType,
           targetId: deleteTarget.personId,
           targetName: deleteTarget.personName,
           recordIds,
           year: selectedYear,
           month: selectedMonth,
           productName: deleteTarget.productName,
           quantity: deleteTarget.quantity,
         },
       });
 
       if (error) throw error;
 
       toast.success('Código OTP enviado a tu correo');
       setDeleteDialogOpen(false);
       setOtpDialogOpen(true);
     } catch (error: any) {
       console.error('Error sending OTP:', error);
       toast.error(error.message || 'Error al enviar código OTP');
     } finally {
       setSendingOtp(false);
     }
   };
 
   const handleVerifyOtp = async () => {
     if (otpValue.length !== 6) {
       toast.error('Ingresa el código completo de 6 dígitos');
       return;
     }
 
     setVerifyingOtp(true);
     try {
       const { data, error } = await supabase.functions.invoke('verify-commission-delete-otp', {
         body: { otpCode: otpValue },
       });
 
       if (error) throw error;
 
       toast.success(data.message || 'Comisiones eliminadas correctamente');
       setOtpDialogOpen(false);
       setOtpValue('');
       setDeleteTarget(null);
       loadCommissions();
     } catch (error: any) {
       console.error('Error verifying OTP:', error);
       toast.error(error.message || 'Código OTP inválido');
     } finally {
       setVerifyingOtp(false);
     }
   };

  const totalVendedorCommissions = vendedorCommissions.reduce((sum, c) => sum + c.total_commission, 0);
  const totalVendedorUnits = vendedorCommissions.reduce((sum, c) => sum + c.total_units, 0);
  const totalOperarioCommissions = operarioCommissions.reduce((sum, c) => sum + c.total_commission, 0);
  const totalOperarioUnits = operarioCommissions.reduce((sum, c) => sum + c.total_units, 0);
  const totalRepartidorCommissions = repartidorCommissions.reduce((sum, c) => sum + c.total_commission, 0);
  const totalRepartidorUnits = repartidorCommissions.reduce((sum, c) => sum + c.total_units, 0);

  // Non-admin view (vendedor, operario, or repartidor)
  if (!isAdminOrSuper) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Mis Comisiones
          </h1>
          {isVendedor && (
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('monthly')}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Mensual
              </Button>
              <Button
                variant={viewMode === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('daily')}
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Diario
              </Button>
            </div>
          )}
        </div>

        {/* Month selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium min-w-[150px] text-center">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {loadingCommissions ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Cargando...
            </CardContent>
          </Card>
        ) : viewMode === 'monthly' && myCommission ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {isOperario ? 'Unidades Producidas' : isRepartidor ? 'Unidades Entregadas' : 'Unidades Vendidas'}
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{myCommission.total_units}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Periodo 1 (1-15)</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(myCommission.period1_commission)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myCommission.period1_units} unidades
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Periodo 2 (16-{new Date(selectedYear, selectedMonth, 0).getDate()})</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(myCommission.period2_commission)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {myCommission.period2_units} unidades
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total del Mes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(myCommission.total_commission)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Details table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalle de Comisiones</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>{isOperario ? 'Producción' : 'Cliente'}</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myCommission.details?.slice(0, 20).map((d: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          {format(new Date(d.order_date || d.produced_at), 'dd/MM', { locale: es })}
                        </TableCell>
                        <TableCell className="text-sm">{d.customer_name || 'Producción'}</TableCell>
                        <TableCell className="text-sm">{d.product_name}</TableCell>
                        <TableCell className="text-right">{d.quantity}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(d.total_commission)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!myCommission.details || myCommission.details.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay comisiones este mes
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : viewMode === 'daily' && isVendedor ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comisiones por Día (últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">Comisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyCommissions.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">
                        {format(new Date(d.date + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">{d.units}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(d.commission)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {dailyCommissions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No hay comisiones en los últimos 30 días
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No hay datos de comisiones disponibles
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Admin view
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Comisiones
        </h1>
      </div>

      {/* Month selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[150px] text-center">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Vendedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalVendedorCommissions)}</div>
            <p className="text-xs text-muted-foreground">{totalVendedorUnits} unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Repartidores</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalRepartidorCommissions)}</div>
            <p className="text-xs text-muted-foreground">{totalRepartidorUnits} unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Comisiones Operarios</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalOperarioCommissions)}</div>
            <p className="text-xs text-muted-foreground">{totalOperarioUnits} unidades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Comisiones</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(totalVendedorCommissions + totalRepartidorCommissions + totalOperarioCommissions)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Personal Activo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(vendedores?.filter(v => v.active).length || 0) + (repartidores?.filter(r => r.active).length || 0) + (operarios?.filter(o => o.active).length || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="commissions">
        <TabsList>
          <TabsTrigger value="commissions">Comisiones del Mes</TabsTrigger>
          <TabsTrigger value="products">Comisión por Producto</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="mt-4 space-y-4">
          {/* Sub-tabs for vendedores/repartidores/operarios */}
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={adminTab === 'vendedores' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminTab('vendedores')}
              >
                <Users className="h-4 w-4 mr-1" />
                Vendedores
              </Button>
              <Button
                variant={adminTab === 'repartidores' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminTab('repartidores')}
              >
                <Truck className="h-4 w-4 mr-1" />
                Repartidores
              </Button>
              <Button
                variant={adminTab === 'operarios' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminTab('operarios')}
              >
                <Wrench className="h-4 w-4 mr-1" />
                Operarios
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCommissionsPDF(adminTab)}
            >
              <FileDown className="h-4 w-4 mr-1" />
              Descargar PDF
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingCommissions || calcVendedorLoading || calcOperarioLoading || calcRepartidorLoading ? (
                <div className="p-8 text-center text-muted-foreground">Cargando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{adminTab === 'vendedores' ? 'Vendedor' : adminTab === 'repartidores' ? 'Repartidor' : 'Operario'}</TableHead>
                      <TableHead className="text-right">Periodo 1 (1-15)</TableHead>
                      <TableHead className="text-right">Periodo 2 (16-{new Date(selectedYear, selectedMonth, 0).getDate()})</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(adminTab === 'vendedores' ? vendedorCommissions : adminTab === 'repartidores' ? repartidorCommissions : operarioCommissions).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(c.period1_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.period1_units} uds
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{formatCurrency(c.period2_commission)}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.period2_units} uds
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-bold ${adminTab === 'vendedores' ? 'text-green-600' : adminTab === 'repartidores' ? 'text-orange-600' : 'text-blue-600'}`}>
                            {formatCurrency(c.total_commission)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.total_units} uds
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPerson(c)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(adminTab === 'vendedores' ? vendedorCommissions : adminTab === 'repartidores' ? repartidorCommissions : operarioCommissions).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No hay datos de comisiones
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comisión por Producto</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define el monto de comisión por unidad para vendedores (ventas) y operarios (producción)
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Comisión Vendedor</TableHead>
                    <TableHead className="text-right">Comisión Operario</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="font-medium">{product.product_name}</TableCell>
                      <TableCell className="text-right">
                        {editingProduct === product.product_id && editingType === 'vendedor' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span>S/</span>
                            <Input
                              type="number"
                              value={newAmount}
                              onChange={(e) => setNewAmount(e.target.value)}
                              className="w-24 text-right"
                              placeholder="0.0000"
                              min="0"
                              step="0.0001"
                            />
                          </div>
                        ) : (
                          <Badge variant={product.commission_amount > 0 ? 'default' : 'outline'}>
                            {formatCurrency(product.commission_amount)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingProduct === product.product_id && editingType === 'operario' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span>S/</span>
                            <Input
                              type="number"
                              value={newAmount}
                              onChange={(e) => setNewAmount(e.target.value)}
                              className="w-24 text-right"
                              placeholder="0.0000"
                              min="0"
                              step="0.0001"
                            />
                          </div>
                        ) : (
                          <Badge variant={product.operario_commission_amount > 0 ? 'secondary' : 'outline'}>
                            {formatCurrency(product.operario_commission_amount)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingProduct === product.product_id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleSaveProductCommission(product.product_id)}>
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingProduct(null);
                              setNewAmount('');
                            }}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProduct(product.product_id);
                                setEditingType('vendedor');
                                setNewAmount(product.commission_amount.toString());
                              }}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              V
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingProduct(product.product_id);
                                setEditingType('operario');
                                setNewAmount(product.operario_commission_amount.toString());
                              }}
                            >
                              <Wrench className="h-3 w-3 mr-1" />
                              O
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Details dialog */}
      <Dialog open={!!selectedPerson} onOpenChange={() => setSelectedPerson(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between gap-2">
            <DialogTitle>Detalle de Comisiones - {selectedPerson?.name}</DialogTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  <FileDown className="h-4 w-4 mr-1" />
                  Descargar PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportPersonDetailPDF('commissions')}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Solo Comisiones
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPersonDetailPDF('sales')}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Total de Ventas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>{adminTab === 'vendedores' ? 'Cliente' : 'Producción'}</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Com/U</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPerson?.details.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      {format(new Date(d.order_date || d.produced_at), 'dd/MM', { locale: es })}
                    </TableCell>
                    <TableCell className="text-sm">{d.customer_name || 'Producción'}</TableCell>
                    <TableCell className="text-sm">{d.product_name}</TableCell>
                    <TableCell className="text-right">{d.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(d.commission_per_unit)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${adminTab === 'vendedores' ? 'text-green-600' : 'text-blue-600'}`}>
                      {formatCurrency(d.total_commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteSingleCommission(
                          selectedPerson.id,
                          selectedPerson.name,
                          d.order_id || d.production_id,
                          d.product_name,
                          d.quantity,
                          d.total_commission,
                          adminTab === 'vendedores' ? 'vendedor' : 'operario'
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!selectedPerson?.details || selectedPerson.details.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No hay detalles disponibles
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
       {/* Delete confirmation dialog */}
       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle className="text-destructive flex items-center gap-2">
               <Trash2 className="h-5 w-5" />
               Eliminar Comisión
             </AlertDialogTitle>
             <AlertDialogDescription className="space-y-2">
               <p>
                 Estás a punto de eliminar el registro de comisión de <strong>{deleteTarget?.personName}</strong>:
               </p>
               <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                 <p><strong>Producto:</strong> {deleteTarget?.productName}</p>
                 <p><strong>Cantidad:</strong> {deleteTarget?.quantity} unidades</p>
                 <p><strong>Comisión:</strong> {formatCurrency(deleteTarget?.commission || 0)}</p>
               </div>
               <p className="text-destructive font-medium">
                 {deleteType === 'vendedor' 
                   ? 'Esto eliminará el pedido asociado y restaurará el stock.'
                   : 'Esto eliminará el registro de producción y reducirá el stock.'}
               </p>
               <p>Esta acción no se puede deshacer. Se enviará un código OTP a tu correo para confirmar.</p>
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel disabled={sendingOtp}>Cancelar</AlertDialogCancel>
             <AlertDialogAction
               onClick={(e) => {
                 e.preventDefault();
                 handleSendOtp();
               }}
               disabled={sendingOtp}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {sendingOtp ? (
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Enviando...
                 </>
               ) : (
                 'Enviar código OTP'
               )}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
 
       {/* OTP verification dialog */}
       <Dialog open={otpDialogOpen} onOpenChange={(open) => {
         if (!open) {
           setOtpDialogOpen(false);
           setOtpValue('');
         }
       }}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="text-destructive">Verificar eliminación</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <p className="text-sm text-muted-foreground">
               Ingresa el código de 6 dígitos enviado a tu correo para confirmar la eliminación
               del registro de <strong>{deleteTarget?.personName}</strong> - {deleteTarget?.productName}.
             </p>
             <div className="flex justify-center">
               <InputOTP
                 maxLength={6}
                 value={otpValue}
                 onChange={setOtpValue}
               >
                 <InputOTPGroup>
                   <InputOTPSlot index={0} />
                   <InputOTPSlot index={1} />
                   <InputOTPSlot index={2} />
                   <InputOTPSlot index={3} />
                   <InputOTPSlot index={4} />
                   <InputOTPSlot index={5} />
                 </InputOTPGroup>
               </InputOTP>
             </div>
             <div className="flex justify-end gap-2">
               <Button
                 variant="outline"
                 onClick={() => {
                   setOtpDialogOpen(false);
                   setOtpValue('');
                 }}
                 disabled={verifyingOtp}
               >
                 Cancelar
               </Button>
               <Button
                 variant="destructive"
                 onClick={handleVerifyOtp}
                 disabled={verifyingOtp || otpValue.length !== 6}
               >
                 {verifyingOtp ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Verificando...
                   </>
                 ) : (
                   'Confirmar eliminación'
                 )}
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     </div>
   );
 }
