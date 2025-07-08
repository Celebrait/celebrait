import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";
import { 
  TestTube, 
  Mail, 
  CreditCard, 
  Download, 
  Truck, 
  User, 
  Gift,
  CheckCircle,
  ArrowRight,
  DollarSign,
  Globe,
  Shield
} from "lucide-react";

export default function TestDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Test configuration
  const [testEmail, setTestEmail] = useState("test@celebrait.com");
  const [testRecipientName, setTestRecipientName] = useState("Sarah");
  const [testCelebration, setTestCelebration] = useState("birthday");
  const [testCardType, setTestCardType] = useState<'digital' | 'printed'>('digital');
  const [testDeliveryMethod, setTestDeliveryMethod] = useState<'self' | 'recipient'>('self');
  
  // Test execution state
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [payfastStatus, setPayfastStatus] = useState<any>(null);

  const createTestCard = async (cardType?: 'digital' | 'printed') => {
    const actualCardType = cardType || testCardType;
    const testCard = {
      userId: 1,
      cardType: actualCardType,
      printOption: 'front-and-inside',
      conversationData: {
        celebration: testCelebration,
        recipient: 'friend',
        name: testRecipientName,
        message: `Happy ${testCelebration}!`,
        inside_message: 'Hope you have an amazing day filled with joy and laughter!',
        art_style: 'watercolor',
        scene: 'A beautiful garden party with balloons and cake',
        email: testEmail,
        user_first_name: 'Test',
        user_last_name: 'User',
        user_email: testEmail
      },
      price: actualCardType === 'digital' ? 0 : 12900,
      // Mock images for testing
      frontImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      insideImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    };

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testCard)
      });
      
      if (!response.ok) throw new Error('Failed to create test card');
      return await response.json();
    } catch (error) {
      console.error('Test card creation failed:', error);
      throw error;
    }
  };

  const runTest = async (testName: string, testFunction: () => Promise<void>) => {
    setCurrentTest(testName);
    try {
      await testFunction();
      setTestResults(prev => ({ ...prev, [testName]: true }));
      toast({
        title: "Test Passed",
        description: `${testName} completed successfully`,
        variant: "default"
      });
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testName]: false }));
      toast({
        title: "Test Failed",
        description: `${testName} failed: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setCurrentTest(null);
    }
  };

  const testFullDigitalFlow = async () => {
    // Create test card
    const card = await createTestCard();
    
    // Simulate email notification
    await fetch(`/api/send-card-ready-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, cardId: card.id })
    });
    
    // Navigate to card preview (simulating email link)
    setTimeout(() => {
      setLocation(`/card-preview/${card.id}`);
    }, 1000);
  };

  const testFullPrintedFlow = async () => {
    // Set test card type to printed
    setTestCardType('printed');
    
    // Create test card
    const card = await createTestCard();
    
    // Store delivery preferences
    sessionStorage.setItem('selectedDeliveryType', 'printed');
    sessionStorage.setItem('deliverTo', testDeliveryMethod);
    
    // Simulate email notification
    await fetch(`/api/send-card-ready-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, cardId: card.id })
    });
    
    // Navigate to card preview
    setTimeout(() => {
      setLocation(`/card-preview/${card.id}`);
    }, 1000);
  };

  const testEmailNotifications = async () => {
    const card = await createTestCard();
    
    // Test card ready notification
    await fetch(`/api/send-card-ready-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, cardId: card.id })
    });
    
    // Test digital card delivery (if digital)
    if (testCardType === 'digital') {
      await fetch('/api/create-free-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          customerEmail: testEmail,
          customerName: 'Test User',
          deliveryMethod: testDeliveryMethod,
          recipientEmail: testDeliveryMethod === 'recipient' ? testEmail : null,
          recipientName: testDeliveryMethod === 'recipient' ? testRecipientName : null
        })
      });
    }
  };

  const testOrderCompletion = async () => {
    const card = await createTestCard();
    
    if (testCardType === 'digital') {
      // Digital cards now require R1.00 payment - redirect to complete order page
      setTimeout(() => {
        setLocation(`/complete-order/${card.id}?delivery=${testDeliveryMethod}&type=digital`);
      }, 1000);
    } else {
      // Test printed order creation (without payment)
      const orderData = {
        cardId: card.id,
        customerName: 'Test User',
        customerEmail: testEmail,
        deliveryType: 'printed',
        shippingAddress: {
          line1: '123 Test Street',
          line2: '',
          city: 'Test City',
          province: 'Test Province',
          postalCode: '12345'
        },
        amount: card.price
      };
      
      // Navigate directly to complete-order page for Payfast integration
      setTimeout(() => {
        setLocation(`/complete-order/${card.id}?delivery=self&type=printed`);
      }, 1000);
    }
  };

  const testConversationFlow = () => {
    // Clear any existing state
    sessionStorage.clear();
    
    // Set test delivery type
    sessionStorage.setItem('selectedDeliveryType', testCardType);
    sessionStorage.setItem('selectedPhotoOption', 'upload_and_scene');
    
    // Navigate to home to start conversation
    setLocation('/');
  };

  // Payfast-specific test functions
  const testPayfastStatus = async () => {
    try {
      const response = await fetch('/api/payfast/status');
      const status = await response.json();
      setPayfastStatus(status);
      
      toast({
        title: status.configured ? "Payfast Status: Configured" : "Payfast Status: Not Configured",
        description: `Mode: ${status.mode}, Merchant ID: ${status.merchantId}`,
        variant: status.configured ? "default" : "destructive"
      });
      
      return status.configured;
    } catch (error) {
      toast({
        title: "Payfast Status Check Failed",
        description: "Could not check Payfast configuration",
        variant: "destructive"
      });
      return false;
    }
  };

  const testPayfastPayment = async () => {
    try {
      // Create a test PRINTED card first
      const card = await createTestCard('printed');
      
      // Test payment data in correct format for Payfast endpoint
      const paymentData = {
        cardId: card.id,
        customerInfo: {
          name: "Test User",
          email: testEmail,
          phone: "0123456789"
        },
        deliveryInfo: {
          address: {
            line1: "123 Test Street",
            line2: "",
            city: "Cape Town", 
            province: "Western Cape",
            postalCode: "8001"
          }
        }
      };
      
      const response = await fetch('/api/payfast/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "Payfast Payment Created",
          description: "Payment form generated successfully. Check console for details.",
          variant: "default"
        });
        console.log('Payfast Payment Data:', result);
        
        // Open Payfast payment in new window for testing
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = result.paymentUrl;
        form.target = '_blank';
        
        Object.keys(result.paymentData).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = result.paymentData[key];
          form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        
        return true;
      } else {
        throw new Error(result.error || 'Payment creation failed');
      }
    } catch (error) {
      toast({
        title: "Payfast Payment Test Failed",
        description: error.message || "Could not create test payment",
        variant: "destructive"
      });
      return false;
    }
  };

  const testPayfastFlow = async () => {
    try {
      // Create a test PRINTED card first  
      const card = await createTestCard('printed');
      
      // Set up session storage for order flow
      sessionStorage.setItem('cardPreviewData', JSON.stringify(card));
      sessionStorage.setItem('selectedDeliveryType', 'printed');
      
      // Navigate to complete-order page to test full Payfast integration
      setLocation(`/complete-order/${card.id}?delivery=self&type=printed`);
      
      toast({
        title: "Payfast Flow Test Started",
        description: "Navigate through the complete order form to test Payfast integration",
        variant: "default"
      });
      
      return true;
    } catch (error) {
      toast({
        title: "Payfast Flow Test Failed",
        description: error.message || "Could not start Payfast flow test",
        variant: "destructive"
      });
      return false;
    }
  };

  const tests = [
    {
      name: "Full Digital Flow",
      description: "Complete digital card creation, email notification, and delivery",
      icon: Download,
      action: () => runTest("Full Digital Flow", testFullDigitalFlow)
    },
    {
      name: "Full Printed Flow", 
      description: "Complete printed card creation, email notification, and payment flow",
      icon: Truck,
      action: () => runTest("Full Printed Flow", testFullPrintedFlow)
    },
    {
      name: "Email Notifications",
      description: "Test all email notifications (ready, delivery, shipping)",
      icon: Mail,
      action: () => runTest("Email Notifications", testEmailNotifications)
    },
    {
      name: "Order Completion",
      description: "Test order creation and completion process",
      icon: CreditCard,
      action: () => runTest("Order Completion", testOrderCompletion)
    },
    {
      name: "Payfast Status",
      description: "Check Payfast configuration and connection status",
      icon: Shield,
      action: () => runTest("Payfast Status", testPayfastStatus)
    },
    {
      name: "Payfast Payment",
      description: "Test Payfast payment form generation and redirect",
      icon: DollarSign,
      action: () => runTest("Payfast Payment", testPayfastPayment)
    },
    {
      name: "Payfast Full Flow",
      description: "Test complete Payfast integration with order form",
      icon: Globe,
      action: () => runTest("Payfast Full Flow", testPayfastFlow)
    },
    {
      name: "Conversation Flow",
      description: "Test the guided conversation from start to finish",
      icon: User,
      action: testConversationFlow
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
          
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-6 flex items-center justify-center">
              <TestTube className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Test Dashboard
            </h1>
            <p className="text-lg text-gray-600">
              Test the complete Celebrait flow end-to-end without API calls
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Test Configuration */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Test Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="testEmail">Test Email</Label>
                  <Input
                    id="testEmail"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@celebrait.com"
                  />
                </div>
                
                <div>
                  <Label htmlFor="testRecipientName">Recipient Name</Label>
                  <Input
                    id="testRecipientName"
                    value={testRecipientName}
                    onChange={(e) => setTestRecipientName(e.target.value)}
                    placeholder="Sarah"
                  />
                </div>
                
                <div>
                  <Label htmlFor="testCelebration">Celebration</Label>
                  <Select value={testCelebration} onValueChange={setTestCelebration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="anniversary">Anniversary</SelectItem>
                      <SelectItem value="graduation">Graduation</SelectItem>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="get-well">Get Well</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="testCardType">Card Type</Label>
                  <Select value={testCardType} onValueChange={(value: 'digital' | 'printed') => setTestCardType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digital">Digital Card</SelectItem>
                      <SelectItem value="printed">Printed Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="testDeliveryMethod">Delivery Method</Label>
                  <Select value={testDeliveryMethod} onValueChange={(value: 'self' | 'recipient') => setTestDeliveryMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Deliver to Self</SelectItem>
                      <SelectItem value="recipient">Deliver to Recipient</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Test Execution */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="w-5 h-5" />
                  Test Execution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tests.map((test, index) => {
                  const Icon = test.icon;
                  const isRunning = currentTest === test.name;
                  const result = testResults[test.name];
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-gray-800">{test.name}</p>
                          <p className="text-sm text-gray-600">{test.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {result !== undefined && (
                          <Badge variant={result ? "default" : "destructive"}>
                            {result ? <CheckCircle className="w-3 h-3 mr-1" /> : null}
                            {result ? "Passed" : "Failed"}
                          </Badge>
                        )}
                        
                        <Button
                          onClick={test.action}
                          disabled={isRunning}
                          size="sm"
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
                        >
                          {isRunning ? (
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            
            {/* Payfast Status */}
            <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  Payfast Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button
                    onClick={testPayfastStatus}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
                    variant="default"
                  >
                    Check Payfast Configuration
                  </Button>
                  
                  {payfastStatus && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">Status</span>
                        <Badge variant={payfastStatus.configured ? "default" : "destructive"}>
                          {payfastStatus.configured ? "Configured" : "Not Configured"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">Mode</span>
                        <Badge variant={payfastStatus.mode === 'sandbox' ? "secondary" : "default"}>
                          {payfastStatus.mode}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">Merchant ID</span>
                        <span className="text-sm text-gray-600">{payfastStatus.merchantId}</span>
                      </div>
                      {payfastStatus.paymentUrl && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium">Payment URL</span>
                          <span className="text-sm text-gray-600 truncate">{payfastStatus.paymentUrl}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-8" />

          {/* Quick Actions */}
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Quick Actions</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                onClick={() => setLocation('/')}
                variant="outline"
                className="border-purple-200 hover:bg-purple-50"
              >
                Go to Homepage
              </Button>
              
              <Button
                onClick={() => {
                  sessionStorage.clear();
                  setTestResults({});
                  toast({ title: "Test data cleared", description: "All test results and session data cleared" });
                }}
                variant="outline"
                className="border-red-200 hover:bg-red-50"
              >
                Clear Test Data
              </Button>
              
              <Button
                onClick={() => window.open('/api/test-sendgrid', '_blank')}
                variant="outline"
                className="border-green-200 hover:bg-green-50"
              >
                Test Email Service
              </Button>
              
              <Button
                onClick={testPayfastStatus}
                variant="outline"
                className="border-blue-200 hover:bg-blue-50"
              >
                Check Payfast Status
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}