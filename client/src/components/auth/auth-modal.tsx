import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Mail, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess: (userData: { firstName: string; lastName: string; email: string }) => void;
}

type AuthStep = 'choice' | 'existing' | 'new';

export default function AuthModal({ open, onOpenChange, onAuthSuccess }: AuthModalProps) {
  const [currentStep, setCurrentStep] = useState<AuthStep>('choice');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setEmailConfirm('');
    setCurrentStep('choice');
  };

  const handleSignIn = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const userData = await apiRequest('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' }
      });

      onAuthSuccess({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email
      });
      onOpenChange(false);
      resetForm();
      
      toast({
        title: "Welcome back!",
        description: "You've been successfully signed in."
      });
    } catch (error: any) {
      toast({
        title: "Sign In Failed",
        description: error.message || "Please check your email address or try signing up as a new user.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !emailConfirm) {
      toast({
        title: "All Fields Required",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    if (email !== emailConfirm) {
      toast({
        title: "Email Mismatch",
        description: "Email addresses don't match.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const userData = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, email }),
        headers: { 'Content-Type': 'application/json' }
      });

      onAuthSuccess({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email
      });
      onOpenChange(false);
      resetForm();
      
      toast({
        title: "Welcome to Celebrait!",
        description: "Your account has been created successfully."
      });
    } catch (error: any) {
      toast({
        title: "Sign Up Failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetForm();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl bg-white border-2 border-gray-200">
        <DialogHeader className="sr-only">
          <DialogTitle>Email Required for Card Delivery</DialogTitle>
          <DialogDescription>We need your email to notify you when your card is ready</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 p-4">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-6 rounded-xl">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">📧 Your Details for Card Delivery</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Our AI creates incredible custom artwork, but it takes up to 2 minutes to generate. We need your details 
                  to send you the card link when it's ready! This way you can close this window and continue with your day while we work our magic.
                </p>
              </div>
            </div>
          </div>

          {/* Step 1: User Type Choice */}
          {currentStep === 'choice' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => setCurrentStep('new')}
                  className="h-auto p-6 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <UserPlus className="w-8 h-8" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">I'm a New User</div>
                      <div className="text-sm opacity-90">Create my account</div>
                    </div>
                  </div>
                </Button>

                <Button
                  onClick={() => setCurrentStep('existing')}
                  className="h-auto p-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <div className="flex flex-col items-center space-y-3">
                    <Mail className="w-8 h-8" />
                    <div className="text-center">
                      <div className="font-semibold text-lg">I've Been Here Before</div>
                      <div className="text-sm opacity-90">Sign in with my email</div>
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Existing User Form */}
          {currentStep === 'existing' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Welcome back! Just enter your email address to continue.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-sm font-medium text-gray-700">Email Address</Label>
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={() => setCurrentStep('choice')}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleSignIn}
                  disabled={isLoading || !email}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-semibold text-white shadow-lg hover:shadow-xl"
                >
                  {isLoading ? 'Signing In...' : 'Continue'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: New User Form */}
          {currentStep === 'new' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  We'll send your card via email, so please double-check your details!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-firstName" className="text-sm font-medium text-gray-700">First Name</Label>
                  <Input
                    id="signup-firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your first name"
                    disabled={isLoading}
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-lastName" className="text-sm font-medium text-gray-700">Last Name</Label>
                  <Input
                    id="signup-lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Your last name"
                    disabled={isLoading}
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-sm font-medium text-gray-700">Email Address</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-emailConfirm" className="text-sm font-medium text-gray-700">Confirm Email Address</Label>
                <Input
                  id="signup-emailConfirm"
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  placeholder="Confirm your email address"
                  disabled={isLoading}
                  className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                />
              </div>

              {email && emailConfirm && email !== emailConfirm && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">Email addresses don't match</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={() => setCurrentStep('choice')}
                  variant="outline"
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleSignUp}
                  disabled={isLoading || !firstName || !lastName || !email || !emailConfirm || email !== emailConfirm}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-semibold text-white shadow-lg hover:shadow-xl"
                >
                  {isLoading ? 'Creating Account...' : 'GENERATE MY CARD'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}