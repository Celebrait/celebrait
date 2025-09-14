import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SafetyGuideModal } from '@/components/safety-guide-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function TestSafetyModal() {
  const [showModal, setShowModal] = useState(false);
  const [errorType, setErrorType] = useState<'children_photos' | 'explicit_content' | 'adult_content' | 'violence_weapons' | 'copyrighted_characters' | 'celebrities' | 'sensitive_content'>('children_photos');
  const [isTestingRealAPI, setIsTestingRealAPI] = useState(false);
  const { toast } = useToast();

  const testSafetyError = () => {
    setShowModal(true);
  };

  const testRealAPIError = async () => {
    setIsTestingRealAPI(true);
    try {
      // Call a backend endpoint with test headers to trigger safety error
      const response = await fetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Trigger': 'safety_violation',
          'X-Test-Error-Type': errorType
        },
        body: JSON.stringify({
          cardId: 999,
          frontPrompt: 'test prompt',
          insidePrompt: 'test inside prompt'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }
      
      // This should not succeed if the test hook works
      toast({
        title: "Test Failed",
        description: "Expected safety error but API call succeeded",
        variant: "destructive"
      });
    } catch (error: any) {
      console.log('Caught expected safety error:', error);
      
      // Check if this triggered our safety modal logic
      if (error?.isSafetyError || error?.errorType) {
        console.log('✅ Safety error detected, showing SafetyGuideModal');
        setShowModal(true); // Actually show the modal instead of just a success toast
      } else {
        toast({
          title: "Unexpected Error",
          description: `Got error but not safety-related: ${error.message}`,
          variant: "destructive"
        });
      }
    } finally {
      setIsTestingRealAPI(false);
    }
  };

  const handleRetry = () => {
    console.log('Try Again clicked - would restart generation process');
    setShowModal(false);
  };

  const handleClose = () => {
    console.log('Close clicked - would return user to editing');
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Safety Modal Test Page</h1>
          <p className="text-gray-600 mb-8">Test the safety guide modal with different error types</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Safety Error Type</CardTitle>
            <CardDescription>
              Select different error types to test the safety modal behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={errorType} onValueChange={(value: any) => setErrorType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="children_photos" id="children_photos" />
                <Label htmlFor="children_photos">Children Photos (Low Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="explicit_content" id="explicit_content" />
                <Label htmlFor="explicit_content">Explicit Language (High Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="adult_content" id="adult_content" />
                <Label htmlFor="adult_content">Adult Content (High Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="violence_weapons" id="violence_weapons" />
                <Label htmlFor="violence_weapons">Violence/Weapons (Medium Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="copyrighted_characters" id="copyrighted_characters" />
                <Label htmlFor="copyrighted_characters">Copyrighted Characters (Medium Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="celebrities" id="celebrities" />
                <Label htmlFor="celebrities">Celebrities (Medium Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sensitive_content" id="sensitive_content" />
                <Label htmlFor="sensitive_content">Sensitive Content (High Risk)</Label>
              </div>
            </RadioGroup>

            <div className="space-y-3">
              <Button 
                onClick={testSafetyError}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
                data-testid="button-test-safety-modal"
              >
                Test Safety Modal (UI Only)
              </Button>
              
              <Button 
                onClick={testRealAPIError}
                disabled={isTestingRealAPI}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500"
                data-testid="button-test-real-api"
              >
                {isTestingRealAPI ? 'Testing...' : 'Test Real API Safety Error'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Select an error type above</p>
              <p>• Click "Test Safety Modal" to trigger the modal</p>
              <p>• Verify the modal shows appropriate content and buttons</p>
              <p>• Test both "Try Again" and "Close" buttons</p>
              <p>• Check console for button click logs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SafetyGuideModal
        isOpen={showModal}
        onClose={handleClose}
        onRetry={handleRetry}
      />
    </div>
  );
}