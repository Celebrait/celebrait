import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Heart, Wand2, Users, Mail, CheckCircle } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function Landing() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('/api/auth/request-login', {
        method: 'POST',
        body: { email },
      });
      setEmailSent(true);
      toast({
        title: "Email sent!",
        description: "Check your email for the sign-in link",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send sign-in email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <Header />
      
      <div className="pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Create Beautiful AI-Powered
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600"> Greeting Cards</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your special moments into personalized greeting cards with the power of AI. 
              Sign up to receive your cards via email and access your personal dashboard.
            </p>
            
            {emailSent ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 max-w-md mx-auto">
                <div className="flex items-center justify-center mb-4">
                  <CheckCircle className="text-green-600 w-12 h-12" />
                </div>
                <h3 className="text-lg font-semibold text-green-800 mb-2 text-center">
                  Check Your Email!
                </h3>
                <p className="text-green-700 text-center">
                  We've sent a sign-in link to <strong>{email}</strong>. 
                  Click the link in your email to access your dashboard.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSignIn} className="max-w-md mx-auto">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-center sm:text-left"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={isLoading}
                    size="lg" 
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 h-12 rounded-full"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Get Sign-In Link
                      </div>
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 text-center">
                  We'll send you a secure link to access your account
                </p>
              </form>
            )}
          </div>

          {/* Features Section */}
          <div className="mt-20 grid md:grid-cols-3 gap-8">
            <Card className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Heart className="text-white w-6 h-6" />
                </div>
                <CardTitle className="text-xl">Personal Touch</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  AI analyzes your photos and creates personalized cards that capture the essence of your special moments.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Wand2 className="text-white w-6 h-6" />
                </div>
                <CardTitle className="text-xl">AI Magic</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Advanced AI generates stunning artwork and personalized messages tailored to your celebration.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="text-white w-6 h-6" />
                </div>
                <CardTitle className="text-xl">Your Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Access all your cards and orders from your personal dashboard. Track deliveries and create new cards.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <div className="mt-20 text-center bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Create Your First Card?
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Sign up now to access the full card creation experience and receive your cards via email.
            </p>
            <form onSubmit={handleEmailSignIn} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter your email to get started"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 text-center sm:text-left"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={isLoading || emailSent}
                  size="lg" 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 h-12 rounded-full"
                >
                  Create Account & Start Designing
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}