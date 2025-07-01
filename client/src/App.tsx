import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/scroll-to-top";
import { handleQuotaError } from "./lib/queryClient";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Checkout from "@/pages/checkout";
import Payment from "@/pages/payment";
import PaymentSuccess from './pages/payment-success';
import OrderSuccess from './pages/order-success';
import CompleteOrder from './pages/complete-order';
import DigitalCardViewer from './pages/digital-card-viewer';
import TestPayment from "@/pages/test-payment";
import TestGeneration from "@/pages/test-generation";
import StyleTest from "@/pages/style-test";
import GPTImageTest from "@/pages/gpt-image-test";
import TestCardPreview from "@/pages/test-card-preview";
import NotFound from "@/pages/not-found";
import PaymentWithTips from "@/pages/payment-with-tips";
import DeliveryChoice from "@/pages/delivery-choice";
import CardPreviewPage from "@/pages/card-preview-page";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <ScrollToTop />
      <Switch>
        {isLoading || !isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/" component={Home} />
            <Route path="/checkout/:cardId" component={Checkout} />
            <Route path="/payment/:cardId" component={Payment} />
            <Route path="/payment-tips/:cardId" component={PaymentWithTips} />
            <Route path="/payment-success" component={PaymentSuccess} />
            <Route path="/order-success" component={OrderSuccess} />
            <Route path="/complete-order/:cardId" component={CompleteOrder} />
            <Route path="/delivery-choice/:cardId" component={DeliveryChoice} />
            <Route path="/test" component={TestGeneration} />
            <Route path="/test-payment" component={TestPayment} />
            <Route path="/test-generation" component={TestGeneration} />
            <Route path="/style-test" component={StyleTest} />
            <Route path="/gpt-image-test" component={GPTImageTest} />
            <Route path="/test-card-preview" component={TestCardPreview} />
          </>
        )}
        {/* Public routes accessible to everyone */}
        <Route path="/card/:linkId" component={DigitalCardViewer} />
        <Route path="/card-preview/:reference" component={CardPreviewPage} />
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