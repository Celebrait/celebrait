import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/header";
import { ArrowLeft } from "lucide-react";

// Check if Stripe is configured for production use
const hasStripeKey = !!import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = hasStripeKey ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY) : null;

const CheckoutForm = ({ cardData }: { cardData: any }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasStripeKey) {
      // Demo mode - simulate payment
      setIsProcessing(true);
      setTimeout(() => {
        toast({
          title: "Demo Payment Completed",
          description: "This is a demo. In production, provide your Stripe keys for real payments.",
        });
        setIsProcessing(false);
        // Simulate successful payment
        window.location.href = `${window.location.origin}?payment=success&cardId=${cardData.id}`;
      }, 2000);
      return;
    }

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}?payment=success&cardId=${cardData.id}`,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Thank you for your purchase!",
      });
    }

    setIsProcessing(false);
  };

  if (!hasStripeKey) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6">
          <h4 className="font-bold text-yellow-800 mb-2">Demo Mode</h4>
          <p className="text-yellow-700 text-sm">
            This is a demo payment form. Click below to simulate a successful payment.
            To enable real payments, add your Stripe API keys.
          </p>
        </div>
        <Button 
          type="submit" 
          className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-6 text-lg font-semibold rounded-2xl"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing Demo Payment..." : `Demo Payment - R${(cardData.price / 100).toFixed(2)}`}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-6 text-lg font-semibold rounded-2xl"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? "Processing..." : `Complete Payment - R${(cardData.price / 100).toFixed(2)}`}
      </Button>
    </form>
  );
};

export default function Checkout() {
  const { cardId } = useParams();
  const [clientSecret, setClientSecret] = useState("");
  const [cardData, setCardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // Fetch card data
        const cardResponse = await apiRequest("GET", `/api/cards/${cardId}`);
        const card = await cardResponse.json();
        setCardData(card);

        // Only create payment intent if Stripe is configured
        if (hasStripeKey) {
          try {
            const paymentResponse = await apiRequest("POST", "/api/create-payment-intent", { cardId: parseInt(cardId!) });
            const { clientSecret } = await paymentResponse.json();
            setClientSecret(clientSecret);
          } catch (error) {
            console.log("Stripe not configured, using demo mode");
          }
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load card data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (cardId) {
      initializePayment();
    }
  }, [cardId, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if ((!clientSecret && hasStripeKey) || !cardData) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Payment Error</h1>
          <p className="text-slate-gray">Unable to initialize payment. Please try again.</p>
          <Button 
            onClick={() => window.history.back()} 
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button 
            onClick={() => window.history.back()} 
            variant="ghost" 
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Card Preview
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Purchase</h1>
          <p className="text-slate-gray">Secure payment powered by Stripe</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Card Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Your Card</CardTitle>
            </CardHeader>
            <CardContent>
              {cardData.frontImageUrl && (
                <div className="mb-4 flex justify-center">
                  <img 
                    src={cardData.frontImageUrl} 
                    alt="Card preview" 
                    style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-gray">Type:</span>
                  <span className="font-medium capitalize">{cardData.cardType}</span>
                </div>
                {cardData.printOption && (
                  <div className="flex justify-between">
                    <span className="text-slate-gray">Option:</span>
                    <span className="font-medium capitalize">{cardData.printOption.replace('-', ' ')}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>R{(cardData.price / 100).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {hasStripeKey && clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm cardData={cardData} />
                </Elements>
              ) : (
                <CheckoutForm cardData={cardData} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
