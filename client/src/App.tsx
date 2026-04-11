import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/scroll-to-top";
import { handleQuotaError } from "./lib/queryClient";
import { useEffect } from "react";
import Landing from "@/pages/landing";
import CreateCard from "@/pages/create-card";
import PaymentSuccess from './pages/payment-success';
import PaymentCancelled from './pages/payment-cancelled';
import OrderSuccess from './pages/order-success';
import CompleteOrder from './pages/complete-order';
import CardPreviewPage from "@/pages/card-preview-page";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/terms-of-service";
import Dashboard from "@/pages/dashboard";
import RegenPage from "@/pages/regen-page";
import AdminPromptsPage from "@/pages/admin-prompts";
import LoginPage from "@/pages/login";
import { RequireAuth, RequireAdmin } from "@/components/require-auth";
import AdminLayout from "@/layouts/admin-layout";


function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={LoginPage} />
        <Route path="/create-card" component={CreateCard} />
        <Route path="/payment-success/:reference" component={PaymentSuccess} />
        <Route path="/payment-cancelled/:reference" component={PaymentCancelled} />
        <Route path="/order-success" component={OrderSuccess} />
        <Route path="/complete-order/:cardId" component={CompleteOrder} />
        <Route path="/card-preview/:reference" component={CardPreviewPage} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms-of-service" component={TermsOfService} />
        <Route path="/dashboard">
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        </Route>
        <Route path="/regen/:cardId" component={RegenPage} />
        <Route path="/admin/prompts">
          <RequireAdmin>
            <AdminLayout>
              <AdminPromptsPage />
            </AdminLayout>
          </RequireAdmin>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  useEffect(() => {
    // Global error handler for quota exceeded errors
    const handleGlobalError = (event: ErrorEvent) => {
      if (event.error && handleQuotaError(event.error)) {
        event.preventDefault();
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && handleQuotaError(event.reason)) {
        event.preventDefault();
        return true;
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
