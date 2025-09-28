import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/header';
import { Heart, ArrowLeft, MapPin, User, CreditCard, Mail } from 'lucide-react';

interface CompleteOrderProps {
  params: {
    cardId: string;
  };
}

export default function CompleteOrder({ params }: CompleteOrderProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const deliveryType = urlParams.get('type') || 'digital';
  const isRecovery = urlParams.get('recovery') === 'true';
  
  // Get cardId from either path params (normal flow) or query params (recovery flow)
  const cardId = params?.cardId || urlParams.get('cardId');

  // Card data
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data with instant initialization from cache
  const [customerName, setCustomerName] = useState(() => {
    // Try to get user name from cache immediately
    const cachedKeys = ['cardPreviewData', `card_${cardId}`, `ready_${cardId}`];
    for (const key of cachedKeys) {
      try {
        const cachedData = sessionStorage.getItem(key);
        if (cachedData) {
          const cardData = JSON.parse(cachedData);
          const card = cardData.card || cardData;
          if (card?.conversationData) {
            // Check for various name field formats
            const userName = card.conversationData.name || 
                           card.conversationData.user_name || 
                           card.conversationData.recipient_name || 
                           card.conversationData.recipient || '';
            const userFirstName = card.conversationData.user_first_name || '';
            const userLastName = card.conversationData.user_last_name || '';
            
            if (userFirstName || userLastName) {
              const fullName = `${userFirstName} ${userLastName}`.trim();
              console.log('[INSTANT] User name loaded from cache:', fullName);
              return fullName;
            } else if (userName) {
              console.log('[INSTANT] User name loaded from cache:', userName);
              return userName;
            }
          }
        }
      } catch (e) {
        // Continue to next cache key
      }
    }
    return '';
  });

  const [customerEmail, setCustomerEmail] = useState(() => {
    // Try to get user email from cache immediately
    const cachedKeys = ['cardPreviewData', `card_${cardId}`, `ready_${cardId}`];
    for (const key of cachedKeys) {
      try {
        const cachedData = sessionStorage.getItem(key);
        if (cachedData) {
          const cardData = JSON.parse(cachedData);
          const card = cardData.card || cardData;
          if (card?.conversationData) {
            const userEmail = card.conversationData.email || card.conversationData.user_email || '';
            if (userEmail) {
              console.log('[INSTANT] User email loaded from cache:', userEmail);
              return userEmail;
            }
          }
        }
      } catch (e) {
        // Continue to next cache key
      }
    }
    return '';
  });

  const [customerEmailConfirm, setCustomerEmailConfirm] = useState(() => {
    // Auto-populate email confirmation with the same email from cache
    const cachedKeys = ['cardPreviewData', `card_${cardId}`, `ready_${cardId}`];
    for (const key of cachedKeys) {
      try {
        const cachedData = sessionStorage.getItem(key);
        if (cachedData) {
          const cardData = JSON.parse(cachedData);
          const card = cardData.card || cardData;
          if (card?.conversationData) {
            const userEmail = card.conversationData.email || card.conversationData.user_email || '';
            if (userEmail) {
              console.log('[INSTANT] Email confirmation auto-populated from cache:', userEmail);
              return userEmail;
            }
          }
        }
      } catch (e) {
        // Continue to next cache key
      }
    }
    return '';
  });

  // Pricing option state
  const [selectedPrice, setSelectedPrice] = useState<'testing' | 'full'>('full');

  // Address data for physical delivery
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    province: '',
    postalCode: ''
  });

  const provinces = [
    { value: 'EC', label: 'Eastern Cape' },
    { value: 'FS', label: 'Free State' },
    { value: 'GP', label: 'Gauteng' },
    { value: 'KZN', label: 'KwaZulu-Natal' },
    { value: 'LP', label: 'Limpopo' },
    { value: 'MP', label: 'Mpumalanga' },
    { value: 'NC', label: 'Northern Cape' },
    { value: 'NW', label: 'North West' },
    { value: 'WC', label: 'Western Cape' }
  ];

  // Current view for card display
  const [currentView, setCurrentView] = useState<'front' | 'inside'>('front');

  // Load card data
  useEffect(() => {
    if (cardId) {
      loadCard();
    }
  }, [cardId]);

  // Auto-sync email confirmation when email changes
  useEffect(() => {
    if (customerEmail && !customerEmailConfirm) {
      setCustomerEmailConfirm(customerEmail);
    }
  }, [customerEmail, customerEmailConfirm]);

  const loadCard = async () => {
    try {
      // INSTANT CACHE-FIRST LOADING - Check multiple cache keys for instant display
      const cachedKeys = [
        'cardPreviewData',
        `card_${cardId}`,
        `ready_${cardId}`,
        `card_celebrait_ready_${cardId}`
      ];
      
      for (const key of cachedKeys) {
        try {
          const cachedData = sessionStorage.getItem(key);
          if (cachedData) {
            const cardData = JSON.parse(cachedData);
            const card = cardData.card || cardData;
            if (card && (card.id || card.conversationData)) {
              setCard(card);
              setLoading(false);
              console.log(`[INSTANT] Complete order loaded from cache: ${key}`);
              return;
            }
          }
        } catch (e) {
          // Continue to next cache key
        }
      }

      // Handle test card ID
      if (cardId === '999') {
        const mockCard = {
          id: 999,
          frontImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
          insideImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
          cardType: deliveryType,
          printOption: deliveryType === 'printed' ? 'front-and-inside' : undefined,
          price: deliveryType === 'printed' ? 15000 : 500, // R150 for printed, R5 for digital
          status: 'completed',
          createdAt: new Date().toISOString()
        };
        setCard(mockCard);
        setLoading(false);
        return;
      }

      // Fallback to ultra-fast metadata endpoint
      console.log(`[PERF] Complete order making ultra-fast API call for card ${cardId}`);
      const apiStartTime = Date.now();
      
      const response = await fetch(`/api/cards/${cardId}/fast-metadata`, {
        headers: {
          'Cache-Control': 'max-age=86400', // Request 24-hour cache
        }
      });
      
      if (response.ok) {
        const cardData = await response.json();
        setCard({ ...cardData, cardType: deliveryType });
        
        const apiEndTime = Date.now();
        console.log(`[PERF] Complete order API response received in: ${apiEndTime - apiStartTime}ms`);
      }
      setLoading(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load card details',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (!customerName.trim() || !customerEmail.trim() || !customerEmailConfirm.trim()) return false;
    if (customerEmail !== customerEmailConfirm) return false;
    if (!address.line1.trim() || !address.city.trim() || !address.province || !address.postalCode.trim()) return false;
    return true;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      toast({
        title: 'Incomplete Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      // Handle digital card payment
      const customerInfo = {
        name: customerName,
        email: customerEmail,
        phone: ''
      };

      const deliveryInfo = {
        address: {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          country: 'ZA'
        }
      };

      const response = await fetch('/api/payfast/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.id,
          customerInfo,
          deliveryInfo,
          isDigital: false,
          amount: selectedPrice === 'full' ? 12900 : 500 // R129.00 or R5.00 in cents
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create payment');
      }

      const result = await response.json();
      
      // Redirect to Payfast payment for R5 digital card
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.paymentUrl;
      form.style.display = 'none';

      // Add all payment form fields
      Object.entries(result.paymentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      
    } catch (error) {
      toast({
        title: 'Payment Error',
        description: error instanceof Error ? error.message : 'Failed to process payment',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    // Scroll to top and add fade transition to content area only
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const contentArea = document.querySelector('.fade-transition-content');
    if (contentArea) {
      (contentArea as HTMLElement).style.opacity = '0.8';
    }
    
    setTimeout(() => {
      setLocation(`/card-preview/${cardId}`);
      setTimeout(() => {
        const newContentArea = document.querySelector('.fade-transition-content');
        if (newContentArea) {
          (newContentArea as HTMLElement).style.opacity = '1';
        }
      }, 100);
    }, 150);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading card details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      {/* Recovery Welcome Banner */}
      {isRecovery && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-3 text-center">
          <div className="max-w-4xl mx-auto flex items-center justify-center space-x-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              🎉 Great to see you back! Your card is ready for delivery - complete your order below!
            </span>
          </div>
        </div>
      )}
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-transition-content">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Card Preview
          </Button>
        </div>

        {/* Mobile/Tablet Layout (underneath) vs Desktop Layout (side by side) */}
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Order Form - Shows first on mobile/tablet, left on desktop */}
          <div className="space-y-6 order-1 lg:order-1">
            {/* Pricing Options - First */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  Choose Your Price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Pricing Options */}
                  <div className="space-y-3">
                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPrice === 'full' 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPrice('full')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedPrice === 'full' 
                              ? 'border-purple-500 bg-purple-500' 
                              : 'border-gray-300'
                          }`}>
                            {selectedPrice === 'full' && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">Full Price</h4>
                            <p className="text-sm text-gray-600">Physical card with delivery</p>
                          </div>
                        </div>
                        <span className="text-xl font-bold text-purple-600">R129.00</span>
                      </div>
                    </div>

                    <div 
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPrice === 'testing' 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPrice('testing')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedPrice === 'testing' 
                              ? 'border-purple-500 bg-purple-500' 
                              : 'border-gray-300'
                          }`}>
                            {selectedPrice === 'testing' && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">Testing Price</h4>
                            <p className="text-sm text-gray-600">Friends & family rate</p>
                          </div>
                        </div>
                        <span className="text-xl font-bold text-green-600">R5.00</span>
                      </div>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Physical Card (Printed & Delivered)</span>
                      <span className="font-semibold">{selectedPrice === 'full' ? 'R129.00' : 'R5.00'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-semibold text-green-600">Included</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total</span>
                        <span className={`text-lg font-bold ${selectedPrice === 'full' ? 'text-purple-600' : 'text-green-600'}`}>
                          {selectedPrice === 'full' ? 'R129.00' : 'R5.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  Your Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Your Name</Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Your Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmailConfirm">Confirm Email</Label>
                  <Input
                    id="customerEmailConfirm"
                    type="email"
                    value={customerEmailConfirm}
                    onChange={(e) => setCustomerEmailConfirm(e.target.value)}
                    placeholder="Re-enter your email address"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-500" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="line1">Street Address *</Label>
                  <Input
                    id="line1"
                    value={address.line1}
                    onChange={(e) => setAddress(prev => ({ ...prev, line1: e.target.value }))}
                    placeholder="Enter street address"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="line2">Apartment/Unit (Optional)</Label>
                  <Input
                    id="line2"
                    value={address.line2}
                    onChange={(e) => setAddress(prev => ({ ...prev, line2: e.target.value }))}
                    placeholder="Apartment, suite, unit, etc."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={address.city}
                      onChange={(e) => setAddress(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Enter city"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input
                      id="postalCode"
                      value={address.postalCode}
                      onChange={(e) => setAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="Enter postal code"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="province">Province *</Label>
                  <Select 
                    value={address.province} 
                    onValueChange={(value) => setAddress(prev => ({ ...prev, province: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((province) => (
                        <SelectItem key={province.value} value={province.value}>
                          {province.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  Your physical card will be printed and delivered to this address within 3-5 business days.
                </p>
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || submitting}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-4 rounded-lg font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              {submitting ? 'Processing...' : `Complete Order - ${selectedPrice === 'full' ? 'R129.00' : 'R5.00'}`}
            </Button>
          </div>

          {/* Card Preview - Shows underneath on mobile/tablet, right side on desktop */}
          <div className="space-y-6 order-2 lg:order-2 mt-8 lg:mt-0">
            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-pink-500" />
                  Your Card Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {card && (
                  <div className="space-y-4">
                    {/* Toggle buttons */}
                    <div className="flex justify-center space-x-2 bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setCurrentView('front')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                          currentView === 'front' 
                            ? 'bg-white text-gray-800 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Front Design
                      </button>
                      <button
                        onClick={() => setCurrentView('inside')}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                          currentView === 'inside' 
                            ? 'bg-white text-gray-800 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Inside Design
                      </button>
                    </div>

                    {/* Card image */}
                    <div className="w-full">
                      <img 
                        src={currentView === 'front' 
                          ? `/api/cards/${card.id}/fast-front-image` 
                          : `/api/cards/${card.id}/fast-inside-image`}
                        alt={`Card ${currentView} Design`}
                        className="w-full h-auto rounded-lg shadow-lg border border-gray-200"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}