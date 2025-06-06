import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Header from "@/components/header";
import { ArrowLeft, CreditCard, Shield, Lock } from "lucide-react";

// Check if YOCO is configured for production use
const hasYocoKey = !!import.meta.env.VITE_YOCO_PUBLIC_KEY;

const CheckoutForm = ({ cardData }: { cardData: any }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'checkout'>('checkout');
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });

  const handleYocoCheckout = async () => {
    if (!hasYocoKey) {
      // Demo mode - simulate payment
      setIsProcessing(true);
      setTimeout(() => {
        toast({
          title: "Demo Payment Completed",
          description: "This is a demo. In production, provide your YOCO keys for real payments.",
        });
        setIsProcessing(false);
        // Simulate successful payment
        window.location.href = `${window.location.origin}?payment=success&cardId=${cardData.id}`;
      }, 2000);
      return;
    }

    try {
      setIsProcessing(true);
      
      // Create YOCO checkout session
      const response = await apiRequest("POST", "/api/yoco/create-checkout", {
        cardId: cardData.id
      });
      
      const { redirectUrl } = await response.json();
      
      // Redirect to YOCO checkout page
      window.location.href = redirectUrl;
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasYocoKey) {
      await handleYocoCheckout();
      return;
    }

    try {
      setIsProcessing(true);
      
      // In a real implementation, you would tokenize the card details with YOCO's JS SDK
      // For now, we'll use the checkout flow
      await handleYocoCheckout();
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Payment processing failed",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (!hasYocoKey) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6">
          <h4 className="font-bold text-yellow-800 mb-2">Demo Mode</h4>
          <p className="text-yellow-700 text-sm">
            This is a demo payment form. Click below to simulate a successful payment.
            To enable real payments, add your YOCO API keys.
          </p>
        </div>
        <Button 
          onClick={handleYocoCheckout}
          className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-6 text-lg font-semibold rounded-2xl"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing Demo Payment..." : `Demo Payment - R${(cardData.price / 100).toFixed(2)}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      <div className="grid grid-cols-1 gap-4">
        <div className="border-2 border-purple-200 rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="flex items-center space-x-3 mb-4">
            <CreditCard className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-800">Secure Payment with YOCO</h3>
          </div>
          <p className="text-gray-600 text-sm mb-6">
            Pay securely with your credit or debit card. Your payment information is encrypted and protected.
          </p>
          
          <div className="flex items-center justify-between text-sm text-gray-600 mb-6">
            <div className="flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>256-bit SSL encryption</span>
            </div>
            <div className="flex items-center space-x-1">
              <Lock className="w-4 h-4" />
              <span>PCI DSS compliant</span>
            </div>
          </div>

          <Button 
            onClick={handleYocoCheckout}
            className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-6 text-lg font-semibold rounded-2xl transition-all"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing...</span>
              </div>
            ) : (
              `Pay R${(cardData.price / 100).toFixed(2)} with YOCO`
            )}
          </Button>
          
          <div className="flex justify-center space-x-4 mt-4 text-xs text-gray-500">
            <span>Visa</span>
            <span>•</span>
            <span>Mastercard</span>
            <span>•</span>
            <span>American Express</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Checkout() {
  const { cardId } = useParams();
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

  if (!cardData) {
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
          <p className="text-slate-gray">Secure payment powered by YOCO</p>
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
              <CheckoutForm cardData={cardData} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
