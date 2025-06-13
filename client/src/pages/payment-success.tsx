import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle, Download, Truck, MapPin, Clock, Package } from 'lucide-react';

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference');
    const status = urlParams.get('status');

    console.log('Payment success page loaded with:', { reference, status });

    if (reference && status === 'success') {
      verifyPayment(reference);
    } else {
      console.error('Invalid payment parameters:', { reference, status });
      setError('Invalid payment parameters');
      setLoading(false);
    }
  }, []);

  const verifyPayment = async (reference: string) => {
    try {
      const response = await apiRequest('POST', '/api/verify-payment', { reference });
      const orderData = await response.json();
      setOrder(orderData);
    } catch (error) {
      toast({
        title: 'Payment Verification Failed',
        description: 'Unable to verify your payment. Please contact support.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = async () => {
    if (order?.card?.frontImageUrl) {
      // Create download link
      const link = document.createElement('a');
      link.href = order.card.frontImageUrl;
      link.download = `celebrait-card-${order.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download Started',
        description: 'Your card is being downloaded'
      });
    }
  };

  const formatPrice = (cents: number) => {
    return `R${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Not Found</h1>
          <p className="text-gray-600">{error || 'Unable to verify your payment.'}</p>
          <Button onClick={() => setLocation('/')} className="mt-4">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">Thank you for your order. Here are your details:</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-medium">#{order.id}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{formatDate(order.createdAt)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Total Paid:</span>
                <span className="font-medium text-green-600">{formatPrice(order.amount)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">Paystack</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <Badge variant="default" className="bg-green-500">
                  {order.status}
                </Badge>
              </div>

              {order.card?.frontImageUrl && (
                <div className="pt-4">
                  <div className="aspect-square w-48 mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                    <img 
                      src={order.card.frontImageUrl} 
                      alt="Your card" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {order.card?.cardType === 'digital' ? (
                  <Download className="w-5 h-5" />
                ) : (
                  <Truck className="w-5 h-5" />
                )}
                {order.card?.cardType === 'digital' ? 'Download' : 'Delivery'} Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.card?.cardType === 'digital' ? (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">Digital Card Ready!</h3>
                    <p className="text-blue-700 text-sm mb-3">
                      Your digital card is ready for download. You can also access it anytime from your email.
                    </p>
                    <Button 
                      onClick={downloadCard}
                      className="w-full bg-blue-500 hover:bg-blue-600"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download High-Quality Card
                    </Button>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>• High-resolution PNG format</p>
                    <p>• Perfect for social media sharing</p>
                    <p>• Print at home if needed</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Processing Your Order
                    </h3>
                    <p className="text-amber-700 text-sm">
                      Your card is being prepared for printing and shipping. You'll receive tracking information within 24 hours.
                    </p>
                  </div>

                  {order.shippingAddress && (
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Shipping Address
                      </h4>
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium">{order.customerName}</p>
                        <p>{order.shippingAddress.line1}</p>
                        {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                        <p>{order.shippingAddress.city}, {order.shippingAddress.province}</p>
                        <p>{order.shippingAddress.postalCode}</p>
                        <p>South Africa</p>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-600">
                    <p>• Estimated delivery: 3-5 business days</p>
                    <p>• Tracking information will be sent via email</p>
                    <p>• Premium card stock and printing</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Support Information */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="font-semibold text-gray-800 mb-2">Need Help?</h3>
              <p className="text-gray-600 text-sm mb-4">
                If you have any questions about your order, please don't hesitate to contact our support team.
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => setLocation('/')}>
                  Create Another Card
                </Button>
                <Button variant="outline">
                  Contact Support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}