import { XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/header';

export default function PaymentCancelled() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-lg text-gray-600 mb-8">
            No charges were made to your account. Your card is still saved.
          </p>
          <Button
            onClick={() => window.location.href = '/'}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div className="mt-8">
            <Alert>
              <AlertDescription>
                Need help?{' '}
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
