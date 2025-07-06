import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Mail, User, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess: (userData: { firstName: string; lastName: string; email: string }) => void;
}

export default function AuthModal({ open, onOpenChange, onAuthSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Sign In Form
  const [signInEmail, setSignInEmail] = useState('');

  // Sign Up Form
  const [signUpFirstName, setSignUpFirstName] = useState('');
  const [signUpLastName, setSignUpLastName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpEmailConfirm, setSignUpEmailConfirm] = useState('');

  const handleSignIn = async () => {
    if (!signInEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Check if user exists
      const response = await apiRequest("POST", "/api/auth/signin", {
        email: signInEmail
      });

      if (response.ok) {
        const userData = await response.json();
        onAuthSuccess({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email
        });
        onOpenChange(false);
      } else {
        // User doesn't exist, suggest sign up
        toast({
          title: "Account Not Found",
          description: "No account found with this email. Please sign up as a new user.",
          variant: "destructive"
        });
        setActiveTab('signup');
        setSignUpEmail(signInEmail);
      }
    } catch (error) {
      toast({
        title: "Sign In Error",
        description: "Failed to sign in. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpFirstName || !signUpLastName) {
      toast({
        title: "Name Required",
        description: "Please enter both your first and last name.",
        variant: "destructive"
      });
      return;
    }

    if (!signUpEmail || !signUpEmailConfirm) {
      toast({
        title: "Email Required",
        description: "Please enter and confirm your email address.",
        variant: "destructive"
      });
      return;
    }

    if (signUpEmail !== signUpEmailConfirm) {
      toast({
        title: "Email Mismatch",
        description: "Email addresses don't match.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/signup", {
        firstName: signUpFirstName,
        lastName: signUpLastName,
        email: signUpEmail
      });

      if (response.ok) {
        const userData = await response.json();
        onAuthSuccess({
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email
        });
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast({
          title: "Sign Up Error",
          description: error.message || "Failed to create account. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Sign Up Error",
        description: "Failed to create account. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-2 border-gray-200">
        <DialogHeader className="sr-only">
          <DialogTitle>Sign In or Create Account</DialogTitle>
          <DialogDescription>Access your account to receive card notifications</DialogDescription>
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
                <h3 className="text-lg font-semibold text-gray-800 mb-2">📧 Sign In to Receive Your Card</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Our AI creates incredible custom artwork, but it takes up to 2 minutes to generate. 
                  Sign in or create an account so we can email you the card link when it's ready! 
                  This way you can close this window and continue with your day while we work our magic.
                </p>
                <p className="text-gray-600 text-xs mt-2 font-medium">
                  Cards are sent via email - we need accurate details to ensure delivery.
                </p>
              </div>
            </div>
          </div>

          {/* Authentication Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Existing User
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                New User
              </TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email Address</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>

                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={handleSignIn}
                    disabled={!signInEmail || isLoading}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        SIGNING IN...
                      </div>
                    ) : (
                      <>
                        SIGN IN & GENERATE CARD
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup" className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname">First Name</Label>
                    <Input
                      id="signup-firstname"
                      type="text"
                      value={signUpFirstName}
                      onChange={(e) => setSignUpFirstName(e.target.value)}
                      placeholder="Your first name"
                      className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastname">Last Name</Label>
                    <Input
                      id="signup-lastname"
                      type="text"
                      value={signUpLastName}
                      onChange={(e) => setSignUpLastName(e.target.value)}
                      placeholder="Your last name"
                      className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email Address</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email-confirm">Confirm Email Address</Label>
                  <Input
                    id="signup-email-confirm"
                    type="email"
                    value={signUpEmailConfirm}
                    onChange={(e) => setSignUpEmailConfirm(e.target.value)}
                    placeholder="Confirm your email address"
                    className="text-lg p-3 rounded-xl border-gray-300 focus:border-purple-400"
                  />
                </div>

                {signUpEmail && signUpEmailConfirm && signUpEmail !== signUpEmailConfirm && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm">Email addresses don't match</p>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-700 text-sm">
                    <strong>Why dual email input?</strong> We require email confirmation for new users to ensure 
                    we have the correct email address for card delivery notifications.
                  </p>
                </div>

                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={handleSignUp}
                    disabled={!signUpFirstName || !signUpLastName || !signUpEmail || !signUpEmailConfirm || signUpEmail !== signUpEmailConfirm || isLoading}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 font-semibold text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        CREATING ACCOUNT...
                      </div>
                    ) : (
                      <>
                        CREATE ACCOUNT & GENERATE CARD
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}