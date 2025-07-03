import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, emergencyStorageCleanup } from '@/lib/queryClient';
import { ArrowLeft, User, Mail, Phone, MapPin, CreditCard } from 'lucide-react';

interface PaymentFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

export default function Payment() {
  const [match, params] = useRoute('/payment/:cardId');
  const { toast } = useToast();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [currentView, setCurrentView] = useState<'front' | 'inside'>('front');
  const [formData, setFormData] = useState<PaymentFormData>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'ZA'
    }
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

  // Get delivery method (who to deliver to) from session storage
  const deliverTo = sessionStorage.getItem('deliverTo') as 'self' | 'recipient' || 'self';
  
  // Get recipient name from card data for dynamic text
  const recipientName = card?.conversationData?.name || 'the recipient';

  useEffect(() => {
    if (match && params?.cardId) {
      loadCard(parseInt(params.cardId));
    }
  }, [match, params]);

  const loadCard = async (cardId: number) => {
    try {
      const response = await apiRequest('GET', `/api/cards/${cardId}`);
      const cardData = await response.json();
      setCard(cardData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load card details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const validateForm = () => {
    const required = [
      'email',
      'firstName', 
      'lastName',
      'phone',
      'address.line1',
      'address.city',
      'address.province',
      'address.postalCode'
    ];

    for (const field of required) {
      if (field.startsWith('address.')) {
        const addressField = field.split('.')[1];
        if (!formData.address[addressField as keyof typeof formData.address]) {
          return false;
        }
      } else {
        if (!formData[field as keyof PaymentFormData]) {
          return false;
        }
      }
    }

    return true;
  };

  const processPayment = async () => {
    if (!validateForm()) {
      toast({
        title: 'Incomplete Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // Initialize Paystack payment
      const response = await apiRequest('POST', '/api/create-payment', {
        cardId: card.id,
        customerInfo: formData,
        amount: card.price,
        currency: 'ZAR'
      });

      const { paymentUrl, reference } = await response.json();

      // Redirect to Paystack payment page
      window.location.href = paymentUrl;

    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to process payment',
        variant: 'destructive'
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Card Not Found</h1>
          <p className="text-gray-600">The card you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Order</h1>
          <p className="text-gray-600">Secure payment powered by Paystack</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {card.frontImageUrl && (
                <div className="aspect-square w-48 mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                  <img 
                    src={card.frontImageUrl} 
                    alt="Card preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Card Type:</span>
                  <span className="font-medium">
                    {card.cardType === 'printed' ? 'Physical Card' : 'Digital Card'}
                  </span>
                </div>

                {card.cardType === 'printed' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Print Option:</span>
                    <span className="font-medium">
                      {card.printOption === 'front-and-inside' ? 'Front + Inside' : 'Front Only'}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery:</span>
                  <span className="font-medium">
                    {card.cardType === 'printed' ? 'Standard Shipping (3-5 days)' : 'Instant Download'}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-purple-600">{formatPrice(card.price)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {deliverTo === 'recipient' ? `${recipientName}'s Information` : 'Customer Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {deliverTo === 'recipient' ? `${recipientName}'s Contact Details` : 'Contact Details'}
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateFormData('firstName', e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateFormData('lastName', e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateFormData('phone', e.target.value)}
                    placeholder="+27 82 123 4567"
                  />
                </div>
              </div>

              {/* Shipping Address (only for printed cards) */}
              {card.cardType === 'printed' && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {deliverTo === 'recipient' ? `${recipientName}'s Address` : 'Shipping Address'}
                    </h3>

                    <div>
                      <Label htmlFor="line1">Street Address *</Label>
                      <Input
                        id="line1"
                        value={formData.address.line1}
                        onChange={(e) => updateFormData('address.line1', e.target.value)}
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div>
                      <Label htmlFor="line2">Apartment, suite, etc. (optional)</Label>
                      <Input
                        id="line2"
                        value={formData.address.line2}
                        onChange={(e) => updateFormData('address.line2', e.target.value)}
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.address.city}
                          onChange={(e) => updateFormData('address.city', e.target.value)}
                          placeholder="Cape Town"
                        />
                      </div>
                      <div>
                        <Label htmlFor="province">Province *</Label>
                        <Select 
                          value={formData.address.province}
                          onValueChange={(value) => updateFormData('address.province', value)}
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
                    </div>

                    <div>
                      <Label htmlFor="postalCode">Postal Code *</Label>
                      <Input
                        id="postalCode"
                        value={formData.address.postalCode}
                        onChange={(e) => updateFormData('address.postalCode', e.target.value)}
                        placeholder="8001"
                      />
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={processPayment}
                disabled={processingPayment || !validateForm()}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white py-3 text-lg font-semibold"
              >
                {processingPayment ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Pay {formatPrice(card.price)} with Paystack
                  </div>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Secure payment processing by Paystack. Your payment information is encrypted and secure.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}