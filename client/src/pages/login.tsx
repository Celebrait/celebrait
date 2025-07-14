import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Sparkles } from "lucide-react";
import Header from "@/components/header";

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          redirectUrl: window.location.pathname 
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSent(true);
        toast({
          title: "Login link sent!",
          description: "Check your email for the sign-in link",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send login link",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login link error:', error);
      toast({
        title: "Error",
        description: "Failed to send login link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <Header />
      
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">
              Sign in to Celebrait
            </CardTitle>
            <p className="text-center text-muted-foreground">
              Enter your email to receive a login link
            </p>
          </CardHeader>
          
          <CardContent>
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Login Link
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <Mail className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <h3 className="font-medium text-green-800 mb-1">
                    Login link sent!
                  </h3>
                  <p className="text-sm text-green-600">
                    Check your email and click the link to sign in
                  </p>
                </div>
                
                <Button 
                  variant="outline"
                  onClick={() => setSent(false)}
                  className="w-full"
                >
                  Try different email
                </Button>
              </div>
            )}
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>
                Don't have an account? Creating one is automatic when you sign in.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}