import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from '@/contexts/AuthContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { AppLayout } from '@/components/AppLayout';
import { ProductionRecipeBootstrap } from '@/components/ProductionRecipeBootstrap';
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

// Public pages (no auth required)
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const CustomerPortalPage = lazy(() => import('./pages/CustomerPortalPage'));
const DirectOrderPage = lazy(() => import('./pages/DirectOrderPage'));
const DistributorPortalPage = lazy(() => import('./pages/DistributorPortalPage'));

const queryClient = new QueryClient();
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <AppLayout>{children}</AppLayout>;

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

    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncProvider>
          <SettingsProvider>
            <TooltipProvider>
              <Toaster />
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
                  
                  {/* Protected routes */}
                  <Route path="/companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                  <Route path="/orders/new" element={<ProtectedRoute><NewOrderPage /></ProtectedRoute>} />
                  <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                  <Route path="/deliveries" element={<ProtectedRoute><DeliveriesPage /></ProtectedRoute>} />
                  <Route path="/route" element={<ProtectedRoute><RoutePage /></ProtectedRoute>} />
                  <Route path="/inventory" element={
                    <ProtectedRoute>
                      <ProductionRecipeBootstrap>
                        <InventoryPage />
                      </ProductionRecipeBootstrap>
                    </ProtectedRoute>
                  } />
                  <Route path="/purchases" element={<ProtectedRoute><PurchasesPage /></ProtectedRoute>} />
                  <Route path="/purchases/new" element={<ProtectedRoute><NewPurchasePage /></ProtectedRoute>} />
                  <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
                  <Route path="/customers-map" element={<ProtectedRoute><CustomersMapPage /></ProtectedRoute>} />
                  <Route path="/vendedores" element={<ProtectedRoute><VendedoresPage /></ProtectedRoute>} />
                  <Route path="/repartidores" element={<ProtectedRoute><RepartidoresPage /></ProtectedRoute>} />
                  <Route path="/operarios" element={<ProtectedRoute><OperariosPage /></ProtectedRoute>} />
                  <Route path="/commissions" element={<ProtectedRoute><CommissionsPage /></ProtectedRoute>} />
                  <Route path="/manual" element={<ProtectedRoute><ManualPage /></ProtectedRoute>} />
                  <Route path="/logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </SettingsProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
