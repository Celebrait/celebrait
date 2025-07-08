import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Truck, Sparkles } from 'lucide-react';
import { emergencyStorageCleanup } from '@/lib/queryClient';

interface DeliveryChoiceProps {
  onDeliverySelected: (delivery: 'printed' | 'digital') => void;
}

export default function DeliveryChoice({ onDeliverySelected }: DeliveryChoiceProps) {
  const [selectedDelivery, setSelectedDelivery] = useState<'printed' | 'digital' | null>(null);

  const handleSelection = (delivery: 'printed' | 'digital') => {
    // Emergency storage cleanup before proceeding to prevent quota errors
    emergencyStorageCleanup();
    setSelectedDelivery(delivery);
    onDeliverySelected(delivery);
  };

  const options = [
    {
      id: 'digital',
      title: 'Digital Share',
      description: 'Instant download ready to share',
      price: 'R1.00',
      icon: Download,
      color: 'from-blue-500 to-purple-600',
      bgColor: 'bg-gradient-to-br from-blue-50 to-purple-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'printed',
      title: 'Printed & Delivered',
      description: 'High-quality print delivered to your door',
      price: 'R129.00',
      icon: Truck,
      color: 'from-orange-500 to-red-500',
      bgColor: 'bg-gradient-to-br from-orange-50 to-red-50',
      borderColor: 'border-orange-200'
    }
  ];

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-celebrait rounded-full mx-auto mb-4 flex items-center justify-center">
          <Sparkles className="text-white w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Choose Your Delivery</h2>
        <p className="text-base text-slate-gray">How would you like to receive your beautiful card?</p>
      </div>

      <div className="space-y-4">
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedDelivery === option.id;
          
          return (
            <Card 
              key={option.id}
              className={`cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                isSelected 
                  ? 'ring-2 ring-ethereal-purple shadow-lg' 
                  : 'hover:shadow-md'
              } ${option.bgColor} ${option.borderColor} border-2`}
              onClick={() => handleSelection(option.id as 'printed' | 'digital')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${option.color} flex items-center justify-center`}>
                      <Icon className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{option.title}</h3>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-800">{option.price}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedDelivery && (
        <div className="mt-6 text-center">
          <Button
            onClick={() => {
              // Store delivery type for the complete order page
              sessionStorage.setItem('selectedDeliveryType', selectedDelivery);
              
              // Get card ID from session storage or use test ID
              const cardData = sessionStorage.getItem('cardPreviewData');
              let cardId = '999'; // Default test ID
              
              if (cardData) {
                const parsed = JSON.parse(cardData);
                cardId = parsed.id?.toString() || '999';
              }
              
              // Redirect to complete order page
              window.location.href = `/complete-order/${cardId}`;
            }}
            className="w-full bg-gradient-celebrait hover:opacity-90 text-white py-3 rounded-2xl font-semibold shadow-lg transition-all duration-300"
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}