
import { useState } from "react";
import { useLocation } from "wouter";
import CardPreview from "@/components/card-preview";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock card data
const mockCard = {
  id: 999,
  frontImageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=512&fit=crop&crop=center",
  insideImageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=512&fit=crop&crop=center&sat=-100&bri=20",
  cardType: 'printed',
  printOption: 'front-and-inside',
  sceneType: 'with-person',
  status: 'completed',
  price: 12900, // R129.00 in cents
  conversationData: {
    originalFrontImageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=512&fit=crop&crop=center",
    originalInsideImageUrl: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=512&fit=crop&crop=center&sat=-100&bri=20"
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Mock onboarding data
const mockOnboarding = {
  answers: {
    name: "Sarah",
    celebration: "birthday",
    message: "Happy Birthday!",
    inside_message: "Hope your special day is filled with joy and laughter!",
    art_style: "watercolor painting",
    scene: "birthday party celebration"
  },
  selectedDelivery: 'printed' as 'printed' | 'digital',
  setSelectedDelivery: (delivery: 'printed' | 'digital') => {
    mockOnboarding.selectedDelivery = delivery;
  },
  setCurrentStep: (step: number) => {
    console.log('Setting current step to:', step);
  }
};

export default function TestCardPreview() {
  const [, setLocation] = useLocation();
  const [deliveryType, setDeliveryType] = useState<'printed' | 'digital'>('printed');

  const handleDeliveryChange = (delivery: 'printed' | 'digital') => {
    setDeliveryType(delivery);
    mockOnboarding.setSelectedDelivery(delivery);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Test Controls */}
        <Card className="mb-8 border-2 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧪 Test Card Preview Mode
              <Badge variant="secondary">Mock Data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This page uses mock card data to test the card preview, delivery selection, and payment flow without going through onboarding.
              </p>
              
              <div className="flex gap-4">
                <Button
                  onClick={() => handleDeliveryChange('printed')}
                  variant={deliveryType === 'printed' ? 'default' : 'outline'}
                  size="sm"
                >
                  Test Printed Cards (R129)
                </Button>
                <Button
                  onClick={() => handleDeliveryChange('digital')}
                  variant={deliveryType === 'digital' ? 'default' : 'outline'}
                  size="sm"
                >
                  Test Digital Cards (R29)
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-white rounded border">
                  <strong>Mock Card ID:</strong> {mockCard.id}<br/>
                  <strong>Price:</strong> R{(mockCard.price / 100).toFixed(2)}<br/>
                  <strong>Status:</strong> {mockCard.status}
                </div>
                <div className="p-3 bg-white rounded border">
                  <strong>Customer:</strong> {mockOnboarding.answers.name}<br/>
                  <strong>Celebration:</strong> {mockOnboarding.answers.celebration}<br/>
                  <strong>Art Style:</strong> {mockOnboarding.answers.art_style}
                </div>
                <div className="p-3 bg-white rounded border">
                  <strong>Front Text:</strong> {mockOnboarding.answers.message}<br/>
                  <strong>Inside Text:</strong> {mockOnboarding.answers.inside_message?.substring(0, 30)}...
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Preview Component */}
        <CardPreview 
          card={{
            ...mockCard,
            price: deliveryType === 'digital' ? 2900 : 12900 // Update price based on delivery type
          }} 
          onboarding={{
            ...mockOnboarding,
            selectedDelivery: deliveryType
          }} 
        />

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Button
            onClick={() => setLocation('/')}
            variant="outline"
            className="mr-4"
          >
            ← Back to Home
          </Button>
          <Button
            onClick={() => setLocation('/test')}
            variant="outline"
          >
            Other Tests →
          </Button>
        </div>
      </main>
    </div>
  );
}
