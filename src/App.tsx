import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { BusinessModeProvider } from "@/context/BusinessModeContext";
import { BusinessSettingsProvider } from "@/context/BusinessSettingsContext";
import { OrderQueueProvider } from "@/context/OrderQueueContext";
import { CartProvider } from "@/context/CartContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import CustomerOrder from "./pages/CustomerOrder";
import CustomerOrderTracking from "./pages/CustomerOrderTracking";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <AuthProvider>
      <BusinessModeProvider>
        <BusinessSettingsProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Protected POS app – requires authentication */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />

                  {/* Public customer-facing routes – no auth needed */}
                  <Route
                    path="/order"
                    element={
                      <CartProvider>
                        <OrderQueueProvider>
                          <CustomerOrder />
                        </OrderQueueProvider>
                      </CartProvider>
                    }
                  />
                  <Route
                    path="/track/:trackingCode"
                    element={
                      <OrderQueueProvider>
                        <CustomerOrderTracking />
                      </OrderQueueProvider>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </QueryClientProvider>
        </BusinessSettingsProvider>
      </BusinessModeProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
