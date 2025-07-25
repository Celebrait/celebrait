import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ConnectivityTest() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test: string, status: 'success' | 'error' | 'running', message: string, details?: any) => {
    setTestResults(prev => [...prev, { test, status, message, details, timestamp: new Date().toLocaleTimeString() }]);
  };

  const runConnectivityTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    // Test 1: Basic GET endpoint
    try {
      addResult('Basic GET', 'running', 'Testing basic connectivity...');
      console.log('[DEBUG] Testing basic GET endpoint');
      
      const response = await fetch('/api/connectivity-test', {
        method: 'GET',
        credentials: 'include'
      });
      
      console.log('[DEBUG] GET response received:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        addResult('Basic GET', 'success', `Server responding normally`, data);
      } else {
        addResult('Basic GET', 'error', `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('[DEBUG] GET test failed:', error);
      addResult('Basic GET', 'error', `Fetch failed: ${error.message}`);
    }

    // Test 2: Simple POST endpoint
    try {
      addResult('Simple POST', 'running', 'Testing simple POST request...');
      console.log('[DEBUG] Testing simple POST endpoint');
      
      const response = await fetch('/api/connectivity-test-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          test: 'data',
          message: 'connectivity test'
        })
      });
      
      console.log('[DEBUG] Simple POST response received:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        addResult('Simple POST', 'success', 'POST request successful', data);
      } else {
        const errorText = await response.text();
        addResult('Simple POST', 'error', `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      console.error('[DEBUG] Simple POST test failed:', error);
      addResult('Simple POST', 'error', `Fetch failed: ${error.message}`);
    }

    // Test 3: Complex POST endpoint (email service)
    try {
      addResult('Complex POST', 'running', 'Testing complex POST with email service...');
      console.log('[DEBUG] Testing complex POST endpoint');
      
      const response = await fetch('/api/send-card-ready-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: 'test@example.com',
          cardId: 1 // Use a test card ID
        })
      });
      
      console.log('[DEBUG] Complex POST response received:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        addResult('Complex POST', 'success', 'Complex POST request successful', data);
      } else {
        const errorText = await response.text();
        addResult('Complex POST', 'error', `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      console.error('[DEBUG] Complex POST test failed:', error);
      addResult('Complex POST', 'error', `Fetch failed: ${error.message}`);
    }

    // Test 4: Timeout test with shorter duration
    try {
      addResult('Timeout Test', 'running', 'Testing 10-second timeout...');
      console.log('[DEBUG] Testing timeout behavior');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/api/connectivity-test', {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        addResult('Timeout Test', 'success', 'No timeout occurred within 10 seconds');
      } else {
        addResult('Timeout Test', 'error', `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('[DEBUG] Timeout test failed:', error);
      if (error.name === 'AbortError') {
        addResult('Timeout Test', 'error', 'Request timed out after 10 seconds');
      } else {
        addResult('Timeout Test', 'error', `Fetch failed: ${error.message}`);
      }
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running': return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Connectivity Test
            </CardTitle>
            <p className="text-center text-gray-600">
              Test basic API connectivity to isolate fetch issues
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <Button 
                onClick={runConnectivityTests}
                disabled={isRunning}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              >
                {isRunning ? 'Running Tests...' : 'Run Connectivity Tests'}
              </Button>
            </div>

            {testResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Test Results</h3>
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-white/50">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.test}</span>
                          <Badge variant={result.status === 'success' ? 'default' : result.status === 'error' ? 'destructive' : 'secondary'}>
                            {result.status}
                          </Badge>
                          <span className="text-sm text-gray-500">{result.timestamp}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{result.message}</p>
                        {result.details && (
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">What this tests:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Basic GET request to verify server connectivity</li>
                <li>• Basic POST request to verify request body handling</li>
                <li>• Timeout behavior to identify if requests are hanging</li>
                <li>• Console logging to track exact failure points</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}