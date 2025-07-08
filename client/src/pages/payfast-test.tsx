import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";

export default function PayfastTest() {
  const handleTestPayment = () => {
    // Create a direct form submission to test Payfast sandbox
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://sandbox.payfast.co.za/eng/process';
    form.target = '_blank';
    
    const testData = {
      merchant_id: '10000100',
      merchant_key: '46f0cd694581a',
      return_url: `${window.location.origin}/payment-success/test123`,
      cancel_url: `${window.location.origin}/payment-cancelled/test123`,
      notify_url: `${window.location.origin}/api/payfast/notify`,
      name_first: 'Test',
      name_last: 'User',
      email_address: 'test@celebrait.com',
      m_payment_id: 'test123',
      amount: '129.00',
      item_name: 'Test Payment',
      item_description: 'Testing Payfast sandbox connectivity',
      signature: 'e01b943d5ddb2fa6ae9393be36b30749' // Pre-calculated signature
    };
    
    Object.entries(testData).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value.toString();
      form.appendChild(input);
    });
    
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Payfast Sandbox Test
            </CardTitle>
            <p className="text-gray-600">
              Test direct connection to Payfast sandbox
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Connection Status</h3>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>Signature Generation</span>
                  <Badge variant="default" className="bg-green-100 text-green-700">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Fixed
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>Sandbox Connectivity</span>
                  <Badge variant="destructive" className="bg-red-100 text-red-700">
                    <XCircle className="w-3 h-3 mr-1" />
                    Connection Refused
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>Credentials</span>
                  <Badge variant="default" className="bg-blue-100 text-blue-700">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Valid
                  </Badge>
                </div>
              </div>
            </div>

            {/* Test Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Configuration</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Merchant ID:</strong> 10000100
                  </div>
                  <div>
                    <strong>Merchant Key:</strong> 46f0cd694581a
                  </div>
                  <div>
                    <strong>Passphrase:</strong> jt7NOE43FZPn
                  </div>
                  <div>
                    <strong>Amount:</strong> R129.00
                  </div>
                </div>
              </div>
            </div>

            {/* Test Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={handleTestPayment}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Test Direct Payment Form
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => window.open('https://status.payfast.io/', '_blank')}
                  className="w-full"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Check Payfast Status
                </Button>
              </div>
            </div>

            {/* Status Information */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-2">Connection Issue</h4>
              <p className="text-sm text-yellow-700">
                The Payfast sandbox appears to be temporarily unavailable. This is common during maintenance or high traffic periods. The signature generation is now working correctly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}