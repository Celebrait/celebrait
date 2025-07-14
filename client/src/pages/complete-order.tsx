import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/header';
import { Heart, ArrowLeft, Mail, User, CreditCard } from 'lucide-react';

interface CompleteOrderProps {
  params: {
    cardId: string;
  };
}

export default function CompleteOrder({ params }: CompleteOrderProps) {
  const { cardId } = params;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const deliveryType = urlParams.get('type') || 'digital';

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
            const userFirstName = card.conversationData.user_first_name || '';
            const userLastName = card.conversationData.user_last_name || '';
            const userName = card.conversationData.user_name || '';
            
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

  // Recipient data
  const [sendToRecipient, setSendToRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState(() => {
    // Try to get recipient name from cache immediately
    const cachedKeys = ['cardPreviewData', `card_${cardId}`, `ready_${cardId}`];
    for (const key of cachedKeys) {
      try {
        const cachedData = sessionStorage.getItem(key);
        if (cachedData) {
          const cardData = JSON.parse(cachedData);
          const card = cardData.card || cardData;
          if (card?.conversationData) {
            const name = card.conversationData.name || 
                        card.conversationData.recipient_name ||
                        card.conversationData.recipientName;
            if (name && name !== 'the recipient') {
              console.log('[INSTANT] Recipient name loaded from cache:', name);
              return name;
            }
          }
        }
      } catch (e) {
        // Continue to next cache key
      }
    }
    return '';
  });
  const [recipientEmail, setRecipientEmail] = useState('');

  // Current view for card display
  const [currentView, setCurrentView] = useState<'front' | 'inside'>('front');

  // Load card data
  useEffect(() => {
    if (cardId) {
      loadCard();
    }
  }, [cardId]);

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
    if (!customerName.trim() || !customerEmail.trim()) return false;
    if (sendToRecipient && (!recipientName.trim() || !recipientEmail.trim())) return false;
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
          line1: 'Digital Delivery',
          line2: '',
          city: 'Digital',
          province: 'Digital',
          postalCode: '0000'
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
          isDigital: true,
          recipientInfo: sendToRecipient ? {
            name: recipientName,
            email: recipientEmail
          } : null
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
    setLocation(`/card-preview/${cardId}`);
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
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Card Preview */}
          <div className="space-y-6">
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

            {/* Order Summary */}
            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-500" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Digital Card</span>
                    <span className="font-semibold">R5.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Delivery</span>
                    <span className="font-semibold text-green-600">Free</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-lg font-bold text-green-600">R5.00</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Order Form */}
          <div className="space-y-6">
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
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-500" />
                  Delivery Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="sendToRecipient"
                    checked={sendToRecipient}
                    onCheckedChange={(checked) => setSendToRecipient(checked as boolean)}
                  />
                  <Label htmlFor="sendToRecipient" className="text-sm font-medium">
                    Also send this card to {recipientName || 'the recipient'}
                  </Label>
                </div>
                
                {sendToRecipient && (
                  <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div>
                      <Label htmlFor="recipientName">Recipient's Name</Label>
                      <Input
                        id="recipientName"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Enter recipient's name"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientEmail">Recipient's Email</Label>
                      <Input
                        id="recipientEmail"
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="Enter recipient's email"
                        required
                      />
                    </div>
                    <p className="text-sm text-purple-700 bg-purple-100 p-2 rounded">
                      The recipient will receive a personalized email with their digital card. 
                      You'll also receive a copy for your records.
                    </p>
                  </div>
                )}
                
                {!sendToRecipient && (
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    You'll receive the digital card via email and can share it with anyone you'd like.
                  </p>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || submitting}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-4 rounded-lg font-semibold text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              {submitting ? 'Processing...' : `Complete Order - R5.00`}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}