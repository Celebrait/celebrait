import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Header from "@/components/header";
import { queryClient } from "@/lib/queryClient";

export default function AuthVerify() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const redirectUrl = urlParams.get('redirect');

    console.log('URL params:', { token, redirectUrl });
    console.log('Full URL:', window.location.href);

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    verifyMagicLink(token, redirectUrl);
  }, []);

  const verifyMagicLink = async (token: string, redirectUrl: string | null) => {
    try {
      const response = await fetch(`/api/auth/verify?token=${token}`, {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage('Successfully signed in!');
        setUser(data.user);
        
        // Invalidate auth cache
        queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
        
        toast({
          title: "Welcome to Celebrait!",
          description: "You have been successfully signed in.",
        });

        // Clear all auth cache and force immediate redirect
        queryClient.clear();
        
        // Use window.location.replace to avoid back button issues
        const finalRedirect = redirectUrl || '/dashboard';
        console.log('Redirecting to:', finalRedirect);
        window.location.replace(finalRedirect);
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to verify magic link');
        toast({
          title: "Verification failed",
          description: data.message || "The magic link is invalid or expired",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Failed to verify magic link');
      toast({
        title: "Error",
        description: "Failed to verify magic link. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className={`p-3 rounded-full ${
                status === 'verifying' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                  : status === 'success' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                    : 'bg-gradient-to-r from-red-500 to-pink-500'
              }`}>
                {status === 'verifying' && (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                )}
                {status === 'success' && (
                  <CheckCircle className="h-6 w-6 text-white" />
                )}
                {status === 'error' && (
                  <AlertCircle className="h-6 w-6 text-white" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              {status === 'verifying' && 'Verifying...'}
              {status === 'success' && 'Welcome!'}
              {status === 'error' && 'Verification Failed'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {status === 'verifying' && 'Please wait while we verify your magic link...'}
              {message}
            </p>
            
            {status === 'success' && user && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium">
                  Welcome back, {user.firstName || user.email}!
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Redirecting to your dashboard...
                </p>
              </div>
            )}
            
            {status === 'error' && (
              <div className="space-y-3">
                <Button 
                  onClick={() => setLocation('/login')}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Try Again
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setLocation('/')}
                  className="w-full"
                >
                  Go Home
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}