import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/header';

export default function PaymentSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-8">Your order has been confirmed.</p>
          <Card>
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2 text-left">
              <p>1. You will receive an order confirmation email shortly.</p>
              <p>2. Your card will be professionally printed.</p>
              <p>3. Delivered to your address within 3–5 business days.</p>
            </CardContent>
          </Card>
          <Button
            onClick={() => window.location.href = '/'}
            className="mt-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            Create Another Card
          </Button>
          <p className="mt-4 text-sm text-gray-500">
            Need help?{' '}
            <a href="mailto:support@celebrait.co.za" className="text-purple-600 hover:underline">
              support@celebrait.co.za
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
