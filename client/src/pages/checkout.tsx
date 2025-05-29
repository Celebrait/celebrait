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

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ cardData }: { cardData: any }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

        // Create payment intent
        const paymentResponse = await apiRequest("POST", "/api/create-payment-intent", { cardId: parseInt(cardId!) });
        const { clientSecret } = await paymentResponse.json();
        setClientSecret(clientSecret);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to initialize payment",
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

  if (!clientSecret || !cardData) {
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
                <img 
                  src={cardData.frontImageUrl} 
                  alt="Card preview" 
                  className="w-full rounded-xl shadow-lg mb-4"
                />
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
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm cardData={cardData} />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
