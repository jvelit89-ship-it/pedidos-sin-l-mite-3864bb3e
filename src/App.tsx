import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from '@/contexts/AuthContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { AppLayout } from '@/components/AppLayout';
import { initializeDemoData } from '@/lib/db';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import NewOrderPage from './pages/NewOrderPage';
import DeliveriesPage from './pages/DeliveriesPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import CustomersMapPage from './pages/CustomersMapPage';
import VendedoresPage from './pages/VendedoresPage';
import RepartidoresPage from './pages/RepartidoresPage';
import CompaniesPage from './pages/CompaniesPage';
import RoutePage from './pages/RoutePage';
import SettingsPage from './pages/SettingsPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <AppLayout>{children}</AppLayout>;

const App = () => {
  useEffect(() => { initializeDemoData(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SyncProvider>
          <SettingsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner position="top-center" />
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                  <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                  <Route path="/orders/new" element={<ProtectedRoute><NewOrderPage /></ProtectedRoute>} />
                  <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                  <Route path="/deliveries" element={<ProtectedRoute><DeliveriesPage /></ProtectedRoute>} />
                  <Route path="/route" element={<ProtectedRoute><RoutePage /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
                  <Route path="/products" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
                  <Route path="/customers-map" element={<ProtectedRoute><CustomersMapPage /></ProtectedRoute>} />
                  <Route path="/vendedores" element={<ProtectedRoute><VendedoresPage /></ProtectedRoute>} />
                  <Route path="/repartidores" element={<ProtectedRoute><RepartidoresPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </SettingsProvider>
        </SyncProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
