import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Truck, Download, Sparkles } from 'lucide-react';

interface DeliverySelectionProps {
  onDeliverySelected: (delivery: 'printed' | 'digital') => void;
}

export default function DeliverySelection({ onDeliverySelected }: DeliverySelectionProps) {

  const deliveryOptions = [
    {
      id: 'printed',
      title: 'Printed & Delivered',
      description: 'High-quality physical greeting card printed and delivered to your door or directly to the recipient',
      price: 'R129',
      icon: Truck,
      gradient: 'from-purple-500 to-pink-500',
      hoverGradient: 'from-purple-600 to-pink-600',
      borderColor: 'border-purple-200 hover:border-purple-400',
      priceColor: 'text-purple-600',
      features: [
        'Premium card stock',
        'Professional printing',
        'Fast delivery'
      ]
    },
    {
      id: 'digital',
      title: 'Digital Download',
      description: 'Instant digital card delivered via email with interactive viewing and download options',
      price: 'FREE',
      icon: Download,
      gradient: 'from-green-500 to-blue-500',
      hoverGradient: 'from-green-600 to-blue-600',
      borderColor: 'border-green-200 hover:border-green-400',
      priceColor: 'text-green-600',
      features: [
        'Instant delivery',
        'Interactive viewing',
        'High-res download'
      ]
    }
  ];



  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
          <Brain className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Choose Your Delivery Method
        </h1>
        <p className="text-lg text-slate-gray">
          Select how you'd like to receive your personalized card
        </p>
      </div>

      {/* Delivery Options */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {deliveryOptions.map((option) => (
          <Card 
            key={option.id}
            onClick={() => {
              // Scroll to top and add fade transition
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.body.style.opacity = '0.8';
              setTimeout(() => {
                onDeliverySelected(option.id as 'printed' | 'digital');
                setTimeout(() => {
                  document.body.style.opacity = '1';
                }, 100);
              }, 150);
            }}
            className={`cursor-pointer border-2 ${option.borderColor} transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm`}
          >
            <CardContent className="p-8 text-center space-y-4">
              <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full mx-auto flex items-center justify-center mb-4`}>
                <option.icon className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-gray-800">{option.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {option.description}
              </p>
              
              <div className="space-y-2">
                {option.features.map((feature, index) => (
                  <div key={index} className="flex items-center justify-center text-sm text-gray-500">
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className={`text-2xl font-bold ${option.priceColor} mt-4`}>
                {option.price}
              </div>
              
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  // Scroll to top and add fade transition
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  document.body.style.opacity = '0.8';
                  setTimeout(() => {
                    onDeliverySelected(option.id as 'printed' | 'digital');
                    setTimeout(() => {
                      document.body.style.opacity = '1';
                    }, 100);
                  }, 150);
                }}
                className={`w-full bg-gradient-to-r ${option.gradient} hover:${option.hoverGradient} text-white py-3 rounded-xl font-semibold`}
              >
                Choose {option.title.split(' ')[0]}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Green Information Boxes */}
      <div className="mt-8 space-y-4 max-w-2xl mx-auto">
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">
            <Sparkles className="w-4 h-4 inline mr-1" />
            You'll create and preview your card before purchasing. You can change your delivery method after seeing your card.
          </p>
        </div>
        
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">
            <Sparkles className="w-4 h-4 inline mr-1" />
            You'll create and preview your card before purchasing. You can change your delivery method after seeing your card.
          </p>
        </div>
      </div>
    </div>
  );
}