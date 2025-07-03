import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Heart, ArrowLeft, MapPin, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/header';
import { emergencyStorageCleanup } from '@/lib/queryClient';
import { useIsMobile } from '@/hooks/use-mobile';

export default function DeliveryDetails() {
  const { reference } = useParams();
  const [, setLocation] = useLocation();
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<'self' | 'recipient' | null>(null);
  const [currentOption, setCurrentOption] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const isMobile = useIsMobile();
  
  // Get delivery type from session storage
  const deliveryType = sessionStorage.getItem('selectedDeliveryType') || 'printed';
  const isDigital = deliveryType === 'digital';
  
  // Debug logging
  console.log('[DELIVERY DETAILS] Delivery type:', deliveryType);
  console.log('[DELIVERY DETAILS] Is digital:', isDigital);

  // Get recipient name from card data for dynamic text
  const recipientName = cardData?.conversationData?.name || 'the recipient';

  const options = isDigital ? [
    {
      id: 'self',
      title: 'Send to Me',
      subtitle: `I'll share the card with ${recipientName} myself`,
      icon: User,
      features: [
        'Digital card link sent to your email',
        'You control when to share it',
        'Perfect for timing the surprise',
        'Easy forwarding options'
      ],
      gradient: 'from-purple-500 to-blue-500',
      available: true
    },
    {
      id: 'recipient',
      title: `Send to ${recipientName}`,
      subtitle: `Email the digital card directly to ${recipientName}`,
      icon: Heart,
      features: [
        'Direct email to recipient',
        'Instant surprise delivery',
        'No coordination needed',
        'Professional presentation'
      ],
      gradient: 'from-pink-500 to-rose-500',
      available: true
    }
  ] : [
    {
      id: 'self',
      title: 'Deliver to Me',
      subtitle: `I'll give it to ${recipientName} myself`,
      icon: User,
      features: [
        'Card delivered to your address',
        'You handle the surprise moment',
        'Perfect for personal delivery',
        'Control the timing'
      ],
      gradient: 'from-purple-500 to-blue-500',
      available: true
    },
    {
      id: 'recipient',
      title: `Deliver to ${recipientName}`,
      subtitle: `Send directly to ${recipientName}'s address`,
      icon: Heart,
      features: [
        'Direct delivery to recipient',
        'Complete surprise delivery',
        'No coordination needed',
        'Professional presentation'
      ],
      gradient: 'from-pink-500 to-rose-500',
      available: true
    }
  ];

  useEffect(() => {
    loadCardData();
  }, [reference]);

  const loadCardData = async () => {
    try {
      emergencyStorageCleanup();
      
      // Try to get card data from session storage first
      const storedData = sessionStorage.getItem('cardPreviewData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setCardData(parsedData);
        setLoading(false);
        return;
      }

      // Fallback to API if no cached data
      if (reference) {
        const response = await fetch(`/api/cards/${reference}`);
        if (response.ok) {
          const data = await response.json();
          setCardData(data);
        }
      }
    } catch (error) {
      console.error('Error loading card data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryChoice = (deliverTo: 'self' | 'recipient') => {
    setSelectedOption(deliverTo);
    
    // Store delivery choice
    sessionStorage.setItem('deliverTo', deliverTo);
    
    // Navigate based on delivery type
    setTimeout(() => {
      try {
        if (isDigital) {
          // Digital cards go to complete-order to collect email details
          setLocation(`/complete-order/${reference}`);
        } else {
          // Printed cards go to payment page to collect address and payment
          setLocation(`/payment/${reference}`);
        }
      } catch (error) {
        console.error('Navigation failed:', error);
        if (isDigital) {
          window.location.href = `/complete-order/${reference}`;
        } else {
          window.location.href = `/payment/${reference}`;
        }
      }
    }, 200);
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentOption < options.length - 1) {
      setCurrentOption(currentOption + 1);
    }
    if (isRightSwipe && currentOption > 0) {
      setCurrentOption(currentOption - 1);
    }
  };

  const nextOption = () => {
    if (currentOption < options.length - 1) {
      setCurrentOption(currentOption + 1);
    }
  };

  const prevOption = () => {
    if (currentOption > 0) {
      setCurrentOption(currentOption - 1);
    }
  };

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading delivery options...</p>
          </div>
        </main>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
            {/* Back Button */}
            <Button 
              onClick={handleBack} 
              variant="ghost" 
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {/* Header Section */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center animate-float">
                {isDigital ? <Mail className="text-white w-8 h-8" /> : <MapPin className="text-white w-8 h-8" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {isDigital ? 'Email Details' : 'Delivery Details'}
              </h2>
              <div className="mb-2">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  isDigital ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                }`}>
                  {isDigital ? 'Digital Download' : 'Printed & Delivered'}
                </span>
              </div>
              <p className="text-base text-slate-gray px-4">
                {isDigital 
                  ? 'Who should receive the digital card link?' 
                  : 'Where should we deliver your printed card?'
                }
              </p>
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center mb-4 space-x-2">
              {options.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentOption(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    index === currentOption 
                      ? 'bg-purple-600 scale-125' 
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Swipeable Options */}
            <div className="relative overflow-hidden">
              <div 
                className="overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div 
                  className="flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${currentOption * 100}%)` }}
                >
                  {options.map((option, index) => (
                    <div key={option.id} className="w-full flex-shrink-0 px-4">
                      <Card 
                        className="bg-white/80 border-2 border-purple-200 cursor-pointer relative"
                        onClick={() => handleDeliveryChoice(option.id as 'self' | 'recipient')}
                      >
                        <CardHeader className="text-center pb-4">
                          <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
                            <option.icon className="text-white w-8 h-8" />
                          </div>
                          <CardTitle className="text-xl">{option.title}</CardTitle>
                          <p className="text-sm text-gray-600 mt-2">{option.subtitle}</p>
                        </CardHeader>
                        <CardContent className="text-center">
                          <ul className="space-y-2 text-sm text-gray-600 mb-6">
                            {option.features.map((feature, featureIndex) => (
                              <li key={featureIndex}>✓ {feature}</li>
                            ))}
                          </ul>
                          <Button 
                            className={`w-full bg-gradient-to-r ${option.gradient} hover:opacity-90`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeliveryChoice(option.id as 'self' | 'recipient');
                            }}
                          >
                            Choose This Option
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={prevOption}
                disabled={currentOption === 0}
                className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full shadow-lg transition-all duration-200 ${
                  currentOption === 0
                    ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-purple-600 hover:bg-purple-50 hover:scale-110'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextOption}
                disabled={currentOption === options.length - 1}
                className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-2 rounded-full shadow-lg transition-all duration-200 ${
                  currentOption === options.length - 1
                    ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-purple-600 hover:bg-purple-50 hover:scale-110'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20">
          {/* Back Button */}
          <Button 
            onClick={handleBack} 
            variant="ghost" 
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
              {isDigital ? <Mail className="text-white w-10 h-10" /> : <MapPin className="text-white w-10 h-10" />}
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {isDigital ? 'Email Details' : 'Delivery Details'}
            </h1>
            <p className="text-lg text-slate-gray">
              {isDigital 
                ? 'Who should receive the digital card link?' 
                : 'Where should we deliver your printed card?'
              }
            </p>
          </div>

          {/* Delivery Options */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {options.map((option) => (
              <Card 
                key={option.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
                  selectedOption === option.id 
                    ? `border-2 ${option.id === 'self' ? 'border-purple-500 bg-purple-50' : 'border-pink-500 bg-pink-50'}` 
                    : 'border-2 border-gray-200 bg-white/80'
                }`}
                onClick={() => handleDeliveryChoice(option.id as 'self' | 'recipient')}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <option.icon className="text-white w-8 h-8" />
                  </div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                  <p className="text-sm text-gray-600 mt-2">{option.subtitle}</p>
                </CardHeader>
                <CardContent className="text-center">
                  <ul className="space-y-2 text-sm text-gray-600 mb-6">
                    {option.features.map((feature, featureIndex) => (
                      <li key={featureIndex}>✓ {feature}</li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full bg-gradient-to-r ${option.gradient} hover:opacity-90`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeliveryChoice(option.id as 'self' | 'recipient');
                    }}
                  >
                    Choose This Option
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}