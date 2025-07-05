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
  const [loading, setLoading] = useState(false);
  const [selectedDeliveryType, setSelectedDeliveryType] = useState<'digital' | 'printed' | null>(null);
  const [showRecipientChoice, setShowRecipientChoice] = useState(false);
  const isMobile = useIsMobile();
  
  // Get delivery type from URL parameters (for email links) or session storage
  const urlParams = new URLSearchParams(window.location.search);
  const urlDeliveryType = urlParams.get('type');
  const sessionDeliveryType = sessionStorage.getItem('selectedDeliveryType');
  const preselectedDeliveryType = urlDeliveryType || sessionDeliveryType || 'printed';
  
  // Set initial delivery type selection based on pre-selected value
  useEffect(() => {
    if (preselectedDeliveryType) {
      setSelectedDeliveryType(preselectedDeliveryType as 'digital' | 'printed');
    }
  }, [preselectedDeliveryType]);
  
  // Store delivery type in session storage for consistency
  if (urlDeliveryType && urlDeliveryType !== sessionDeliveryType) {
    sessionStorage.setItem('selectedDeliveryType', urlDeliveryType);
  }
  
  // Load card data
  useEffect(() => {
    const loadCardData = async () => {
      if (!reference) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/cards/${reference}/fast-metadata`);
        if (response.ok) {
          const data = await response.json();
          setCardData(data);
        }
      } catch (error) {
        console.error('Error loading card data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCardData();
  }, [reference]);
  
  // Get recipient name from card data for dynamic text
  const recipientName = cardData?.conversationData?.name || 
                       cardData?.conversationData?.recipient_name || 
                       sessionStorage.getItem('recipientName') || 
                       'the recipient';

  // Delivery type options to show user
  const deliveryOptions = [
    {
      id: 'digital',
      title: 'Digital Share',
      description: 'Instant download ready to share',
      price: 'Free',
      icon: Download,
      gradient: 'from-blue-500 to-purple-600',
      features: [
        'Instant digital download',
        'High-quality image files',
        'Share via email, social media',
        'Print at home if desired'
      ]
    },
    {
      id: 'printed',
      title: 'Printed & Delivered',
      description: 'High-quality print delivered to your door',
      price: '$12.99',
      icon: Truck,
      gradient: 'from-orange-500 to-red-500',
      features: [
        'Premium cardstock printing',
        'Professional finish',
        'Delivered to your door',
        'Ready-to-gift presentation'
      ]
    }
  ];

  // Recipient options based on selected delivery type
  const recipientOptions = selectedDeliveryType === 'digital' ? [
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
      gradient: 'from-purple-500 to-blue-500'
    },
    {
      id: 'recipient',
      title: `Send to ${recipientName} and me`,
      subtitle: `Email the digital card to both ${recipientName} and yourself`,
      icon: Heart,
      features: [
        `Direct email to ${recipientName}`,
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
      subtitle: `I'll give it to ${recipientName} myself`,
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
      title: `Deliver to ${recipientName}`,
      subtitle: `Send directly to ${recipientName}'s address`,
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
                  <Mail className="text-white w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  Confirm Delivery Method
                </h1>
                <p className="text-lg text-slate-gray">
                  You initially chose <span className="font-semibold text-purple-600">
                    {preselectedDeliveryType === 'digital' ? 'Digital Share' : 'Printed & Delivered'}
                  </span>. You can confirm this choice or change it after seeing your card quality.
                </p>
              </div>

              {/* Delivery Options */}
              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
                {deliveryOptions.map((option) => (
                  <Card 
                    key={option.id}
                    className={`cursor-pointer transition-all duration-300 hover:shadow-lg transform hover:scale-105 ${
                      selectedDeliveryType === option.id 
                        ? 'border-2 border-purple-500 bg-purple-50' 
                        : 'border-2 border-gray-200 bg-white/80'
                    }`}
                    onClick={() => handleDeliveryTypeChange(option.id as 'digital' | 'printed')}
                  >
                    <CardHeader className="text-center pb-4">
                      <div className={`w-16 h-16 bg-gradient-to-r ${option.gradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
                        <option.icon className="text-white w-8 h-8" />
                      </div>
                      <CardTitle className="text-xl">{option.title}</CardTitle>
                      <p className="text-sm text-gray-600 mt-2">{option.description}</p>
                      <p className="text-2xl font-bold text-gray-800 mt-2">{option.price}</p>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {option.features.map((feature, index) => (
                          <li key={index}>✓ {feature}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Proceed Button */}
              <div className="text-center">
                <Button
                  onClick={handleProceedToRecipient}
                  disabled={!selectedDeliveryType}
                  className="w-full max-w-md bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Continue with {selectedDeliveryType === 'digital' ? 'Digital Share' : 'Printed & Delivered'}
                </Button>
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
                    ? 'Confirm who should receive the digital card link' 
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
                    onClick={() => handleRecipientChoice(option.id as 'self' | 'recipient')}
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