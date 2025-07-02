import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess: () => void;
}

export default function AuthModal({ open, onOpenChange, onAuthSuccess }: AuthModalProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // If user is already authenticated, call success callback
  if (isAuthenticated && open) {
    onAuthSuccess();
    onOpenChange(false);
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md backdrop-blur-md bg-white/95 border-0 shadow-2xl">
        <DialogHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="text-white text-2xl" fill="currentColor" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Ready to Create Your Card?
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center space-y-3">
            <p className="text-gray-700 text-lg">
              Sign in to create your personalized greeting card and access your account features:
            </p>
            
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <ArrowRight className="w-4 h-4 mr-2 text-purple-500" />
                View your order history and tracking
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <ArrowRight className="w-4 h-4 mr-2 text-purple-500" />
                Save your favorite card designs
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <ArrowRight className="w-4 h-4 mr-2 text-purple-500" />
                Manage your delivery preferences
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In with Replit'
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            By signing in, you agree to our{' '}
            <a href="/terms-of-service" className="text-purple-600 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy-policy" className="text-purple-600 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}