
import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  ArrowLeft, 
  Truck, 
  Mail, 
  MapPin, 
  User, 
  MessageSquare,
  Gift,
  Download
} from 'lucide-react';
import Header from '@/components/header';

interface Address {
  line1: string;
  line2: string;
  city: string;
  province: string;
  postalCode: string;
}

export default function CompleteOrder() {
  const [, setLocation] = useLocation();
  const { cardId } = useParams();
  const { toast } = useToast();
  
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form data
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'self' | 'recipient'>('self');
  const [customMessage, setCustomMessage] = useState('');
  
  // Address for printed cards
  const [address, setAddress] = useState<Address>({
    line1: '',
    line2: '',
    city: '',
    province: '',
    postalCode: ''
  });

  // Get delivery type from session storage
  const deliveryType = sessionStorage.getItem('selectedDeliveryType') as 'printed' | 'digital' || 'digital';
  
  // Get delivery method (who to deliver to) from session storage
  const deliverTo = sessionStorage.getItem('deliverTo') as 'self' | 'recipient' || 'self';
  
  // Get recipient name from card data for dynamic text
  const recipientName = card?.conversationData?.name || 'the recipient';

  useEffect(() => {
    if (cardId) {
      loadCard();
    }
  }, [cardId]);

  const loadCard = async () => {
    try {
      // Check for cached card data first
      const cachedCardData = sessionStorage.getItem('cardPreviewData');
      if (cachedCardData) {
        const cardData = JSON.parse(cachedCardData);
        setCard(cardData);
        setLoading(false);
        return;
      }

      // Handle test card ID
      if (cardId === '999') {
        const mockCard = {
          id: 999,
          frontImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
          insideImageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=600&fit=crop',
          cardType: deliveryType,
          printOption: deliveryType === 'printed' ? 'front-and-inside' : undefined,
          price: deliveryType === 'printed' ? 15000 : 0, // R150 for printed, free for digital
          status: 'completed',
          createdAt: new Date().toISOString()
        };
        setCard(mockCard);
        setLoading(false);
        return;
      }

      // Fallback to API fetch
      const response = await apiRequest('GET', `/api/cards/${cardId}`);
      const cardData = await response.json();
      setCard({ ...cardData, cardType: deliveryType });
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
    
    if (deliveryType === 'digital') {
      if (deliverTo === 'recipient' && !recipientEmail.trim()) return false;
    } else {
      // Printed cards need address
      if (!address.line1.trim() || !address.city.trim() || 
          !address.province.trim() || !address.postalCode.trim()) return false;
    }
    
    return true;
  };

  const generateCustomLink = () => {
    const linkId = Math.random().toString(36).substring(2, 15);
    return `${window.location.origin}/card/${linkId}`;
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
      if (deliveryType === 'digital') {
        // Handle digital card delivery
        const orderData = {
          cardId: card.id,
          customerInfo: {
            email: customerEmail, // Always include user's email
            firstName: customerName.split(' ')[0] || customerName,
            lastName: customerName.split(' ').slice(1).join(' ') || '',
            phone: '',
            address: null,
            // Include recipient details if sending to recipient
            ...(deliverTo === 'recipient' && {
              recipientEmail: recipientEmail,
              recipientName: recipientName
            })
          },
          paymentType: 'free'
        };

        // Create free digital order
        const response = await apiRequest('POST', '/api/create-free-order', orderData);
        const result = await response.json();
        
        console.log('Digital order API response:', result);
        
        if (!result.reference || !result.orderId) {
          throw new Error('Invalid response from server - missing order details');
        }
        
        toast({
          title: 'Digital Card Sent!',
          description: deliverTo === 'recipient' 
            ? `Your card has been delivered to both ${recipientName} and you`
            : `Your card has been delivered to ${customerEmail}`,
        });

        // Redirect to success page with order reference
        const successEmail = deliverTo === 'recipient' 
          ? `${recipientName} and you`
          : customerEmail;
        setLocation(`/order-success?type=digital&email=${encodeURIComponent(successEmail)}&reference=${result.reference}&orderId=${result.orderId}`);
        
      } else {
        // Handle printed card - redirect to payment
        const orderData = {
          cardId: card.id,
          customerName,
          customerEmail,
          deliveryType: 'printed',
          shippingAddress: address,
          amount: card.price
        };

        sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));
        setLocation(`/payment-tips/${cardId}`);
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process your order. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading order details...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20">
          <Button 
            onClick={() => window.history.back()} 
            variant="ghost" 
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-float">
              <User className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {deliverTo === 'recipient' 
                ? `${recipientName}'s Information`
                : 'Your Information'
              }
            </h1>
            <p className="text-lg text-slate-gray">
              {deliveryType === 'digital' 
                ? (deliverTo === 'recipient' 
                    ? `Enter details to send the digital card to ${recipientName}` 
                    : 'Enter details to send your digital card')
                : (deliverTo === 'recipient' 
                    ? `Enter ${recipientName}'s details and address for delivery` 
                    : 'Enter your details and shipping address')
              }
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Card Preview */}
            <Card className="lg:col-span-1 bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Your Card
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-4">
              {/* Front and Inside Images */}
              <div className="space-y-4">
                {card?.frontImageUrl && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Front of Card</p>
                    <div className="aspect-square w-full max-w-64 mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                      <img 
                        src={`/api/cards/${card.id}/front-image`} 
                        alt="Card front preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                
                {card?.insideImageUrl && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Inside of Card</p>
                    <div className="aspect-square w-full max-w-64 mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                      <img 
                        src={`/api/cards/${card.id}/inside-image`} 
                        alt="Card inside preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery:</span>
                  <span className="font-medium capitalize flex items-center gap-1">
                    {deliveryType === 'digital' ? (
                      <>
                        <Download className="w-4 h-4" />
                        Digital
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4" />
                        Printed
                      </>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className={deliveryType === 'digital' ? 'text-green-600' : 'text-purple-600'}>
                    {deliveryType === 'digital' ? 'FREE' : `R${(card.price / 100).toFixed(2)}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

            {/* Order Form */}
            <Card className="lg:col-span-2 bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {deliveryType === 'digital' ? (
                  <Mail className="w-5 h-5" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
                {deliveryType === 'digital' 
                  ? (deliverTo === 'recipient' ? `Deliver to ${recipientName}` : 'Delivery Details')
                  : (deliverTo === 'recipient' ? `Deliver to ${recipientName}` : 'Shipping & Contact Details')
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {deliverTo === 'recipient' ? `${recipientName}'s Details` : 'Your Information'}
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName">
                      {deliverTo === 'recipient' ? `${recipientName}'s Name *` : 'Your Name *'}
                    </Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="customerEmail">{deliverTo === 'recipient' ? `${recipientName}'s Email *` : 'Your Email *'}</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
              </div>

              {deliveryType === 'digital' ? (
                <>
                  <Separator />
                  
                  {/* Digital Delivery Confirmation */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Digital Delivery
                    </h3>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <Mail className="w-5 h-5 text-blue-500 mt-0.5" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-blue-800 font-medium">
                            {deliverTo === 'recipient' 
                              ? `Your digital card will be emailed to both ${recipientName} and you` 
                              : 'Your digital card will be emailed to you instantly'
                            }
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            {deliverTo === 'recipient' 
                              ? `${recipientName} will receive the card link, and you'll also get a copy for your records`
                              : 'The email will include an interactive link to view and download the card'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {deliverTo === 'recipient' && (
                      <div>
                        <Label htmlFor="recipientEmail">{recipientName}'s Email *</Label>
                        <Input
                          id="recipientEmail"
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="recipient@email.com"
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="customMessage">Custom Message (Optional)</Label>
                      <Textarea
                        id="customMessage"
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder={`${customerName || 'Someone'} has sent you a beautiful greeting card created with Celebrait!`}
                        rows={3}
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        This message will appear when the recipient opens the digital card.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Separator />
                  
                  {/* Shipping Address */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {deliverTo === 'recipient' ? `${recipientName}'s Address` : 'Shipping Address'}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="line1">Address Line 1 *</Label>
                        <Input
                          id="line1"
                          value={address.line1}
                          onChange={(e) => setAddress({...address, line1: e.target.value})}
                          placeholder="Street address"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="line2">Address Line 2</Label>
                        <Input
                          id="line2"
                          value={address.line2}
                          onChange={(e) => setAddress({...address, line2: e.target.value})}
                          placeholder="Apartment, suite, etc. (optional)"
                        />
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={address.city}
                            onChange={(e) => setAddress({...address, city: e.target.value})}
                            placeholder="City"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="province">Province *</Label>
                          <Input
                            id="province"
                            value={address.province}
                            onChange={(e) => setAddress({...address, province: e.target.value})}
                            placeholder="Province"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="postalCode">Postal Code *</Label>
                          <Input
                            id="postalCode"
                            value={address.postalCode}
                            onChange={(e) => setAddress({...address, postalCode: e.target.value})}
                            placeholder="Postal code"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || !isFormValid()}
                className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white shadow-lg"
              >
                {submitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </div>
                ) : deliveryType === 'digital' ? (
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Send Digital Card - FREE
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Proceed to Payment - R{(card.price / 100).toFixed(2)}
                  </div>
                )}
              </Button>

              {deliveryType === 'digital' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Digital Card Experience</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    You'll receive a custom link that opens a beautiful digital greeting card experience. 
                    You can then share this link with your recipient - they'll see your message and can click to "open" the card to view your creation.
                  </p>
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
