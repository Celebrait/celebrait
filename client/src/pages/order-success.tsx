
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle, Download, Share2, Heart, Gift, Truck, Home } from 'lucide-react';

export default function OrderSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId');
    const orderType = urlParams.get('type');
    const reference = urlParams.get('reference');
    
    if (orderId) {
      loadOrder(parseInt(orderId));
    } else if (reference) {
      verifyPayment(reference);
    } else {
      toast({
        title: 'Invalid Request',
        description: 'No order information found',
        variant: 'destructive'
      });
      setLocation('/');
    }
  }, []);

  const loadOrder = async (orderId: number) => {
    try {
      const response = await apiRequest('GET', `/api/orders/${orderId}`);
      const orderData = await response.json();
      setOrder(orderData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Unable to load order details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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

  const downloadCard = () => {
    if (order?.card?.frontImageUrl) {
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

  const shareCard = async () => {
    if (navigator.share && order?.card?.frontImageUrl) {
      try {
        await navigator.share({
          title: 'Check out my Celebrait card!',
          text: 'I just created this amazing card with Celebrait',
          url: window.location.origin
        });
      } catch (error) {
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      toast({
        title: 'Link Copied',
        description: 'Share link copied to clipboard'
      });
    });
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

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h1>
          <p className="text-gray-600">Unable to find your order details.</p>
          <Button onClick={() => setLocation('/')} className="mt-4">
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const isFreeOrder = order.orderType === 'free' || order.amount === 0;
  const hasTip = order.tipAmount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {isFreeOrder ? 'Your Free Card is Ready!' : 'Payment Successful!'}
          </h1>
          <p className="text-gray-600">
            {isFreeOrder 
              ? 'Download your beautiful card below'
              : 'Thank you for your order. Your card has been processed successfully.'
            }
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-medium">#{order.id}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{order.customerName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{order.customerEmail}</span>
              </div>

              {!isFreeOrder && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Amount:</span>
                    <span className="font-medium">{formatPrice(order.baseAmount)}</span>
                  </div>

                  {hasTip && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Heart className="w-4 h-4 text-red-500" />
                        Tip:
                      </span>
                      <span className="font-medium text-purple-600">{formatPrice(order.tipAmount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-medium text-green-600">{formatPrice(order.amount)}</span>
                  </div>
                </>
              )}

              {isFreeOrder && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    FREE
                  </Badge>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">
                  {isFreeOrder ? 'Free Download' : 'Paystack'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status:</span>
                <Badge variant="default" className="bg-green-500">
                  {order.orderStatus}
                </Badge>
              </div>

              {order.shippingAddress && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Shipping Address
                  </h4>
                  <div className="text-sm text-gray-600">
                    <p>{order.shippingAddress.line1}</p>
                    {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                    <p>{order.shippingAddress.city}, {order.shippingAddress.province}</p>
                    <p>{order.shippingAddress.postalCode}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card Preview & Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Your Card</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.card?.frontImageUrl && (
                <div className="aspect-square w-full max-w-80 mx-auto rounded-lg overflow-hidden border-2 border-gray-200">
                  <img 
                    src={order.card.frontImageUrl} 
                    alt="Your card" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={downloadCard}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  disabled={!order.card?.frontImageUrl}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Your Card
                </Button>

                <Button
                  onClick={shareCard}
                  variant="outline"
                  className="w-full"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Celebrait
                </Button>

                <Button
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Create Another Card
                </Button>
              </div>

              {hasTip && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    <span className="font-medium text-purple-800">Thank You!</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    Your generous tip of {formatPrice(order.tipAmount)} helps support our creators 
                    and keeps Celebrait running. We truly appreciate it! 💜
                  </p>
                </div>
              )}

              {isFreeOrder && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Enjoy Your Free Card!</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Thanks for trying Celebrait! If you love your card, consider supporting us 
                    with a tip on your next creation. 🎨
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
