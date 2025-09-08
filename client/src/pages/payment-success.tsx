import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { CheckCircle, Package, Mail, Clock, Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/header';

interface PaymentStatus {
  paymentReference: string;
  paymentStatus: string;
  orderStatus: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  cardId?: number;
}

export default function PaymentSuccess() {
  const [, params] = useRoute('/payment-success/:reference');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      if (!params?.reference) return;

      try {
        const response = await fetch(`/api/payfast/payment-status/${params.reference}`);
        
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data);
        } else {
          setError('Payment not found');
        }
      } catch (err) {
        setError('Error fetching payment status');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentStatus();

    // Poll for payment status updates every 5 seconds if still pending
    const interval = setInterval(async () => {
      if (!params?.reference) return;

      try {
        const response = await fetch(`/api/payfast/payment-status/${params.reference}`);
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data);
          
          // Stop polling if payment is completed
          if (data.paymentStatus === 'completed') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        // Continue polling on error
        console.error('Error polling payment status:', err);
      }
    }, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [params?.reference]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p>Loading payment status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !paymentStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Alert variant="destructive">
              <AlertDescription>
                {error || 'Payment status not found'}
              </AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSuccessful = paymentStatus.paymentStatus === 'completed';
  const isProcessing = paymentStatus.paymentStatus === 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              {isSuccessful ? (
                <CheckCircle className="h-16 w-16 text-green-500" />
              ) : isProcessing ? (
                <Clock className="h-16 w-16 text-yellow-500" />
              ) : (
                <CheckCircle className="h-16 w-16 text-gray-400" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isSuccessful ? 'Payment Successful!' : 'Payment Processing'}
            </h1>
            <p className="text-lg text-gray-600">
              {isSuccessful 
                ? 'Your order has been confirmed and is being processed.'
                : 'We are processing your payment. Please wait...'
              }
            </p>
          </div>

          {/* Payment Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Order Reference</p>
                  <p className="font-medium">{paymentStatus.paymentReference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount Paid</p>
                  <p className="font-medium">{formatAmount(paymentStatus.amount, paymentStatus.currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer Name</p>
                  <p className="font-medium">{paymentStatus.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{paymentStatus.customerEmail}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isSuccessful 
                      ? 'bg-green-100 text-green-800' 
                      : isProcessing 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {paymentStatus.paymentStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PDF Downloads for Physical Cards */}
          {isSuccessful && paymentStatus.amount === 12900 && paymentStatus.cardId && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Print-Ready Files (For Testing)
                </CardTitle>
                <CardDescription>
                  Download high-quality PDF files for professional printing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => window.open(`/api/download-pdf/${paymentStatus.cardId}/front/5x5/300`, '_blank')}
                  >
                    <Download className="h-5 w-5" />
                    <span className="text-sm">Front Card PDF</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => window.open(`/api/download-pdf/${paymentStatus.cardId}/inside/5x5/300`, '_blank')}
                  >
                    <Download className="h-5 w-5" />
                    <span className="text-sm">Inside Card PDF</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={() => window.open(`/api/download-pdf/${paymentStatus.cardId}/specs`, '_blank')}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-sm">Print Specifications</span>
                  </Button>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>For Testing:</strong> These are high-quality 300 DPI PDF files generated from unwatermarked images. 
                    Front and inside cards are separate files for professional printing.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                What Happens Next?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Order Confirmation</h4>
                    <p className="text-sm text-gray-600">
                      You'll receive an order confirmation email shortly at {paymentStatus.customerEmail}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Card Production</h4>
                    <p className="text-sm text-gray-600">
                      Your personalized greeting card will be professionally printed using the high-quality PDF files
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium">Delivery</h4>
                    <p className="text-sm text-gray-600">
                      Your card will be delivered to the specified address within 3-5 business days
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="mt-8 text-center space-y-4">
            <Button 
              onClick={() => window.location.href = '/'}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              Create Another Card
            </Button>
            
            <div className="text-sm text-gray-600">
              <p>
                Need help? Contact us at{' '}
                <a href="mailto:support@celebrait.co.za" className="text-purple-600 hover:underline">
                  support@celebrait.co.za
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}