
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
      if (deliveryMethod === 'recipient' && !recipientEmail.trim()) return false;
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
        const customLink = generateCustomLink();
        const targetEmail = deliveryMethod === 'self' ? customerEmail : recipientEmail;
        
        const orderData = {
          cardId: card.id,
          customerName,
          customerEmail,
          deliveryType: 'digital',
          digitalLink: customLink,
          recipientEmail: targetEmail,
          customMessage: customMessage.trim() || `${customerName} has sent you a beautiful greeting card created with Celebrait!`,
          amount: 0
        };

        // Store digital card data for the custom link
        sessionStorage.setItem(`digitalCard_${customLink.split('/').pop()}`, JSON.stringify({
          ...card,
          senderName: customerName,
          customMessage: orderData.customMessage
        }));

        // Send email notification
        await apiRequest('POST', '/api/send-digital-card', orderData);
        
        toast({
          title: 'Digital Card Sent!',
          description: `Your card has been delivered to ${targetEmail}`,
        });

        // Redirect to success page
        setLocation(`/order-success?type=digital&email=${encodeURIComponent(targetEmail)}`);
        
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-8">
          <Button 
            onClick={() => setLocation('/delivery-choice')} 
            variant="ghost" 
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Delivery Choice
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Order</h1>
            <p className="text-gray-600">
              {deliveryType === 'digital' 
                ? 'Enter details to send your digital card' 
                : 'Enter your details and shipping address'
              }
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Card Preview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Your Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {card?.frontImageUrl && (
                <div className="aspect-square w-full max-w-64 mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                  <img 
                    src={card.frontImageUrl} 
                    alt="Card preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

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
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {deliveryType === 'digital' ? (
                  <Mail className="w-5 h-5" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
                {deliveryType === 'digital' ? 'Delivery Details' : 'Shipping & Contact Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Your Information
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerName">Your Name *</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="customerEmail">Your Email *</Label>
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
                  
                  {/* Digital Delivery Options */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Digital Delivery
                    </h3>
                    
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value="self"
                          checked={deliveryMethod === 'self'}
                          onChange={(e) => setDeliveryMethod(e.target.value as 'self' | 'recipient')}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span>Email to myself (I'll forward it later)</span>
                      </label>
                      
                      <label className="flex items-center space-x-3">
                        <input
                          type="radio"
                          name="deliveryMethod"
                          value="recipient"
                          checked={deliveryMethod === 'recipient'}
                          onChange={(e) => setDeliveryMethod(e.target.value as 'self' | 'recipient')}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span>Email directly to recipient</span>
                      </label>
                    </div>

                    {deliveryMethod === 'recipient' && (
                      <div>
                        <Label htmlFor="recipientEmail">Recipient's Email *</Label>
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
                      Shipping Address
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
                className={`w-full py-6 text-lg font-semibold ${
                  deliveryType === 'digital' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90'
                }`}
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
                    The recipient will receive a custom link that opens a beautiful digital greeting card experience. 
                    They'll see your message and can click to "open" the card to view your creation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
