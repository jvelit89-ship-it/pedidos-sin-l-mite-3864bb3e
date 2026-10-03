import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from '@/contexts/AuthContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { lazy, Suspense, useEffect } from 'react';
import { handleError } from '@/lib/error-handler';


const AuthPage = lazy(() => import('./pages/AuthPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const NewOrderPage = lazy(() => import('./pages/NewOrderPage'));
const DeliveriesPage = lazy(() => import('./pages/DeliveriesPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomersMapPage = lazy(() => import('./pages/CustomersMapPage'));
const VendedoresPage = lazy(() => import('./pages/VendedoresPage'));
const RepartidoresPage = lazy(() => import('./pages/RepartidoresPage'));
const OperariosPage = lazy(() => import('./pages/OperariosPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const RoutePage = lazy(() => import('./pages/RoutePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const CommissionsPage = lazy(() => import('./pages/CommissionsPage'));
const ManualPage = lazy(() => import('./pages/ManualPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const NewPurchasePage = lazy(() => import('./pages/NewPurchasePage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const ProtectedAppShell = lazy(() => import('./components/ProtectedAppShell'));
const PurchasesQueryProvider = lazy(() => import('./components/PurchasesQueryProvider'));
const ProductionRecipeBootstrap = lazy(() =>
  import('./components/ProductionRecipeBootstrap').then((module) => ({
    default: module.ProductionRecipeBootstrap,
  }))
);

// Public pages (no auth required)
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const CustomerPortalPage = lazy(() => import('./pages/CustomerPortalPage'));
const DirectOrderPage = lazy(() => import('./pages/DirectOrderPage'));
const DistributorPortalPage = lazy(() => import('./pages/DistributorPortalPage'));

const App = () => {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      handleError(event.reason, { context: 'Unhandled Promise Rejection', silent: true });
    };

    const handleGlobalError = (event: ErrorEvent) => {
      handleError(event.error, { context: 'Global Error', silent: true });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  return (

    <AuthProvider>
      <SettingsProvider>
        <TooltipProvider>
          <Sonner position="top-center" />
              <BrowserRouter>
                <Suspense
                  fallback={
                    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
                      Cargando...
                    </div>
                  }
                >
                  <Routes>
                  {/* Public routes - Customer Portal */}
                  <Route path="/track" element={<CustomerPortalPage />} />
                  <Route path="/pedidos-online" element={<DirectOrderPage />} />
                  <Route path="/pedidos-directos/:companyId" element={<DirectOrderPage />} />
                  <Route path="/distribuidor" element={<DistributorPortalPage />} />
                  <Route path="/track/:trackingCode" element={<OrderTrackingPage />} />
                  
                  {/* Auth routes */}
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/login" element={<Navigate to="/auth" replace />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/" element={<Navigate to="/auth" replace />} />
                  
                  {/* Protected routes share one persistent shell/provider tree */}
                  <Route element={<ProtectedAppShell />}>
                    <Route path="/companies" element={<CompaniesPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/orders/new" element={<NewOrderPage />} />
                    <Route path="/orders/:id" element={<OrderDetailPage />} />
                    <Route path="/deliveries" element={<DeliveriesPage />} />
                    <Route path="/route" element={<RoutePage />} />
                    <Route path="/inventory" element={
                      <ProductionRecipeBootstrap>
                        <InventoryPage />
                      </ProductionRecipeBootstrap>
                    } />
                    <Route path="/purchases" element={
                      <PurchasesQueryProvider>
                        <PurchasesPage />
                      </PurchasesQueryProvider>
                    } />
                    <Route path="/purchases/new" element={
                      <PurchasesQueryProvider>
                        <NewPurchasePage />
                      </PurchasesQueryProvider>
                    } />
                    <Route path="/suppliers" element={
                      <PurchasesQueryProvider>
                        <SuppliersPage />
                      </PurchasesQueryProvider>
                    } />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/customers-map" element={<CustomersMapPage />} />
                    <Route path="/vendedores" element={<VendedoresPage />} />
                    <Route path="/repartidores" element={<RepartidoresPage />} />
                    <Route path="/operarios" element={<OperariosPage />} />
                    <Route path="/commissions" element={<CommissionsPage />} />
                    <Route path="/manual" element={<ManualPage />} />
                    <Route path="/logs" element={<AuditLogsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
        </TooltipProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;
