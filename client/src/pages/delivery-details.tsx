import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Heart, ArrowLeft, MapPin, Mail, Truck, Download } from 'lucide-react';
import Header from '@/components/header';
import { emergencyStorageCleanup } from '@/lib/queryClient';
import { useIsMobile } from '@/hooks/use-mobile';

export default function DeliveryDetails() {
  const { reference } = useParams();
  const [, setLocation] = useLocation();
  const [cardData, setCardData] = useState<any>(null);
  const [loading, setLoading] = useState(false); // Start with false for instant display
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'printed'>('printed');
  const [showRecipientChoice, setShowRecipientChoice] = useState(false);
  const isMobile = useIsMobile();
  
  // Always use printed cards - simplified for printed-only focus
  const preselectedDeliveryType = 'printed';
  
  // Set initial state for printed cards only
  useEffect(() => {
    setSelectedDeliveryType('printed');
    sessionStorage.setItem('selectedDeliveryType', 'printed');
    // For printed cards, show recipient choice immediately
    setShowRecipientChoice(true);
  }, []);
  
  // Always store printed as delivery type
  sessionStorage.setItem('selectedDeliveryType', 'printed');
  
  // Get recipient name from card data for dynamic text (with immediate initialization)
  const [recipientName, setRecipientName] = useState(() => {
    // Try immediate initialization from session storage
    if (typeof window !== 'undefined') {
      const sessionName = sessionStorage.getItem('recipientName');
      if (sessionName && sessionName !== 'the recipient') {
        console.log('[RECIPIENT] Initialized from session storage:', sessionName);
        return sessionName;
      }
      
      // Try immediate initialization from cached data
      try {
        const cachedKeys = [`cardPreviewData`, `ready_${reference}`, `card_${reference}`];
        for (const key of cachedKeys) {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const parsedData = JSON.parse(cached);
            const card = parsedData.card || parsedData;
            let extractedName = null;
            if (card?.conversationData) {
              extractedName = card.conversationData.name || 
                           card.conversationData.recipient_name ||
                           card.conversationData.recipientName;
            }
            if (extractedName && extractedName !== 'the recipient') {
              console.log('[RECIPIENT] Initialized from cached data:', extractedName);
              sessionStorage.setItem('recipientName', extractedName);
              return extractedName;
            }
          }
        }
      } catch (e) {
        // Continue to fallback
      }
    }
    
    console.log('[RECIPIENT] No cached name found - defaulting to "the recipient"');
    return 'the recipient';
  });

  // Load card data with instant cache-first strategy
  useEffect(() => {
    const loadCardData = async () => {
      if (!reference) return;
      
      // Try to load from cache first for instant display
      const cachedKeys = [
        `cardPreviewData`,
        `ready_${reference}`,
        `card_${reference}`,
        `card_${reference.replace('celebrait_ready_', '')}`
      ];
      
      let cachedData = null;
      for (const key of cachedKeys) {
        try {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const parsedData = JSON.parse(cached);
            const card = parsedData.card || parsedData;
            if (card && (card.id || card.conversationData)) {
              cachedData = card;
              console.log(`[INSTANT] Loaded from cache: ${key}`);
              
              // Extract recipient name from cached data and set it immediately
              let extractedRecipientName = null;
              if (card?.conversationData) {
                extractedRecipientName = card.conversationData.name || 
                                      card.conversationData.recipient_name ||
                                      card.conversationData.recipientName;
              }
              
              if (extractedRecipientName && extractedRecipientName !== 'the recipient') {
                sessionStorage.setItem('recipientName', extractedRecipientName);
                setRecipientName(extractedRecipientName);
                console.log('[RECIPIENT] Updated from cache data:', extractedRecipientName);
              }
              break;
            }
          }
        } catch (e) {
          // Continue to next cache key
        }
      }
      
      if (cachedData) {
        setCardData(cachedData);
        setLoading(false);
        console.log('[INSTANT] Delivery options displayed immediately from cache');
        return;
      }
      
      // Fallback to ultra-fast metadata endpoint if no cache available - NO LOADING SPINNER
      console.log(`[PERF] Making ultra-fast API call for ${reference?.startsWith('celebrait_ready_') ? 'ready' : 'metadata'} endpoint`);
      const apiStartTime = Date.now();
      
      try {
        // Use fast metadata endpoint for instant loading
        const endpoint = reference?.startsWith('celebrait_ready_') 
          ? `/api/cards/ready/${reference}`
          : `/api/cards/${reference}/fast-metadata`;
        
        const response = await fetch(endpoint, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch card: ${response.status}`);
        }
        
        const data = await response.json();
        const card = data.card || data;
        
        const apiEndTime = Date.now();
        console.log(`[PERF] API response received in: ${apiEndTime - apiStartTime}ms`);
        
        // Extract recipient name from API response
        let extractedRecipientName = null;
        if (card?.conversationData) {
          extractedRecipientName = card.conversationData.name || 
                                card.conversationData.recipient_name ||
                                card.conversationData.recipientName;
        }
        
        if (extractedRecipientName && extractedRecipientName !== 'the recipient') {
          sessionStorage.setItem('recipientName', extractedRecipientName);
          setRecipientName(extractedRecipientName);
          console.log('[RECIPIENT] Stored from API response:', extractedRecipientName);
        }
        
        setCardData(card);
        setLoading(false);
        
        // Cache the response for future instant loading
        try {
          sessionStorage.setItem(`card_${reference}`, JSON.stringify(card));
        } catch (e) {
          console.warn('Cache storage failed:', e);
        }
        
      } catch (error) {
        console.error('Error loading card data:', error);
      }
    };
    
    loadCardData();
  }, [reference]);
  
  // Update recipient name when card data loads
  useEffect(() => {
    if (cardData?.conversationData) {
      const name = cardData.conversationData.name || cardData.conversationData.recipient_name;
      if (name && name !== recipientName) {
        console.log('[RECIPIENT] Updating from card data:', name);
        setRecipientName(name);
        // Also store in session storage for future use
        sessionStorage.setItem('recipientName', name);
      }
    }
  }, [cardData, recipientName]);

  // Delivery type options to show user (matching original design)
  const deliveryOptions = [
    {
      id: 'printed',
      title: 'Printed & Delivered',
      description: 'High-quality physical greeting card printed and delivered to your door or directly to the recipient',
      price: 'Coming Soon',
      icon: Truck,
      gradient: 'from-gray-400 to-gray-500',
      hoverGradient: 'from-gray-500 to-gray-600',
      borderColor: 'border-gray-200',
      priceColor: 'text-gray-500',
      features: [
        'Premium card stock',
        'Professional printing', 
        'Fast delivery'
      ],
      disabled: true
    },
    {
      id: 'digital',
      title: 'Digital Download',
      description: 'Instant digital card delivered via email with interactive viewing and download options',
      price: 'R5.00',
      icon: Download,
      gradient: 'from-green-500 to-blue-500',
      hoverGradient: 'from-green-600 to-blue-600',
      borderColor: 'border-green-200 hover:border-green-400',
      priceColor: 'text-green-600',
      features: [
        'Instant delivery',
        'Interactive viewing',
        'High-res download'
      ],
      disabled: false
    }
  ];

  // Recipient options based on selected delivery type
  const recipientOptions = selectedDeliveryType === 'digital' ? [
    {
      id: 'self',
      title: 'Send to Me',
      subtitle: `I'll share the card with ${recipientName || 'the recipient'} myself`,
      icon: User,
      features: [
        'Digital card link sent to your email',
        'You control when to share it',
        'Perfect for timing the surprise',
        'Easy forwarding options'
      ],
      gradient: 'from-purple-500 to-blue-500'
    },
    {
      id: 'recipient',
      title: `Send to ${recipientName || 'the recipient'} and me`,
      subtitle: `Email the digital card to both ${recipientName || 'the recipient'} and yourself`,
      icon: Heart,
      features: [
        `Direct email to ${recipientName || 'the recipient'}`,
        'You also receive a copy',
        'Instant surprise delivery',
        'No coordination needed'
      ],
      gradient: 'from-pink-500 to-rose-500'
    }
  ] : [
    {
      id: 'self',
      title: 'Deliver to Me',
      subtitle: `I'll give it to ${recipientName || 'the recipient'} myself`,
      icon: User,
      features: [
        'Card delivered to your address',
        'You handle the surprise moment',
        'Perfect for personal delivery',
        'Control the timing'
      ],
      gradient: 'from-purple-500 to-blue-500'
    },
    {
      id: 'recipient',
      title: `Deliver to ${recipientName || 'the recipient'}`,
      subtitle: `Send directly to ${recipientName || 'the recipient'}'s address`,
      icon: Heart,
      features: [
        'Direct delivery to recipient',
        'Complete surprise delivery',
        'No coordination needed',
        'Professional presentation'
      ],
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  // Handle delivery type selection
  const handleDeliveryTypeChange = (type: 'digital' | 'printed') => {
    setSelectedDeliveryType(type);
    sessionStorage.setItem('selectedDeliveryType', type);
  };

  // Handle proceeding to recipient selection
  const handleProceedToRecipient = () => {
    if (selectedDeliveryType) {
      setShowRecipientChoice(true);
    }
  };

  // Handle recipient choice
  const handleRecipientChoice = (choice: 'self' | 'recipient') => {
    // Emergency storage cleanup before proceeding
    emergencyStorageCleanup();
    
    // Store choice in session storage
    sessionStorage.setItem('selectedDeliveryOption', choice);
    
    // Navigate to appropriate page based on delivery type
    setTimeout(() => {
      if (selectedDeliveryType === 'digital') {
        setLocation(`/complete-order/${reference}?delivery=${choice}`);
      } else {
        setLocation(`/payment/${reference}?delivery=${choice}`);
      }
    }, 200);
  };

  const handleBack = () => {
    if (showRecipientChoice) {
      setShowRecipientChoice(false);
    } else {
      window.history.back();
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

          {!showRecipientChoice ? (
            // Delivery Type Selection
            <>
              {/* Header Section */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
                  <Truck className="text-white w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  Confirm Delivery Method
                </h1>
                <p className="text-lg text-slate-gray">
                  Choose how you'd like to receive your personalized card
                </p>
              </div>

              {/* Delivery Options */}
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
                {deliveryOptions.map((option) => (
                  <Card 
                    key={option.id}
                    onClick={() => {
                      if (option.disabled) return;
                      // Scroll to top and add fade transition
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      document.body.style.opacity = '0.8';
                      
                      handleDeliveryTypeChange(option.id as 'digital' | 'printed');
                      setTimeout(() => {
                        handleProceedToRecipient();
                        setTimeout(() => {
                          document.body.style.opacity = '1';
                        }, 100);
                      }, 150);
                    }}
                    className={`${option.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-xl hover:scale-105'} border-2 ${option.borderColor} transition-all duration-300 bg-white/80 backdrop-blur-sm`}
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
                          if (option.disabled) return;
                          // Scroll to top and add fade transition
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          document.body.style.opacity = '0.8';
                          
                          handleDeliveryTypeChange(option.id as 'digital' | 'printed');
                          setTimeout(() => {
                            handleProceedToRecipient();
                            setTimeout(() => {
                              document.body.style.opacity = '1';
                            }, 100);
                          }, 150);
                        }}
                        disabled={option.disabled}
                        className={`w-full bg-gradient-to-r ${option.gradient} hover:${option.hoverGradient} text-white py-3 rounded-xl font-semibold ${option.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {option.disabled ? 'Coming Soon' : `Choose ${option.title}`}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>


            </>
          ) : (
            // Recipient Selection
            <>
              {/* Header Section */}
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
                  {selectedDeliveryType === 'digital' ? <Mail className="text-white w-10 h-10" /> : <MapPin className="text-white w-10 h-10" />}
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  {selectedDeliveryType === 'digital' ? 'Confirm Email Details' : 'Confirm Delivery Details'}
                </h1>
                <p className="text-lg text-slate-gray">
                  {selectedDeliveryType === 'digital' 
                    ? `Confirm who should receive ${recipientName || 'the recipient'}'s digital card link` 
                    : 'Confirm where we should deliver your printed card'
                  }
                </p>
              </div>

              {/* Recipient Options */}
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {recipientOptions.map((option) => (
                  <Card 
                    key={option.id}
                    className="cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 border-2 border-gray-200 bg-white/80"
                    onClick={() => {
                      // Scroll to top and add fade transition
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      document.body.style.opacity = '0.8';
                      
                      setTimeout(() => {
                        handleRecipientChoice(option.id as 'self' | 'recipient');
                        setTimeout(() => {
                          document.body.style.opacity = '1';
                        }, 100);
                      }, 150);
                    }}
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
                        {option.features.map((feature, index) => (
                          <li key={index}>✓ {feature}</li>
                        ))}
                      </ul>
                      <Button 
                        className={`w-full bg-gradient-to-r ${option.gradient} hover:opacity-90`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecipientChoice(option.id as 'self' | 'recipient');
                        }}
                      >
                        Choose This Option
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}