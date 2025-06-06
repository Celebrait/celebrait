import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CreditCard, Shield, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/header';

// Check if YOCO is configured for production use
const hasYocoKey = !!import.meta.env.VITE_YOCO_PUBLIC_KEY;

interface TestCardData {
  id: number;
  frontImageUrl: string | null;
  cardType: string;
  printOption: string | null;
  price: number;
  status: string;
}

const TestCheckoutForm = ({ cardData }: { cardData: TestCardData }) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

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
        window.location.href = `/payment-success?payment=success&cardId=${cardData.id}`;
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

export default function TestPayment() {
  // Sample test card data
  const testCardData: TestCardData = {
    id: 999,
    frontImageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=500&fit=crop",
    cardType: "printed",
    printOption: "front-and-inside",
    price: 4500, // R45.00 in cents
    status: "completed"
  };

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
            Back
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Test YOCO Payment</h1>
          <p className="text-slate-gray">Test the YOCO payment integration</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Test Card Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Test Card</CardTitle>
            </CardHeader>
            <CardContent>
              {testCardData.frontImageUrl && (
                <img 
                  src={testCardData.frontImageUrl} 
                  alt="Test card preview" 
                  className="w-full rounded-xl shadow-lg mb-4"
                />
              )}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-gray">Type:</span>
                  <span className="font-medium capitalize">{testCardData.cardType}</span>
                </div>
                {testCardData.printOption && (
                  <div className="flex justify-between">
                    <span className="text-slate-gray">Option:</span>
                    <span className="font-medium capitalize">{testCardData.printOption.replace('-', ' ')}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>R{(testCardData.price / 100).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* YOCO Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <TestCheckoutForm cardData={testCardData} />
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="font-semibold text-blue-800 mb-2">Test Instructions:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• This is a test payment page with sample card data</li>
            <li>• Click the payment button to test the YOCO integration</li>
            <li>• In demo mode, it will simulate a successful payment</li>
            <li>• With real YOCO keys, it will redirect to YOCO's checkout</li>
          </ul>
        </div>
      </main>
    </div>
  );
}