
import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Truck, Download, Gift, ChevronLeft, ChevronRight } from "lucide-react";
import Header from "@/components/header";
import { emergencyStorageCleanup, apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";

export default function DeliveryChoice() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/delivery-choice/:reference");
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<'printed' | 'digital' | null>(null);
  const [currentOption, setCurrentOption] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const isMobile = useIsMobile();

  const options = [
    {
      id: 'printed',
      title: 'Printed & Delivered',
      price: 129,
      icon: Truck,
      features: [
        'High-quality printed card (5" x 5")',
        'Premium cardstock',
        'Delivered to recipient',
        'Perfect for special occasions'
      ],
      gradient: 'from-purple-500 to-blue-500',
      available: true
    },
    {
      id: 'digital',
      title: 'Digital Download',
      price: 1,
      icon: Download,
      features: [
        'Instant download',
        'High-resolution files',
        'Print at home or locally',
        'Share digitally'
      ],
      gradient: 'from-green-500 to-teal-500',
      available: true
    }
  ];

  useEffect(() => {
    // Load card data in background without blocking UI
    const loadCardData = async () => {
      if (!params?.reference) return;
      
      console.log('[DELIVERY] Loading card data in background for reference:', params.reference);
      const startTime = Date.now();
      
      try {
        // Check cache first
        const storageKeys = [
          'cardPreviewData',
          `card_${params.reference}`,
          `ready_${params.reference}`
        ];
        
        for (const key of storageKeys) {
          const storedData = sessionStorage.getItem(key);
          if (storedData) {
            try {
              const parsedData = JSON.parse(storedData);
              console.log(`[DELIVERY] Found cached data in ${key}`);
              setCardData(parsedData.card || parsedData);
              return;
            } catch (parseError) {
              console.warn(`Failed to parse stored data from ${key}`);
            }
          }
        }

        // Background API request - doesn't block UI
        let response;
        if (params.reference.startsWith('celebrait_ready_')) {
          response = await apiRequest('GET', `/api/cards/ready/${params.reference}`);
        } else {
          response = await apiRequest('GET', `/api/cards/${params.reference}`);
        }
        
        if (response.ok) {
          const data = await response.json();
          const cardData = data.card || data;
          
          // Use preloaded images if available
          if (cardData.frontImageBase64) {
            cardData.frontImageUrl = cardData.frontImageBase64;
          }
          if (cardData.insideImageBase64) {
            cardData.insideImageUrl = cardData.insideImageBase64;
          }
          
          // Cache for future use
          try {
            sessionStorage.setItem(`ready_${params.reference}`, JSON.stringify(data));
            sessionStorage.setItem('cardPreviewData', JSON.stringify(cardData));
          } catch (storageError) {
            console.warn('Failed to cache response:', storageError);
          }
          
          setCardData(cardData);
          const endTime = Date.now();
          console.log(`[DELIVERY] Background load completed in ${endTime - startTime}ms`);
        }
        
      } catch (error) {
        console.error('Background card data load failed:', error);
        // Set minimal fallback data
        setCardData({ 
          id: params.reference, 
          price: 12900,
          cardType: 'printed',
          frontImageUrl: null,
          insideImageUrl: null
        });
      }
    };

    if (match) {
      // Show delivery options immediately, load card data in background
      loadCardData();
    }
  }, [match, params?.reference]);

  const handleDeliverySelected = async (delivery: 'printed' | 'digital') => {
    setSelectedDelivery(delivery);
    
    // Store delivery type for both printed and digital cards
    sessionStorage.setItem('selectedDeliveryType', delivery);
    console.log('[DELIVERY CHOICE] Setting delivery type:', delivery);
    
    // Both delivery types now go to delivery details page to choose recipient
    setTimeout(() => {
      try {
        setLocation(`/delivery-details/${params?.reference}`);
      } catch (error) {
        console.error('Navigation failed:', error);
        window.location.href = `/delivery-details/${params?.reference}`;
      }
    }, 200);
  };

  const handleBack = () => {
    window.history.back();
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
                <Gift className="text-white w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Choose Your Delivery</h2>
              <p className="text-base text-slate-gray px-4">How would you like to receive your card?</p>
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
                        className={`${
                          option.available 
                            ? 'bg-white/80 border-2 border-purple-200 cursor-pointer' 
                            : 'bg-white/80 border-2 border-gray-300 cursor-not-allowed opacity-75'
                        } relative`}
                        onClick={() => option.available && handleDeliverySelected(option.id as 'printed' | 'digital')}
                      >
                        <CardHeader className="text-center pb-4">
                          <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
                            <option.icon className="text-white w-8 h-8" />
                          </div>
                          <CardTitle className="text-xl">{option.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                          <div className={`text-3xl font-bold mb-4 ${option.id === 'printed' ? 'text-purple-600' : 'text-green-600'}`}>
                            R{option.price}
                          </div>
                          <ul className="space-y-2 text-sm text-gray-600 mb-6">
                            {option.features.map((feature, featureIndex) => (
                              <li key={featureIndex}>✓ {feature}</li>
                            ))}
                          </ul>
                          <Button 
                            className={`w-full bg-gradient-to-r ${option.gradient} hover:opacity-90`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeliverySelected(option.id as 'printed' | 'digital');
                            }}
                          >
                            Choose {option.title}
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
              <Gift className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Choose Your Delivery Option</h1>
            <p className="text-lg text-slate-gray">How would you like to receive your card?</p>
          </div>

          {/* Delivery Options */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {options.map((option) => (
              <Card 
                key={option.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
                  selectedDelivery === option.id 
                    ? `border-2 ${option.id === 'printed' ? 'border-purple-500 bg-purple-50' : 'border-green-500 bg-green-50'}` 
                    : 'border-2 border-gray-200 bg-white/80'
                }`}
                onClick={() => handleDeliverySelected(option.id as 'printed' | 'digital')}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <option.icon className="text-white w-8 h-8" />
                  </div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <div className={`text-3xl font-bold mb-4 ${option.id === 'printed' ? 'text-purple-600' : 'text-green-600'}`}>
                    R{option.price}
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 mb-6">
                    {option.features.map((feature, index) => (
                      <li key={index}>✓ {feature}</li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full bg-gradient-to-r ${option.gradient} hover:opacity-90`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeliverySelected(option.id as 'printed' | 'digital');
                    }}
                  >
                    Choose {option.title}
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
