import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, emergencyStorageCleanup } from '@/lib/queryClient';
import { ArrowLeft, User, Mail, Phone, MapPin } from 'lucide-react';
import Header from '@/components/header';

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

export default function PaymentSimplified() {
  const [match, params] = useRoute('/payment/:cardId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [deliverTo, setDeliverTo] = useState<'self' | 'recipient'>('self');
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

  useEffect(() => {
    if (match) {
      loadCardData();
      loadDeliveryChoice();
    }
  }, [match, params]);

  const loadCardData = async () => {
    try {
      emergencyStorageCleanup();
      
      // Try to get card data from session storage first
      const storedData = sessionStorage.getItem('cardPreviewData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setCard(parsedData);
        setLoading(false);
        return;
      }

      // Fallback to API if no cached data
      if (params?.cardId) {
        const response = await apiRequest('GET', `/api/cards/${params.cardId}`);
        if (response.ok) {
          const data = await response.json();
          setCard(data);
        }
      }
    } catch (error) {
      console.error('Error loading card data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryChoice = () => {
    const choice = sessionStorage.getItem('deliverTo');
    if (choice === 'self' || choice === 'recipient') {
      setDeliverTo(choice);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '');
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

  const handlePayment = async () => {
    if (!validateForm()) return;

    setProcessingPayment(true);
    try {
      // Use existing Paystack payment endpoint
      const customerInfo = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address
      };

      const paymentData = {
        cardId: card.id,
        customerInfo: customerInfo,
        amount: 12900, // R129.00 in cents
        currency: 'ZAR',
        shippingAddress: formData.address,
        deliverTo: deliverTo
      };

      const response = await apiRequest('POST', '/api/create-payment', paymentData);

      if (response.ok) {
        const result = await response.json();
        
        // Redirect to Paystack payment
        if (result.authorization_url) {
          window.location.href = result.authorization_url;
        } else if (result.paymentUrl) {
          // Fallback for test mode
          window.location.href = result.paymentUrl;
        } else {
          throw new Error('No payment URL received');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Error',
        description: 'Unable to process payment. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const validateForm = () => {
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.phone) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return false;
    }

    if (!formData.address.line1 || !formData.address.city || !formData.address.province || !formData.address.postalCode) {
      toast({
        title: 'Missing Address',
        description: 'Please complete the delivery address.',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleBack = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading payment details...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const recipientName = card?.conversationData?.recipient || card?.conversationData?.name || 'recipient';
  const deliveryTarget = deliverTo === 'self' ? 'yourself' : recipientName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <User className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Your Information</h1>
            <p className="text-lg text-slate-gray">Enter your details and shipping address</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Delivery Info */}
            <div className="text-center lg:col-span-2 mb-6">
              <p className="text-lg text-gray-600">
                Delivering to: <span className="font-semibold text-gray-800">{deliveryTarget}</span>
              </p>
            </div>
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Personal Information */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-800">
                    <User className="w-5 h-5 mr-2" />
                    Personal Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Address */}
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-gray-800">
                    <MapPin className="w-5 h-5 mr-2" />
                    Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="line1">Street Address *</Label>
                    <Input
                      id="line1"
                      value={formData.address.line1}
                      onChange={(e) => handleInputChange('address.line1', e.target.value)}
                      placeholder="Enter street address"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="line2">Apartment/Unit (Optional)</Label>
                    <Input
                      id="line2"
                      value={formData.address.line2 || ''}
                      onChange={(e) => handleInputChange('address.line2', e.target.value)}
                      placeholder="Apartment, suite, unit, etc."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.address.city}
                        onChange={(e) => handleInputChange('address.city', e.target.value)}
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal Code *</Label>
                      <Input
                        id="postalCode"
                        value={formData.address.postalCode}
                        onChange={(e) => handleInputChange('address.postalCode', e.target.value)}
                        placeholder="Enter postal code"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="province">Province *</Label>
                    <Select 
                      value={formData.address.province} 
                      onValueChange={(value) => handleInputChange('address.province', value)}
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
                </CardContent>
              </Card>

              {/* Payment Button */}
              <Button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all duration-300"
              >
                {processingPayment ? 'Processing...' : 'Pay with Paystack'}
              </Button>
            </div>

            {/* Right Column - Order Summary (Mobile: Bottom) */}
            <div className="lg:sticky lg:top-8 lg:h-fit">
              <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Card Toggle */}
                  <div className="flex justify-center mb-4 bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => setCurrentView('front')}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        currentView === 'front'
                          ? 'bg-white text-purple-600 shadow-md'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      Front
                    </button>
                    {card?.insideImageUrl && (
                      <button
                        onClick={() => setCurrentView('inside')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          currentView === 'inside'
                            ? 'bg-white text-purple-600 shadow-md'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        Inside
                      </button>
                    )}
                  </div>

                  {/* Card Preview */}
                  <div className="w-full">
                    {currentView === 'front' && card?.frontImageUrl && (
                      <img 
                        src={card.frontImageUrl?.startsWith('/api/') ? card.frontImageUrl : card.frontImageData || card.frontImageUrl}
                        alt="Card Front"
                        className="w-full h-auto rounded-xl shadow-lg border border-gray-200"
                      />
                    )}
                    {currentView === 'inside' && card?.insideImageUrl && (
                      <img 
                        src={card.insideImageUrl?.startsWith('/api/') ? card.insideImageUrl : card.insideImageData || card.insideImageUrl}
                        alt="Card Inside"
                        className="w-full h-auto rounded-xl shadow-lg border border-gray-200"
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Order Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Card Type:</span>
                      <span className="font-medium">Printed & Delivered</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivery to:</span>
                      <span className="font-medium capitalize">{deliveryTarget}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping:</span>
                      <span className="font-medium">3-5 business days</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span>R129.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
}