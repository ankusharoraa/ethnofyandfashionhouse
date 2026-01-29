import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Scan from "./pages/Scan";
import SalesBilling from "./pages/SalesBilling";
 import PurchaseBilling from "./pages/PurchaseBilling";
 import PurchaseBillingRevamped from "./pages/PurchaseBillingRevamped";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import BarcodePrinting from "./pages/BarcodePrinting";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const BillingRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/sales${location.search}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/barcode-printing" element={<BarcodePrinting />} />
            {/* Backward compatible route for deep links */}
            <Route path="/billing" element={<BillingRedirect />} />
            <Route path="/sales" element={<SalesBilling />} />
            <Route path="/purchases" element={<PurchaseBillingRevamped />} />
            <Route path="/purchases/old" element={<PurchaseBilling />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:customerId/ledger" element={<CustomerLedger />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
