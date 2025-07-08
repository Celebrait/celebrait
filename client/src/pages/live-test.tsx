import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, AlertTriangle, ExternalLink, CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function LiveTest() {
  const [testAmount, setTestAmount] = useState('1.00');
  const [testing, setTesting] = useState(false);

  // Get Payfast status
  const { data: payfastStatus } = useQuery({
    queryKey: ['/api/payfast/status'],
  });

  const handleLiveTest = async () => {
    setTesting(true);
    try {
      // Create a test card first
      const cardResponse = await apiRequest('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          cardType: 'printed',
          printOption: 'front-and-inside',
          conversationData: {
            celebration: 'test',
            recipient: 'friend',
            name: 'Test User',
            message: 'Live payment test',
            inside_message: 'Testing live Payfast integration',
            art_style: 'watercolor',
            scene: 'Test scene',
            email: 'test@celebrait.com',
            user_first_name: 'Test',
            user_last_name: 'User',
            user_email: 'test@celebrait.com'
          },
          price: Math.round(parseFloat(testAmount) * 100), // Convert to cents
          frontImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          insideImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        })
      });

      // Create payment
      const paymentResponse = await apiRequest('/api/payfast/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: cardResponse.id,
          customerName: 'Test User',
          customerEmail: 'test@celebrait.com',
          amount: parseFloat(testAmount),
          description: `Live Payfast Test - R${testAmount}`
        })
      });

      // Create payment form and submit
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = paymentResponse.paymentUrl;
      form.target = '_blank'; // Open in new window for testing
      
      Object.entries(paymentResponse.paymentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value.toString();
        form.appendChild(input);
      });
      
      document.body.appendChild(form);
      form.submit();
      
    } catch (error) {
      console.error('Live test error:', error);
    } finally {
      setTesting(false);
    }
  };

  const isLiveMode = payfastStatus && !payfastStatus.sandbox;
  const hasLiveCredentials = payfastStatus?.hasLiveCredentials;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              Payfast Live Testing
            </CardTitle>
            <p className="text-gray-600">
              Test real payments with live Payfast credentials
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Configuration Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Configuration Status</h3>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>Environment</span>
                  <Badge variant={payfastStatus?.environment === 'production' ? 'default' : 'secondary'}>
                    {payfastStatus?.environment?.toUpperCase() || 'Unknown'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>Payment Mode</span>
                  <Badge variant={isLiveMode ? 'destructive' : 'default'} className={isLiveMode ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                    {isLiveMode ? (
                      <>
                        <CreditCard className="w-3 h-3 mr-1" />
                        LIVE
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        SANDBOX
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>Live Credentials</span>
                  <Badge variant={hasLiveCredentials ? 'default' : 'secondary'} className={hasLiveCredentials ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {hasLiveCredentials ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Available
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Missing
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Warning for Live Mode */}
            {hasLiveCredentials && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800 mb-1">Live Payment Warning</h4>
                    <p className="text-sm text-red-700">
                      Live credentials are configured. In production mode, this will process real payments with real money.
                      Start with small test amounts (R1.00) to verify the integration works correctly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Test Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Configuration</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="testAmount">Test Amount (ZAR)</Label>
                  <Input
                    id="testAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Recommended: Start with R1.00 for initial testing
                  </p>
                </div>
              </div>
            </div>

            {/* Current Settings */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold">Current Settings</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Merchant ID:</strong> {payfastStatus?.merchantId || 'Not configured'}
                </div>
                <div>
                  <strong>Amount:</strong> R{testAmount}
                </div>
                <div>
                  <strong>Mode:</strong> {payfastStatus?.mode || 'Unknown'}
                </div>
                <div>
                  <strong>Configured:</strong> {payfastStatus?.configured ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Test Actions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={handleLiveTest}
                  disabled={!payfastStatus?.configured || testing}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {testing ? 'Creating Test Payment...' : `Test Payment - R${testAmount}`}
                </Button>
                
                {!payfastStatus?.configured && (
                  <p className="text-sm text-red-600 text-center">
                    Payfast credentials not configured properly
                  </p>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">Testing Instructions</h4>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Start with a small amount (R1.00) to verify integration</li>
                <li>Click "Test Payment" to create a test transaction</li>
                <li>Complete the payment flow in the new window</li>
                <li>Monitor logs for payment notifications (ITN)</li>
                <li>Check order status and email notifications</li>
                <li>If successful, test with normal amounts (R129.00)</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}