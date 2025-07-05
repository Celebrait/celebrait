import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Download, Mail, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface DeliverySelectionProps {
  onDeliverySelected: (delivery: 'printed' | 'digital') => void;
}

export default function DeliverySelection({ onDeliverySelected }: DeliverySelectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isMobile = useIsMobile();

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

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % deliveryOptions.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + deliveryOptions.length) % deliveryOptions.length);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
          <Mail className="text-white w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Choose Your Delivery Method
        </h1>
        <p className="text-lg text-slate-gray">
          Select how you'd like to receive your personalized card
        </p>
      </div>

      {/* Delivery Options */}
      {isMobile ? (
        <div className="relative max-w-sm mx-auto">
          {/* Mobile Swipeable Cards */}
          <div className="overflow-hidden">
            <div 
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {deliveryOptions.map((option) => (
                <div key={option.id} className="w-full flex-shrink-0 px-4">
                  <Card 
                    onClick={() => onDeliverySelected(option.id as 'printed' | 'digital')}
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
                          onDeliverySelected(option.id as 'printed' | 'digital');
                        }}
                        className={`w-full bg-gradient-to-r ${option.gradient} hover:${option.hoverGradient} text-white py-3 rounded-xl font-semibold`}
                      >
                        Choose {option.title.split(' ')[0]}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-all duration-200"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-all duration-200"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-6 space-x-2">
            {deliveryOptions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentSlide 
                    ? 'bg-purple-500' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Swipe Instruction */}
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              Swipe to see both options →
            </p>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {deliveryOptions.map((option) => (
            <Card 
              key={option.id}
              onClick={() => onDeliverySelected(option.id as 'printed' | 'digital')}
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
                    onDeliverySelected(option.id as 'printed' | 'digital');
                  }}
                  className={`w-full bg-gradient-to-r ${option.gradient} hover:${option.hoverGradient} text-white py-3 rounded-xl font-semibold`}
                >
                  Choose {option.title.split(' ')[0]}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Blue Information Box */}
      <div className="mt-8 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
        <p className="text-blue-800 text-sm">
          <Sparkles className="w-4 h-4 inline mr-1" />
          You'll create and preview your card before purchasing. You can change your delivery method after seeing your card.
        </p>
      </div>
    </div>
  );
}