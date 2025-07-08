import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';
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
}

export default function PaymentCancelled() {
  const [, params] = useRoute('/payment-cancelled/:reference');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      if (!params?.reference) return;

      try {
        const response = await fetch(`/api/payfast/payment-status/${params.reference}`);
        
        if (response.ok) {
          const data = await response.json();
          setPaymentStatus(data);
        }
      } catch (err) {
        console.error('Error fetching payment status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentStatus();
  }, [params?.reference]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount / 100);
  };

  const handleRetryPayment = () => {
    // Navigate back to the payment page with the same order
    if (paymentStatus?.paymentReference) {
      // You can implement logic to retry payment here
      window.location.href = `/complete-order/${paymentStatus.paymentReference}`;
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Cancelled Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-red-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Payment Cancelled
            </h1>
            <p className="text-lg text-gray-600">
              Your payment was cancelled. No charges were made to your account.
            </p>
          </div>

          {/* Payment Details */}
          {paymentStatus && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>
                  Reference: {paymentStatus.paymentReference}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="font-medium">{formatAmount(paymentStatus.amount, paymentStatus.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      CANCELLED
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Information Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>What Happened?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Your payment was cancelled before completion. This could happen for several reasons:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
                <li>You clicked "Cancel" or "Back" during the payment process</li>
                <li>The payment session timed out</li>
                <li>There was an issue with your payment method</li>
                <li>You closed the browser or navigated away from the payment page</li>
              </ul>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-4">
            {paymentStatus && (
              <div className="flex gap-4">
                <Button 
                  onClick={handleRetryPayment}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Try Payment Again
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            )}
            
            {!paymentStatus && (
              <div className="text-center">
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </div>
            )}
          </div>

          {/* Support Information */}
          <div className="mt-8 text-center">
            <Alert>
              <AlertDescription>
                <strong>Need Help?</strong> If you're experiencing issues with payment, please contact our support team at{' '}
                <a href="mailto:support@celebrait.co.za" className="text-purple-600 hover:underline">
                  support@celebrait.co.za
                </a>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}