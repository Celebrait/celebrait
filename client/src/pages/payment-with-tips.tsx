
import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CreditCard, Truck, MapPin, User, Mail, Phone, Heart, Gift, Download } from 'lucide-react';

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

const TIP_OPTIONS = [
  { value: 0, label: 'No Tip', icon: '💝' },
  { value: 5000, label: 'R50', icon: '☕' },
  { value: 10000, label: 'R100', icon: '🍰' },
  { value: 20000, label: 'R200', icon: '🎉' }
];

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

export default function PaymentWithTips() {
  const [match, params] = useRoute('/payment-tips/:cardId');
  const { toast } = useToast();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedTip, setSelectedTip] = useState(0);
  const [paymentOption, setPaymentOption] = useState<'free' | 'paid'>('paid');
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
    // Basic info always required
    const basicRequired = ['email', 'firstName', 'lastName'];
    
    for (const field of basicRequired) {
      if (!formData[field as keyof PaymentFormData]) {
        return false;
      }
    }

    // Address required only for printed cards
    if (card?.cardType === 'printed') {
      const addressRequired = [
        'address.line1',
        'address.city',
        'address.province',
        'address.postalCode'
      ];

      for (const field of addressRequired) {
        const addressField = field.split('.')[1];
        if (!formData.address[addressField as keyof typeof formData.address]) {
          return false;
        }
      }

      if (!formData.phone) {
        return false;
      }
    }

    return true;
  };

  const getTotalAmount = () => {
    if (paymentOption === 'free') return 0;
    return card.price + selectedTip;
  };

  const processFreeOption = async () => {
    if (!validateForm()) {
      toast({
        title: 'Incomplete Information',
        description: 'Please fill in the required fields',
        variant: 'destructive'
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // Create order with zero amount
      const orderData = {
        cardId: card.id,
        customerInfo: formData,
        amount: 0,
        currency: 'ZAR',
        paymentType: 'free'
      };

      const response = await apiRequest('POST', '/api/create-free-order', orderData);
      const { orderId, downloadUrl } = await response.json();

      toast({
        title: 'Success!',
        description: 'Your free card is ready for download',
      });

      // Redirect to success page or download
      window.location.href = `/order-success?orderId=${orderId}&type=free`;

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process free option',
        variant: 'destructive'
      });
    } finally {
      setProcessingPayment(false);
    }
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
      const totalAmount = getTotalAmount();
      
      // Initialize Paystack payment
      const response = await apiRequest('POST', '/api/create-payment-with-tip', {
        cardId: card.id,
        customerInfo: formData,
        amount: totalAmount,
        baseAmount: card.price,
        tipAmount: selectedTip,
        currency: 'ZAR'
      });

      const { paymentUrl, reference } = await response.json();

      // Debug logging
      console.log('Payment URL generated:', paymentUrl);
      console.log('Payment reference:', reference);

      // Redirect to Paystack payment page
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        throw new Error('No payment URL received');
      }

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

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toFixed(2)}`;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Order</h1>
          <p className="text-gray-600">Choose your payment option below</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Order Summary */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {card.frontImageUrl && (
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
                  <span className="text-gray-600">Base Price:</span>
                  <span className="font-medium">{formatPrice(card.price)}</span>
                </div>

                {selectedTip > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tip:</span>
                    <span className="font-medium text-purple-600">{formatPrice(selectedTip)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className={paymentOption === 'free' ? 'text-green-600' : 'text-purple-600'}>
                    {paymentOption === 'free' ? 'FREE' : formatPrice(getTotalAmount())}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Options */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Type Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={paymentOption === 'paid' ? 'default' : 'outline'}
                  className="h-20 flex flex-col gap-2"
                  onClick={() => setPaymentOption('paid')}
                >
                  <CreditCard className="w-6 h-6" />
                  <span>Pay with Paystack</span>
                </Button>
                
                <Button
                  type="button"
                  variant={paymentOption === 'free' ? 'default' : 'outline'}
                  className="h-20 flex flex-col gap-2 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => setPaymentOption('free')}
                >
                  <Download className="w-6 h-6" />
                  <span>Get Free Copy</span>
                </Button>
              </div>

              {/* Tip Selection (only show for paid option) */}
              {paymentOption === 'paid' && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      Support the Creator (Optional Tip)
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {TIP_OPTIONS.map((tip) => (
                        <Button
                          key={tip.value}
                          type="button"
                          variant={selectedTip === tip.value ? 'default' : 'outline'}
                          className="h-16 flex flex-col gap-1"
                          onClick={() => setSelectedTip(tip.value)}
                        >
                          <span className="text-lg">{tip.icon}</span>
                          <span className="text-sm">{tip.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Your Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                {card.cardType === 'printed' && (
                  <>
                    <div>
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        placeholder="+27 82 123 4567"
                      />
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Shipping Address
                      </h4>

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
                        <Label htmlFor="line2">Apartment, suite, etc.</Label>
                        <Input
                          id="line2"
                          value={formData.address.line2}
                          onChange={(e) => updateFormData('address.line2', e.target.value)}
                          placeholder="Apt 4B"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Action Button */}
              <Button
                onClick={paymentOption === 'free' ? processFreeOption : processPayment}
                disabled={processingPayment || !validateForm()}
                className={`w-full py-6 text-lg font-semibold ${
                  paymentOption === 'free' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90'
                }`}
              >
                {processingPayment ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </div>
                ) : paymentOption === 'free' ? (
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Get Free Copy
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Pay {formatPrice(getTotalAmount())} with Paystack
                  </div>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                {paymentOption === 'free' 
                  ? 'Get your card instantly for free. No payment required!'
                  : 'Secure payment processing by Paystack. Your payment information is encrypted and secure.'
                }
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
