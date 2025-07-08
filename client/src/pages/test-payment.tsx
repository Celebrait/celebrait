import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { CreditCard, Package, Truck, Download, User, Mail, Phone, MapPin } from 'lucide-react';

export default function TestPayment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [testCard, setTestCard] = useState<any>(null);
  const [creatingCard, setCreatingCard] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [testOrder, setTestOrder] = useState<any>(null);

  const [formData, setFormData] = useState({
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+27 82 123 4567',
    address: {
      line1: '123 Main Street',
      line2: 'Apt 4B',
      city: 'Cape Town',
      province: 'WC',
      postalCode: '8001',
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

  const createTestCard = async (cardType: 'digital' | 'printed', printOption?: string) => {
    setCreatingCard(true);
    try {
      // Create test card with mock data (no AI generation to save tokens)
      const mockCard = {
        id: Date.now(),
        cardType,
        printOption: printOption || null,
        sceneType: 'with-person',
        frontImageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic3Vuc2V0IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I0ZGRDI2NjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY2QzI4O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNzdW5zZXQpIi8+CiAgPGNpcmNsZSBjeD0iMzAwIiBjeT0iMTAwIiByPSI2MCIgZmlsbD0iI0ZGRkZGRiIgb3BhY2l0eT0iMC45Ii8+CiAgPHRleHQgeD0iMjAwIiB5PSIzMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzNiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiNGRkZGRkYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkhhcHB5IEJpcnRoZGF5ITwvdGV4dD4KPC9zdmc+',
        insideImageUrl: printOption === 'front-and-inside' ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjlGOUY5Ii8+CiAgPHRleHQgeD0iMjAwIiB5PSIxNTAiIGZvbnQtZmFtaWx5PSJHZW9yZ2lhLCBzZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+CiAgICA8dHNwYW4geD0iMjAwIiBkeT0iMCI+V2lzaGluZyB5b3UgYWxsIHRoZTwvdHNwYW4+CiAgICA8dHNwYW4geD0iMjAwIiBkeT0iMzAiPmhhcHBpbmVzcyBpbiB0aGUgd29ybGQ8L3RzcGFuPgogICAgPHRzcGFuIHg9IjIwMCIgZHk9IjMwIj5vbiB5b3VyIHNwZWNpYWwgZGF5ITwvdHNwYW4+CiAgPC90ZXh0Pgo8L3N2Zz4=' : null,
        status: 'generating',
        price: cardType === 'digital' ? 100 : (printOption === 'front-and-inside' ? 12900 : 8900),
        conversationData: {
          celebration: 'birthday',
          name: 'Test Person',
          scene: 'celebrating at a beautiful beach sunset'
        }
      };

      setTestCard(mockCard);

      toast({
        title: 'Test Card Created',
        description: `${cardType === 'digital' ? 'Digital' : 'Physical'} card ready for payment testing`
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create test card',
        variant: 'destructive'
      });
    } finally {
      setCreatingCard(false);
    }
  };

  const testPaymentFlow = async () => {
    if (!testCard) return;

    setProcessingPayment(true);
    try {
      // Initialize payment
      const paymentResponse = await apiRequest('POST', '/api/create-payment', {
        cardId: testCard.id,
        customerInfo: formData,
        amount: testCard.price,
        currency: 'ZAR'
      });

      const { paymentUrl, reference } = await paymentResponse.json();

      toast({
        title: 'Payment Initialized',
        description: 'Redirecting to payment page...'
      });

      // For test mode, simulate payment success after a delay
      setTimeout(async () => {
        try {
          const verifyResponse = await apiRequest('POST', '/api/verify-payment', {
            reference
          });

          const order = await verifyResponse.json();
          setTestOrder(order);

          toast({
            title: 'Payment Successful',
            description: 'Test payment completed successfully!'
          });
        } catch (error: any) {
          toast({
            title: 'Payment Verification Failed',
            description: error.message,
            variant: 'destructive'
          });
        }
      }, 2000);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Paystack Payment System Test</h1>
          <p className="text-gray-600">Test the complete payment and delivery workflow for South African users</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Test Card Creation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Step 1: Create Test Card
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Create a test greeting card to demonstrate the payment flow
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => createTestCard('digital')}
                  disabled={creatingCard}
                  className="w-full"
                  variant="outline"
                >
                  {creatingCard ? 'Creating...' : 'Digital Card (R1.00)'}
                </Button>

                <Button
                  onClick={() => createTestCard('printed', 'front-only')}
                  disabled={creatingCard}
                  className="w-full"
                  variant="outline"
                >
                  {creatingCard ? 'Creating...' : 'Physical Card - Front Only (R89.00)'}
                </Button>

                <Button
                  onClick={() => createTestCard('printed', 'front-and-inside')}
                  disabled={creatingCard}
                  className="w-full"
                  variant="outline"
                >
                  {creatingCard ? 'Creating...' : 'Physical Card - Front + Inside (R129.00)'}
                </Button>
              </div>

              {testCard && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">Test Card Created!</p>
                  <div className="text-sm text-green-700 mt-1">
                    <p>Type: {testCard.cardType === 'digital' ? 'Digital' : 'Physical'}</p>
                    <p>Price: {formatPrice(testCard.price)}</p>
                    {testCard.printOption && (
                      <p>Print: {testCard.printOption === 'front-and-inside' ? 'Front + Inside' : 'Front Only'}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Information Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Step 2: Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateFormData('firstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateFormData('lastName', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData('email', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateFormData('phone', e.target.value)}
                  />
                </div>
              </div>

              {testCard?.cardType === 'printed' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Shipping Address
                    </h4>

                    <div>
                      <Label htmlFor="line1">Street Address</Label>
                      <Input
                        id="line1"
                        value={formData.address.line1}
                        onChange={(e) => updateFormData('address.line1', e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="line2">Apartment, suite, etc.</Label>
                      <Input
                        id="line2"
                        value={formData.address.line2}
                        onChange={(e) => updateFormData('address.line2', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.address.city}
                          onChange={(e) => updateFormData('address.city', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="province">Province</Label>
                        <Select 
                          value={formData.address.province}
                          onValueChange={(value) => updateFormData('address.province', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
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
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        value={formData.address.postalCode}
                        onChange={(e) => updateFormData('address.postalCode', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Step 3: Test Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!testCard ? (
                <p className="text-gray-500">Create a test card first to test payment</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="font-medium text-blue-800">Test Mode Active</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Payment will be simulated without requiring actual Paystack API keys
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Amount:</span>
                        <span className="font-bold text-purple-600">{formatPrice(testCard.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Currency:</span>
                        <span>ZAR (South African Rand)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Payment Method:</span>
                        <span>Paystack</span>
                      </div>
                    </div>

                    <Button
                      onClick={testPaymentFlow}
                      disabled={processingPayment}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90"
                    >
                      {processingPayment ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Processing Payment...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Test Payment Flow
                        </div>
                      )}
                    </Button>
                  </div>

                  {testOrder && (
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="font-medium text-green-800 mb-2">Payment Successful!</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Order ID:</span>
                            <span>#{testOrder.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Amount Paid:</span>
                            <span>{formatPrice(testCard.price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Payment Status:</span>
                            <Badge variant="default" className="bg-green-500">
                              {testOrder.paymentStatus}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Order Status:</span>
                            <Badge variant={testCard.cardType === 'digital' ? 'default' : 'secondary'}>
                              {testCard.cardType === 'digital' ? 'Completed' : 'Processing'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Card Preview */}
                      <div className="p-4 bg-white border border-gray-200 rounded-lg">
                        <h4 className="font-medium mb-3">Your Card Preview</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Front of Card</p>
                            <img 
                              src={testCard.frontImageUrl} 
                              alt="Card front" 
                              className="w-full max-w-[200px] mx-auto border rounded-lg shadow-sm"
                              style={{ aspectRatio: '1/1', objectFit: 'contain' }}
                            />
                          </div>
                          {testCard.insideImageUrl && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Inside of Card</p>
                              <img 
                                src={testCard.insideImageUrl} 
                                alt="Card inside" 
                                className="w-full max-w-[200px] mx-auto border rounded-lg shadow-sm"
                                style={{ aspectRatio: '1/1', objectFit: 'contain' }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Next Steps */}
                      {testCard.cardType === 'digital' ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-2">Digital Card Ready</h4>
                          <div className="space-y-3">
                            <p className="text-sm text-blue-700">Your high-resolution card is ready for download and sharing.</p>
                            <div className="space-y-2">
                              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                                <Download className="w-4 h-4 mr-2" />
                                Download High-Res PNG (300 DPI)
                              </Button>
                              <Button size="sm" variant="outline" className="w-full">
                                <Mail className="w-4 h-4 mr-2" />
                                Email to Recipient
                              </Button>
                            </div>
                            <div className="text-xs text-blue-600 space-y-1">
                              <p>• Perfect for social media sharing</p>
                              <p>• Print at home on cardstock</p>
                              <p>• Share via WhatsApp or SMS</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <h4 className="font-medium text-orange-800 mb-2">Physical Card Processing</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-orange-700">
                              <Truck className="w-4 h-4" />
                              <span>Preparing for professional printing</span>
                            </div>
                            <div className="text-sm text-orange-700 space-y-1">
                              <p><strong>Shipping to:</strong></p>
                              <p>{formData.firstName} {formData.lastName}</p>
                              <p>{formData.address.line1}</p>
                              {formData.address.line2 && <p>{formData.address.line2}</p>}
                              <p>{formData.address.city}, {formData.address.province} {formData.address.postalCode}</p>
                            </div>
                            <div className="space-y-2">
                              <Button size="sm" variant="outline" className="w-full">
                                Track Order #{testOrder.id}
                              </Button>
                              <p className="text-xs text-orange-600">
                                Estimated delivery: 3-5 business days via Courier
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* What happens next */}
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <h4 className="font-medium mb-3">What happens next?</h4>
                        {testCard.cardType === 'digital' ? (
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>Your digital card is immediately available for download</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>Share via email, WhatsApp, or social media</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>Print at home on quality cardstock (300 DPI)</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>Professional printing begins within 24 hours</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>Quality check and packaging (1-2 days)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>Courier delivery to your address (2-3 days)</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>SMS tracking updates throughout delivery</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-4 space-y-2">
                          <Button size="sm" variant="outline" className="w-full" onClick={() => {
                            setTestCard(null);
                            setTestOrder(null);
                          }}>
                            Create Another Card
                          </Button>
                          <Button size="sm" variant="outline" className="w-full">
                            Contact Support
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* API Integration Guide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Live Paystack Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Required Environment Variables</h4>
                <div className="space-y-2 text-sm font-mono bg-gray-50 p-3 rounded">
                  <p>PAYSTACK_SECRET_KEY=sk_test_...</p>
                  <p>PAYSTACK_PUBLIC_KEY=pk_test_...</p>
                  <p>PAYSTACK_WEBHOOK_SECRET=whsec_...</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Setup Instructions</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Sign up at paystack.com</li>
                  <li>Get your API keys from the dashboard</li>
                  <li>Add the environment variables</li>
                  <li>Test with live Paystack integration</li>
                  <li>Configure webhook endpoint for notifications</li>
                </ol>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">Features Implemented</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
                <div>
                  <p>• ZAR currency support</p>
                  <p>• South African provinces</p>
                  <p>• Digital card downloads</p>
                  <p>• Physical card shipping</p>
                </div>
                <div>
                  <p>• Payment verification</p>
                  <p>• Order tracking</p>
                  <p>• Webhook notifications</p>
                  <p>• Test mode for development</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}