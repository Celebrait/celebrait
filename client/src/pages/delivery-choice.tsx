
import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Truck, Download } from "lucide-react";
import Header from "@/components/header";
import CardMockup from "@/components/card-mockup";
import { emergencyStorageCleanup } from "@/lib/queryClient";

export default function DeliveryChoice() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/delivery-choice/:cardId");
  const [cardData, setCardData] = useState<any>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<'printed' | 'digital' | null>(null);

  useEffect(() => {
    // Get card data from session storage
    try {
      const storedCardData = sessionStorage.getItem('cardPreviewData');
      if (storedCardData) {
        setCardData(JSON.parse(storedCardData));
      }
    } catch (e) {
      console.error('Error loading card data:', e);
    }
  }, []);

  const handleDeliverySelected = (delivery: 'printed' | 'digital') => {
    setSelectedDelivery(delivery);
    
    if (delivery === 'digital') {
      // Handle digital download
      setLocation('/order-success');
    } else {
      // Navigate to payment page for printed cards
      setTimeout(() => {
        try {
          setLocation(`/payment-tips/${params?.cardId}`);
        } catch (error) {
          console.error('Navigation failed:', error);
          window.location.href = `/payment-tips/${params?.cardId}`;
        }
      }, 200);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  if (!cardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button 
            onClick={handleBack} 
            variant="ghost" 
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Card Preview
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Choose Your Delivery Option</h1>
          <p className="text-slate-gray">How would you like to receive your card?</p>
        </div>

        {/* Card Preview */}
        <div className="mb-8 text-center">
          <CardMockup 
            frontImageUrl={cardData.frontImageUrl}
            insideImageUrl={cardData.insideImageUrl}
            deliveryType="printed"
            currentView="front"
          />
        </div>

        {/* Delivery Options */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Printed & Delivered */}
          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
              selectedDelivery === 'printed' 
                ? 'border-2 border-purple-500 bg-purple-50' 
                : 'border-2 border-gray-200 bg-white/80'
            }`}
            onClick={() => handleDeliverySelected('printed')}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="text-white w-8 h-8" />
              </div>
              <CardTitle className="text-xl">Printed & Delivered</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-4">R129</div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ High-quality printed card (5" x 5")</li>
                <li>✓ Premium cardstock</li>
                <li>✓ Delivered to recipient</li>
                <li>✓ Perfect for special occasions</li>
              </ul>
              <Button 
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeliverySelected('printed');
                }}
              >
                Choose Printed & Delivered
              </Button>
            </CardContent>
          </Card>

          {/* Digital Download */}
          <Card 
            className={`cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
              selectedDelivery === 'digital' 
                ? 'border-2 border-green-500 bg-green-50' 
                : 'border-2 border-gray-200 bg-white/80'
            }`}
            onClick={() => handleDeliverySelected('digital')}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download className="text-white w-8 h-8" />
              </div>
              <CardTitle className="text-xl">Digital Download</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-4">R29</div>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>✓ Instant download</li>
                <li>✓ High-resolution files</li>
                <li>✓ Print at home or locally</li>
                <li>✓ Share digitally</li>
              </ul>
              <Button 
                className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:opacity-90"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeliverySelected('digital');
                }}
              >
                Choose Digital Download
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
