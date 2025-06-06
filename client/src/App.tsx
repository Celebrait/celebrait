import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Checkout from "@/pages/checkout";
import Payment from "@/pages/payment";
import PaymentSuccess from "@/pages/payment-success";
import TestPayment from "@/pages/test-payment";
import TestGeneration from "@/pages/test-generation";
import StyleTest from "@/pages/style-test";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/checkout/:cardId" component={Checkout} />
      <Route path="/payment/:cardId" component={Payment} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/test-payment" component={TestPayment} />
      <Route path="/test" component={TestGeneration} />
      <Route path="/style-test" component={StyleTest} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
